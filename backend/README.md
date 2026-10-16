# Backend and remote operations

See [DEPLOYMENT.md](DEPLOYMENT.md) for the current persistent hosting setup, approved installation/restart jobs, and Windows worker pilot instructions. Remote jobs are disabled by default.

## Original local scanning setup

# PatchGuard backend setup

Requires Python 3.10+ and Node.js 22+. Local SQLite is created automatically. Cloud PostgreSQL requires `python -m pip install -r backend/requirements.txt`. See [RENDER.md](RENDER.md) for Render Free + Neon Free.

## Local development (Mac or Windows)

Set `PATCHGUARD_ADMIN_EMAIL` and a unique `PATCHGUARD_ADMIN_PASSWORD` of 14+ characters in your shell. Do not commit credentials.

Windows PowerShell:
```powershell
$env:PATCHGUARD_ADMIN_EMAIL='admin@example.com'
$env:PATCHGUARD_ADMIN_PASSWORD='replace-with-a-unique-strong-password'
python backend/server.py
```
Mac/Linux:
```bash
export PATCHGUARD_ADMIN_EMAIL='admin@example.com'
export PATCHGUARD_ADMIN_PASSWORD='replace-with-a-unique-strong-password'
python3 backend/server.py
```
In a second terminal:
```bash
npm install
npm run dev
```
Open http://localhost:8445. Vite proxies `/api` to the local backend. Sign in using the configured credentials. Generate a single-use enrollment token for the exact Windows hostname. On the Windows machine, launch `RCC-Windows-Agent/Start-Agent.cmd`, supply the HTTPS **public backend URL** and token, then enroll, heartbeat, scan and upload results.

**Important:** The current agent requires HTTPS and cannot connect to localhost on a different PC. This Python backend binds to loopback and serves HTTP for local development only. To enroll remote Windows PCs, deploy behind a trusted HTTPS reverse proxy with durable SQLite storage, set `PATCHGUARD_COOKIE_SECURE=1`, and configure same-origin `/api` routing. Do not expose the HTTP development server directly to the internet. Vercel frontend hosting alone does not host this persistent SQLite backend.

The original GUI agent supports enrollment, heartbeat, scan upload, device listing, scan listing and revocation. The separate `Remote-Worker.ps1` adds approved installation/restart jobs; see the deployment guide. Neither agent self-updates or runs as a Windows Service. The included PowerShell agent is an interactive application with optional 60-second heartbeat while open; automatic 12-hour scanning is **not** implemented. Production use requires access controls, rate limiting, monitoring, backups, TLS termination, deployment hardening and Windows endpoint tests.
