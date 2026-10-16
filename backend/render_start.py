"""Initialize mounted disk permissions, then run the API as an unprivileged user."""
import os
from pathlib import Path
import pwd

account = pwd.getpwnam('patchguard')
root = Path('/data')
root.mkdir(exist_ok=True)
if os.geteuid() == 0:
    os.chown(root, account.pw_uid, account.pw_gid)
    os.chmod(root, 0o700)
    for filename in ('patchguard.sqlite3', 'patchguard.sqlite3-wal', 'patchguard.sqlite3-shm'):
        path = root / filename
        if path.is_symlink():
            raise RuntimeError('Unexpected database symlink')
        if path.exists():
            os.chown(path, account.pw_uid, account.pw_gid)
            os.chmod(path, 0o600)
    os.setgroups([])
    os.setgid(account.pw_gid)
    os.setuid(account.pw_uid)
os.umask(0o077)
os.execvp('python', ['python', 'server.py'])
