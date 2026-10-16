"""RCC PatchGuard API: PostgreSQL in cloud hosting, SQLite for local development."""
import os, json, sqlite3, secrets, hashlib, hmac, datetime, re, threading
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from http.cookies import SimpleCookie
from urllib.parse import urlsplit
from pathlib import Path
import remote_jobs
import database

DB = Path(os.environ.get('PATCHGUARD_DB', str(Path(__file__).with_name('patchguard.sqlite3'))))
HOST = os.environ.get('PATCHGUARD_HOST', '127.0.0.1')
PORT = int(os.environ.get('PATCHGUARD_PORT', '8787'))
ADMIN_EMAIL = os.environ.get('PATCHGUARD_ADMIN_EMAIL', '')
ADMIN_PASSWORD = os.environ.get('PATCHGUARD_ADMIN_PASSWORD', '')
COOKIE_SECURE = os.environ.get('PATCHGUARD_COOKIE_SECURE', '0') == '1'
LOCK = threading.RLock()
def now(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
def digest(s): return hashlib.sha256(s.encode()).hexdigest()
def password_hash(p, salt): return hashlib.pbkdf2_hmac('sha256',p.encode(),bytes.fromhex(salt),350000).hex()
def conn():
 return database.connect(DB)

def init():
 if not os.environ.get('DATABASE_URL'): DB.parent.mkdir(parents=True,exist_ok=True)
 with conn() as c:
  c.executescript(Path(__file__).with_name('schema.sql').read_text())
  if ADMIN_EMAIL and ADMIN_PASSWORD:
   if len(ADMIN_PASSWORD)<14: raise RuntimeError('PATCHGUARD_ADMIN_PASSWORD must be at least 14 characters')
   if not c.execute('SELECT 1 FROM users WHERE email=?',(ADMIN_EMAIL.lower(),)).fetchone():
    salt=secrets.token_hex(16)
    c.execute('INSERT INTO users VALUES(?,?,?,?,?)',(secrets.token_hex(16),ADMIN_EMAIL.lower(),'engineer',salt,password_hash(ADMIN_PASSWORD,salt)))

def audit(c,event,subject=''): c.execute('INSERT INTO audit VALUES(?,?,?,?)',(secrets.token_hex(12),event,subject,now()))
def iso_future(minutes): return (datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(minutes=minutes)).isoformat()
class Handler(BaseHTTPRequestHandler):
 def log_message(self, fmt,*args):
  # Never log URL parameters or credentials
  print('%s %s'%(self.address_string(),self.command),flush=True)
 def reply(self,status,obj,cookie=None):
  if getattr(self,'_defer_reply',False):
   self._pending_reply=(status,obj,cookie);return
  b=json.dumps(obj).encode(); self.send_response(status); self.send_header('Content-Type','application/json'); self.send_header('Cache-Control','no-store'); self.send_header('X-Content-Type-Options','nosniff')
  if cookie:self.send_header('Set-Cookie',cookie)
  self.send_header('Content-Length',str(len(b))); self.end_headers(); self.wfile.write(b)
 def body(self):
  n=int(self.headers.get('Content-Length','0'))
  if n<1 or n>1048576: raise ValueError('Invalid request size')
  x=json.loads(self.rfile.read(n));
  if not isinstance(x,dict):raise ValueError('Expected JSON object')
  return x
 def user(self,c):
  cookies=SimpleCookie(); cookies.load(self.headers.get('Cookie',''))
  t=cookies.get('pg_session'); token=t.value if t else ''
  if not token:return None
  return c.execute('SELECT users.id,users.email,users.role FROM sessions JOIN users ON users.id=sessions.user_id WHERE token_hash=? AND expires>?',(digest(token),now())).fetchone()
 def device(self,c):
  auth=self.headers.get('Authorization','')
  if not auth.startswith('Bearer '):return None
  return c.execute("SELECT * FROM devices WHERE token_hash=? AND enrollment_status='active'",(digest(auth[7:]),)).fetchone()
 def execute(self):
  # Send success only after the database context has committed.
  self._pending_reply=None;self._defer_reply=True
  try:self.execute_request()
  finally:self._defer_reply=False
  if self._pending_reply:self.reply(*self._pending_reply)
 def execute_request(self):
  path=urlsplit(self.path).path
  try:
   if self.command=='POST':
    origin=self.headers.get('Origin')
    if origin:
     from urllib.parse import urlsplit as parse
     u=parse(origin); host=self.headers.get('Host','')
     allowed=os.environ.get('PATCHGUARD_PUBLIC_ORIGIN', '')
     if (allowed and origin != allowed) or (not allowed and u.netloc != host): return self.reply(403,{'error':'Origin mismatch'})
   data=self.body() if self.command=='POST' else {}
   with LOCK,conn() as c:
    c.execute('BEGIN IMMEDIATE')
    user=self.user(c)
    if remote_jobs.route(self,c,user,path,data,now,digest,audit):return
    if path=='/api/health' and self.command=='GET':return self.reply(200,{'ok':True})
    if path=='/api/auth/login' and self.command=='POST':
     email=str(data.get('email','')).lower(); password=str(data.get('password',''))
     u=c.execute('SELECT * FROM users WHERE email=?',(email,)).fetchone()
     if not u or not hmac.compare_digest(password_hash(password,u['salt']),u['password_hash']):return self.reply(401,{'error':'Invalid credentials'})
     token=secrets.token_urlsafe(32); c.execute('INSERT INTO sessions VALUES(?,?,?)',(digest(token),u['id'],iso_future(480)))
     cookie='pg_session='+token+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800'+('; Secure' if COOKIE_SECURE else '')
     return self.reply(200,{'authenticated':True,'user':{'id':u['id'],'email':u['email'],'role':u['role']}},cookie)
    if path=='/api/auth/session' and self.command=='GET':return self.reply(200,{'authenticated':bool(user),**({'user':dict(user)} if user else {})})
    if path=='/api/auth/logout' and self.command=='POST':
     cookies=SimpleCookie();cookies.load(self.headers.get('Cookie',''))
     if cookies.get('pg_session'):c.execute('DELETE FROM sessions WHERE token_hash=?',(digest(cookies['pg_session'].value),))
     return self.reply(200,{'authenticated':False},'pg_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0')
    if path=='/api/agent/enroll' and self.command=='POST':
     token=str(data.get('enrollmentToken','')); inv=data.get('inventory') or {}; hostname=str(inv.get('hostname','')).strip()
     if not hostname or len(hostname)>255:return self.reply(400,{'error':'Invalid hostname'})
     e=c.execute('SELECT * FROM enrollments WHERE token_hash=? AND used=0 AND expires>?',(digest(token),now())).fetchone()
     if not e or e['hostname'].lower()!=hostname.lower():return self.reply(403,{'error':'Invalid, expired, or mismatched enrollment token'})
     device_id=secrets.token_hex(16); secret=secrets.token_urlsafe(32)
     c.execute('UPDATE enrollments SET used=1 WHERE token_hash=?',(digest(token),))
     c.execute('INSERT INTO devices(id,hostname,os_name,os_version,os_build,architecture,agent_version,created_at,token_hash) VALUES(?,?,?,?,?,?,?,?,?)',(device_id,hostname,str(inv.get('os',''))[:200],str(inv.get('version',''))[:100],str(inv.get('build',''))[:100],str(inv.get('architecture',''))[:100],str(inv.get('agentVersion',''))[:100],now(),digest(secret)))
     audit(c,'device.enrolled',device_id)
     return self.reply(200,{'deviceId':device_id,'deviceToken':secret})
    if path in ('/api/agent/heartbeat','/api/agent/scans') and self.command=='POST':
     d=self.device(c)
     if not d or data.get('deviceId')!=d['id']:return self.reply(401,{'error':'Invalid device credential'})
     if path.endswith('heartbeat'):
      inv=data.get('inventory') or {}
      c.execute('UPDATE devices SET last_heartbeat_at=?,os_name=?,os_version=?,os_build=?,architecture=?,agent_version=? WHERE id=?',(now(),str(inv.get('os',''))[:200],str(inv.get('version',''))[:100],str(inv.get('build',''))[:100],str(inv.get('architecture',''))[:100],str(inv.get('agentVersion',''))[:100],d['id']))
      return self.reply(200,{'acknowledged':True})
     report=data.get('report') or {}; updates=report.get('updates',[])
     if not isinstance(updates,list) or len(updates)>2000:return self.reply(400,{'error':'Invalid updates'})
     scan_id=secrets.token_hex(16); received=now(); scanned=str(report.get('scannedAt') or received)
     findings=[]
     for update in updates:
      if not isinstance(update,dict):continue
      findings.append({'id':secrets.token_hex(12),'scan_run_id':scan_id,'update_id':str(update.get('UpdateId',''))[:150],'revision':str(update.get('Revision',''))[:30],'kb':str(update.get('KB',''))[:100],'product':'Windows Update','title':str(update.get('Title',''))[:500],'source':str(update.get('Source','Windows Update'))[:200],'applicability':'applicable','severity':str(update.get('Severity','Unknown'))[:100],'severity_source':'agent','detected_at':scanned,'status':'missing'})
     c.execute('INSERT INTO scans VALUES(?,?,?,?,?,?,?,?,?)',(scan_id,d['id'],d['hostname'],str(report.get('source','Windows Update'))[:200],scanned,scanned,received,'completed',json.dumps(findings)))
     c.execute('UPDATE devices SET last_scan_at=?,restart_status=? WHERE id=?',(received,'required' if report.get('rebootRequired') else 'not_required',d['id']))
     audit(c,'scan.received',d['id']);return self.reply(200,{'accepted':True})
    if not user:return self.reply(401,{'error':'Authentication required'})
    if path=='/api/agent/enrollment-tokens' and self.command=='POST':
     if user['role']!='engineer':return self.reply(403,{'error':'Engineer role required'})
     hostname=str(data.get('hostname','')).strip()
     if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,254}',hostname):return self.reply(400,{'error':'Invalid hostname'})
     token=secrets.token_urlsafe(32); expires=iso_future(10)
     c.execute('INSERT INTO enrollments VALUES(?,?,?,0)',(digest(token),hostname,expires));audit(c,'enrollment.created',hostname)
     return self.reply(200,{'enrollmentToken':token,'hostname':hostname,'expiresAt':expires})
    if path=='/api/agent/devices' and self.command=='GET':
     records=[]
     for d in c.execute('SELECT * FROM devices ORDER BY created_at DESC'):
      item={k:d[k] for k in ('id','hostname','os_name','os_version','os_build','architecture','agent_version','enrollment_status','restart_status','last_heartbeat_at','last_scan_at','created_at')}
      item['scan_count']=c.execute('SELECT count(*) FROM scans WHERE asset_id=?',(d['id'],)).fetchone()[0];records.append(item)
     return self.reply(200,{'records':records})
    if path=='/api/agent/scans' and self.command=='GET':
     records=[]
     for s in c.execute('SELECT * FROM scans ORDER BY received_at DESC LIMIT 200'):
      item={k:s[k] for k in ('id','asset_id','hostname','provider','started_at','completed_at','received_at','status')};item['updates']=json.loads(s['updates']);records.append(item)
     return self.reply(200,{'records':records})
    m=re.fullmatch(r'/api/agent/devices/([a-f0-9]{32})/revoke',path)
    if m and self.command=='POST':
     if user['role']!='engineer':return self.reply(403,{'error':'Engineer role required'})
     c.execute("UPDATE devices SET enrollment_status='revoked' WHERE id=?",(m.group(1),));audit(c,'device.revoked',m.group(1))
     return self.reply(200,{'revoked':True,'revokedAt':now()})
    return self.reply(404,{'error':'Unknown API route'})
  except (ValueError,TypeError,json.JSONDecodeError):return self.reply(400,{'error':'Invalid request'})
  except Exception as ex:
   print('Backend error:',type(ex).__name__,flush=True)
   return self.reply(500,{'error':'Internal server error'})
 def do_GET(self):
  if self.path.startswith('/api/'):
   return self.execute()
  import mimetypes
  from urllib.parse import unquote
  root=Path(os.environ.get('PATCHGUARD_SITE', '/app/site')).resolve()
  target=(root / unquote(urlsplit(self.path).path).lstrip('/')).resolve()
  if not target.is_relative_to(root):return self.reply(404,{'error':'Not found'})
  if not target.is_file():target=root / 'index.html'
  if not target.is_file():return self.reply(404,{'error':'Not found'})
  payload=target.read_bytes()
  self.send_response(200);self.send_header('Content-Type',mimetypes.guess_type(target)[0] or 'application/octet-stream');self.send_header('Content-Length',str(len(payload)));self.send_header('Cache-Control','no-cache');self.end_headers();self.wfile.write(payload)
 def do_POST(self):self.execute()
if __name__=='__main__':
 init(); print(f'PatchGuard backend listening on http://{HOST}:{PORT}',flush=True)
 ThreadingHTTPServer((HOST,PORT),Handler).serve_forever()
