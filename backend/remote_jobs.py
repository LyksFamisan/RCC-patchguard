"""Durable, single-delivery jobs. No arbitrary scripts or command strings."""
import datetime as dt
import json
import os
import re
import secrets

SCHEMA = '''
CREATE TABLE IF NOT EXISTS remote_jobs (
 id TEXT PRIMARY KEY, device_id TEXT NOT NULL REFERENCES devices(id),
 kind TEXT NOT NULL, updates TEXT NOT NULL, reason TEXT NOT NULL,
 starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, status TEXT NOT NULL,
 requested_by TEXT NOT NULL, approved_by TEXT, created_at TEXT NOT NULL,
 claimed_at TEXT, claim_hash TEXT, result TEXT
);
'''

def timestamp(value):
    result = dt.datetime.fromisoformat(str(value).replace('Z', '+00:00'))
    if result.tzinfo is None:
        raise ValueError('Timezone required')
    return result.astimezone(dt.timezone.utc)

def route(handler, c, user, path, data, now, digest, audit):
    if not path.startswith('/api/remote/'):
        return False
    def reply(status, value):
        handler.reply(status, value)
        return True
    enabled = os.environ.get('PATCHGUARD_REMOTE_JOBS', '0') == '1'
    if not enabled:
        return reply(503, {'error': 'Remote jobs are disabled on this server'})
    instant = timestamp(now())
    c.execute("UPDATE remote_jobs SET status='expired' WHERE status IN ('pending','approved') AND ends_at<=?", (now(),))
    if path in ('/api/remote/poll', '/api/remote/result', '/api/remote/authorize'):
        if handler.command != 'POST':
            return reply(405, {'error': 'POST required'})
        device = handler.device(c)
        if not device or data.get('deviceId') != device['id']:
            return reply(401, {'error': 'Invalid device credential'})
        if path.endswith('/poll'):
            # BEGIN IMMEDIATE is acquired by the caller. Claims are never requeued.
            if c.execute("SELECT 1 FROM remote_jobs WHERE device_id=? AND status IN ('running','restart_pending')", (device['id'],)).fetchone():
                return reply(200, {'job': None})
            job = c.execute("SELECT * FROM remote_jobs WHERE device_id=? AND status='approved' AND starts_at<=? AND ends_at>? ORDER BY created_at LIMIT 1", (device['id'], now(), now())).fetchone()
            if not job:
                return reply(200, {'job': None})
            claim = secrets.token_urlsafe(32)
            c.execute("UPDATE remote_jobs SET status='running',claimed_at=?,claim_hash=? WHERE id=? AND status='approved'", (now(), digest(claim), job['id']))
            audit(c, 'remote.claimed', job['id'])
            return reply(200, {'job': {'id': job['id'], 'deviceId': job['device_id'], 'kind': job['kind'], 'updates': json.loads(job['updates']), 'startsAt': job['starts_at'], 'endsAt': job['ends_at'], 'claimToken': claim}})
        job = c.execute('SELECT * FROM remote_jobs WHERE id=? AND device_id=?', (str(data.get('jobId', '')), device['id'])).fetchone()
        import hmac
        if not job or not job['claim_hash'] or not hmac.compare_digest(job['claim_hash'], digest(str(data.get('claimToken', '')))):
            return reply(403, {'error': 'Invalid job claim'})
        if path.endswith('/authorize'):
            if job['status'] not in ('running', 'restart_pending') or not timestamp(job['starts_at']) <= instant < timestamp(job['ends_at']):
                return reply(409, {'error': 'Job is not executable in this maintenance window'})
            return reply(200, {'authorized': True})
        status = data.get('status')
        allowed = {'running': {'succeeded', 'failed', 'restart_pending'}, 'restart_pending': {'restart_confirmed', 'failed'}}
        if status not in allowed.get(job['status'], set()):
            if status == job['status']:
                return reply(200, {'accepted': True})
            return reply(409, {'error': 'Invalid job state transition'})
        if (status in ('restart_pending', 'restart_confirmed')) != (job['kind'] == 'restart') and status != 'failed':
            return reply(400, {'error': 'Result does not match job type'})
        detail = data.get('detail', {})
        if not isinstance(detail, dict) or len(json.dumps(detail)) > 50000:
            return reply(400, {'error': 'Invalid result'})
        c.execute('UPDATE remote_jobs SET status=?,result=? WHERE id=?', (status, json.dumps({'receivedAt': now(), 'detail': detail}), job['id']))
        audit(c, 'remote.' + status, job['id'])
        return reply(200, {'accepted': True})
    if not user:
        return reply(401, {'error': 'Authentication required'})
    if path == '/api/remote/jobs' and handler.command == 'GET':
        rows = []
        for row in c.execute('SELECT remote_jobs.*,devices.hostname FROM remote_jobs JOIN devices ON devices.id=device_id ORDER BY created_at DESC LIMIT 200'):
            item = dict(row)
            item.pop('claim_hash')
            item['updates'] = json.loads(item['updates'])
            item['result'] = json.loads(item['result']) if item['result'] else None
            rows.append(item)
        return reply(200, {'records': rows})
    if path == '/api/remote/jobs' and handler.command == 'POST':
        if user['role'] != 'engineer':
            return reply(403, {'error': 'Engineer role required'})
        device = c.execute("SELECT * FROM devices WHERE id=? AND enrollment_status='active'", (str(data.get('deviceId', '')),)).fetchone()
        if not device or data.get('confirmHostname') != device['hostname']:
            return reply(400, {'error': 'Confirm the exact enrolled hostname'})
        kind = data.get('kind')
        if kind not in ('install', 'restart'):
            return reply(400, {'error': 'Only install and restart jobs are supported'})
        reason = str(data.get('reason', '')).strip()
        if not 10 <= len(reason) <= 1000:
            return reply(400, {'error': 'Provide a reason of 10–1000 characters'})
        start, end = timestamp(data.get('startsAt')), timestamp(data.get('endsAt'))
        if start < instant - dt.timedelta(minutes=2) or end <= instant or not dt.timedelta(minutes=5) <= end - start <= dt.timedelta(hours=4) or start > instant + dt.timedelta(days=30):
            return reply(400, {'error': 'Choose a future maintenance window lasting 5 minutes to 4 hours'})
        updates = data.get('updates', [])
        if not isinstance(updates, list) or len(updates) > 100:
            return reply(400, {'error': 'Invalid update selection'})
        selected = []
        if kind == 'install':
            scan = c.execute('SELECT * FROM scans WHERE asset_id=? ORDER BY received_at DESC LIMIT 1', (device['id'],)).fetchone()
            if not scan or instant - timestamp(scan['received_at']) > dt.timedelta(hours=24):
                return reply(400, {'error': 'Upload a scan from the last 24 hours first'})
            available = {(u['update_id'].lower(), str(u['revision'])) for u in json.loads(scan['updates'])}
            for update in updates:
                if not isinstance(update, dict):
                    raise ValueError('Invalid update')
                identity = str(update.get('id', '')).lower()
                revision = str(update.get('revision', ''))
                if not re.fullmatch(r'[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}', identity) or not revision.isdigit() or (identity, revision) not in available:
                    return reply(400, {'error': 'Selected update is absent from the latest device scan'})
                if {'id': identity, 'revision': int(revision)} not in selected:
                    selected.append({'id': identity, 'revision': int(revision)})
            if not selected:
                return reply(400, {'error': 'Select at least one scanned update'})
        elif updates:
            return reply(400, {'error': 'Restart jobs cannot contain updates'})
        job_id = secrets.token_hex(16)
        c.execute('INSERT INTO remote_jobs(id,device_id,kind,updates,reason,starts_at,ends_at,status,requested_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)', (job_id, device['id'], kind, json.dumps(selected), reason, start.isoformat(), end.isoformat(), 'pending', user['id'], now()))
        audit(c, 'remote.requested', job_id)
        return reply(201, {'id': job_id, 'status': 'pending'})
    match = re.fullmatch(r'/api/remote/jobs/([a-f0-9]{32})/(approve|cancel)', path)
    if match and handler.command == 'POST':
        job = c.execute('SELECT * FROM remote_jobs WHERE id=?', (match[1],)).fetchone()
        if not job:
            return reply(404, {'error': 'Job not found'})
        if match[2] == 'approve':
            if user['role'] != 'client_approver' or user['id'] == job['requested_by']:
                return reply(403, {'error': 'A separate client approver must approve this job'})
            if job['status'] != 'pending':
                return reply(409, {'error': 'Job is no longer pending'})
            active = c.execute("SELECT hostname FROM devices WHERE id=? AND enrollment_status='active'", (job['device_id'],)).fetchone()
            if not active or data.get('confirmHostname') != active['hostname']:
                return reply(400, {'error': 'Confirm the exact enrolled hostname'})
            c.execute("UPDATE remote_jobs SET status='approved',approved_by=? WHERE id=?", (user['id'], job['id']))
            audit(c, 'remote.approved', job['id'])
        else:
            if user['role'] not in ('engineer', 'client_approver'):
                return reply(403, {'error': 'Insufficient role'})
            if job['status'] not in ('pending', 'approved'):
                return reply(409, {'error': 'Claimed jobs cannot be cancelled remotely'})
            c.execute("UPDATE remote_jobs SET status='cancelled' WHERE id=?", (job['id'],))
            audit(c, 'remote.cancelled', job['id'])
        return reply(200, {'accepted': True})
    return reply(404, {'error': 'Unknown remote route'})
