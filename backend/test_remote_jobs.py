"""HTTP integration tests; no Windows commands are executed."""
import datetime as dt
import http.client
import json
import os
from pathlib import Path
import tempfile
import threading
import unittest
import server

class RemoteJobsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        server.DB = Path(cls.temp.name) / 'test.sqlite3'
        server.ADMIN_EMAIL = ''; server.ADMIN_PASSWORD = ''
        os.environ['PATCHGUARD_REMOTE_JOBS'] = '1'
        server.init()
        cls.http = server.ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
        cls.thread = threading.Thread(target=cls.http.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown(); cls.http.server_close(); cls.temp.cleanup()

    def setUp(self):
        os.environ['PATCHGUARD_REMOTE_JOBS'] = '1'
        os.environ.pop('PATCHGUARD_PUBLIC_ORIGIN', None)
        with server.conn() as c:
            for table in ['remote_jobs','scans','devices','sessions','users','audit','enrollments']:
                c.execute('DELETE FROM ' + table)
            for identity, role in [('engineer','engineer'),('approver','client_approver'),('viewer','read_only_reviewer')]:
                c.execute('INSERT INTO users VALUES(?,?,?,?,?)', (identity, identity+'@example.test', role, '00'*16, 'unused'))
                c.execute('INSERT INTO sessions VALUES(?,?,?)', (server.digest(identity), identity, server.iso_future(60)))
            for identity in ['a'*32, 'b'*32]:
                c.execute('INSERT INTO devices(id,hostname,created_at,token_hash) VALUES(?,?,?,?)', (identity, 'WIN-'+identity[0], server.now(), server.digest(identity)))
            c.execute('INSERT INTO scans VALUES(?,?,?,?,?,?,?,?,?)', ('scan','a'*32,'WIN-a','Windows',server.now(),server.now(),server.now(),'completed',json.dumps([{'update_id':'12345678-1234-1234-1234-123456789abc','revision':'1'}])))

    def request(self, method, path, body=None, user=None, device=None, extra=None):
        client = http.client.HTTPConnection('127.0.0.1', self.http.server_port, timeout=5)
        headers = {'Content-Type':'application/json'}
        if user: headers['Cookie']='pg_session='+user
        if device: headers['Authorization']='Bearer '+device
        headers.update(extra or {})
        client.request(method,path,json.dumps(body) if body is not None else None,headers)
        response = client.getresponse(); result = (response.status,json.loads(response.read())); client.close()
        return result

    def create(self, kind='restart', **changes):
        instant=dt.datetime.now(dt.timezone.utc)
        payload={'deviceId':'a'*32,'confirmHostname':'WIN-a','kind':kind,'reason':'CHG-123 approved maintenance','startsAt':(instant-dt.timedelta(seconds=1)).isoformat(),'endsAt':(instant+dt.timedelta(minutes=30)).isoformat(),'updates':[]}
        if kind=='install': payload['updates']=[{'id':'12345678-1234-1234-1234-123456789abc','revision':1}]
        payload.update(changes)
        return self.request('POST','/api/remote/jobs',payload,user='engineer')

    def approved(self, kind='restart'):
        status,body=self.create(kind); self.assertEqual(status,201)
        self.assertEqual(self.request('POST',f"/api/remote/jobs/{body['id']}/approve",{'confirmHostname':'WIN-a'},user='approver')[0],200)
        return body['id']

    def poll(self, device='a'*32):
        return self.request('POST','/api/remote/poll',{'deviceId':device},device=device)

    def test_feature_gate(self):
        os.environ['PATCHGUARD_REMOTE_JOBS']='0'
        self.assertEqual(self.create()[0],503)

    def test_unauthenticated_and_read_only(self):
        self.assertEqual(self.request('GET','/api/remote/jobs')[0],401)
        self.assertEqual(self.request('POST','/api/remote/jobs',{},user='viewer')[0],403)

    def test_pending_jobs_never_delivered(self):
        self.assertEqual(self.create()[0],201)
        self.assertIsNone(self.poll()[1]['job'])

    def test_approval_requires_separate_role_and_hostname(self):
        _,job=self.create(); path=f"/api/remote/jobs/{job['id']}/approve"
        self.assertEqual(self.request('POST',path,{'confirmHostname':'WIN-a'},user='engineer')[0],403)
        self.assertEqual(self.request('POST',path,{'confirmHostname':'wrong'},user='approver')[0],400)

    def test_single_delivery_and_device_binding(self):
        self.approved()
        self.assertIsNone(self.poll('b'*32)[1]['job'])
        self.assertIsNotNone(self.poll()[1]['job'])
        self.assertIsNone(self.poll()[1]['job'])

    def test_result_auth_and_restart_confirmation(self):
        self.approved(); job=self.poll()[1]['job']
        payload={'deviceId':'a'*32,'jobId':job['id'],'claimToken':job['claimToken'],'status':'restart_pending','detail':{}}
        self.assertEqual(self.request('POST','/api/remote/result',{**payload,'claimToken':'wrong'},device='a'*32)[0],403)
        self.assertEqual(self.request('POST','/api/remote/result',payload,device='a'*32)[0],200)
        self.assertEqual(self.request('POST','/api/remote/result',{**payload,'status':'restart_confirmed'},device='a'*32)[0],200)
        self.assertEqual(self.request('POST','/api/remote/result',{**payload,'status':'running'},device='a'*32)[0],409)

    def test_install_requires_exact_scan_identity(self):
        self.assertEqual(self.create('install',updates=[{'id':'12345678-1234-1234-1234-123456789abc','revision':2}])[0],400)
        self.assertEqual(self.create('install')[0],201)

    def test_expired_and_future_windows_not_delivered(self):
        identity=self.approved()
        with server.conn() as c:c.execute("UPDATE remote_jobs SET starts_at=?,ends_at=? WHERE id=?",(server.iso_future(20),server.iso_future(50),identity))
        self.assertIsNone(self.poll()[1]['job'])
        with server.conn() as c:c.execute("UPDATE remote_jobs SET ends_at=? WHERE id=?",('2000-01-01T00:00:00+00:00',identity))
        self.assertIsNone(self.poll()[1]['job'])
        self.assertEqual(self.request('GET','/api/remote/jobs',user='engineer')[1]['records'][0]['status'],'expired')

    def test_revocation_blocks_execution(self):
        identity=self.approved(); job=self.poll()[1]['job']
        self.request('POST','/api/agent/devices/'+'a'*32+'/revoke',{},user='engineer')
        self.assertEqual(self.request('POST','/api/remote/authorize',{'deviceId':'a'*32,'jobId':identity,'claimToken':job['claimToken']},device='a'*32)[0],401)

    def test_cancel_and_claim_rules(self):
        identity=self.approved()
        self.assertEqual(self.request('POST',f'/api/remote/jobs/{identity}/cancel',{},user='engineer')[0],200)
        self.assertIsNone(self.poll()[1]['job'])
        identity=self.approved();self.poll()
        self.assertEqual(self.request('POST',f'/api/remote/jobs/{identity}/cancel',{},user='engineer')[0],409)

    def test_origin_and_no_secret_disclosure(self):
        self.assertEqual(self.request('POST','/api/remote/jobs',{},user='engineer',extra={'Origin':'https://evil.test'})[0],403)
        self.approved(); self.poll()
        records=self.request('GET','/api/remote/jobs',user='viewer')[1]['records']
        self.assertNotIn('claim_hash',records[0])
        self.assertNotIn('claimToken',records[0])

if __name__=='__main__':unittest.main()
