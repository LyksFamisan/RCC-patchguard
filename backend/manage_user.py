"""Run on the backend host; reads passwords securely, never command arguments."""
import argparse
import getpass
import secrets
import server

parser = argparse.ArgumentParser()
parser.add_argument('email')
parser.add_argument('role', choices=['engineer', 'client_approver', 'read_only_reviewer'])
args = parser.parse_args()
password = getpass.getpass('New password (14+ characters): ')
if len(password) < 14 or password != getpass.getpass('Confirm password: '):
    raise SystemExit('Password too short or confirmation mismatch')
server.init()
salt = secrets.token_hex(16)
with server.conn() as c:
    existing = c.execute('SELECT id FROM users WHERE email=?', (args.email.lower(),)).fetchone()
    identity = existing['id'] if existing else secrets.token_hex(16)
    c.execute('INSERT INTO users VALUES(?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET role=excluded.role,salt=excluded.salt,password_hash=excluded.password_hash', (identity, args.email.lower(), args.role, salt, server.password_hash(password, salt)))
    c.execute('DELETE FROM sessions WHERE user_id=?', (identity,))
    server.audit(c, 'user.configured', identity)
print('User configured; previous sessions revoked.')
