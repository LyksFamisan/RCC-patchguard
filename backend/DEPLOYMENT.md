# PatchGuard backend and remote operations

## What this change provides

The persistent Python API now supports a real Windows update job queue, independent client approval, maintenance windows, and device-reported results. The dashboard's **Assets → Remote operations** panel uses this API and never uses the demo role selector for authorization. Existing simulated deployment pages remain separate.

Remote jobs are **disabled by default**. This is implementation code, not evidence of a deployed backend or a successful Windows installation. Linux HTTP integration tests cover authorization and delivery. The Windows worker must be validated on an authorized Windows test machine before client rollout. There is no Windows Service installation, automatic rollback, or third-party application patching.

## Hosting with persistent storage

Use a Linux host with Docker Compose, a hostname pointing to it, and ports 80/443 available. The included Compose stack serves both the dashboard and API on the same HTTPS origin. Caddy obtains the TLS certificate. SQLite data lives in a durable Docker volume; use a single backend replica. Do not place this SQLite file on an ephemeral Vercel filesystem.

1. Clone the repository on the host.
2. Create a private `.env` in the repository root (`chmod 600 .env`):

```dotenv
PATCHGUARD_DOMAIN=patchguard.your-domain.example
PATCHGUARD_ADMIN_EMAIL=engineer@your-company.example
PATCHGUARD_ADMIN_PASSWORD=choose-a-new-unique-password-of-at-least-14-characters
PATCHGUARD_REMOTE_JOBS=0
```

Replace every example value. Never commit this file. No shared/default password is supplied.

3. Start the backend and dashboard:

```sh
docker compose up -d --build
docker compose exec backend python manage_user.py approver@your-company.example client_approver
```

The management command prompts securely for the **separate approver's** password. It also supports `engineer` and `read_only_reviewer`; updating a user revokes its previous sessions. Changing the bootstrap environment password does not reset an existing user; use this command for resets.

4. Confirm `https://YOUR_HOST/api/health` returns JSON `{"ok":true}`. Sign in under **Enroll Device**, enroll a test Windows PC, and upload a current scan.
5. After Windows pilot validation, set `PATCHGUARD_REMOTE_JOBS=1` in `.env` and run `docker compose up -d`. Until then the remote API returns a clear 503 response.

The existing `rcc-patchguard.vercel.app` frontend remains independent of this stack. To keep that URL, configure a Vercel external `/api/:path*` rewrite to the **actual hosted backend** once available, set `PATCHGUARD_PUBLIC_ORIGIN=https://rcc-patchguard.vercel.app` on that backend, and use the Vercel origin for agent enrollment too. Do not add a placeholder backend URL to production. The deployment needs the user's host/domain access; this repository change does not provision a server.

## Windows worker

1. Enroll using `RCC-Windows-Agent/Start-Agent.cmd` as the Windows operator that will run the worker. Upload a scan. Update IDs and revisions from the last 24 hours are required for an install request.
2. Open **Windows PowerShell as Administrator**, using that same Windows account (the enrollment credential is protected by that user's DPAPI).
3. Run the reviewed script under your organization's script-signing policy:

```powershell
powershell.exe -NoProfile -File .\RCC-Windows-Agent\Remote-Worker.ps1
```

This opts the PC into approved installation jobs while the console remains open. To explicitly authorize restart jobs locally:

```powershell
powershell.exe -NoProfile -File .\RCC-Windows-Agent\Remote-Worker.ps1 -AllowRestart
```

The worker uses outbound HTTPS only, the enrolled device token, Windows Update Agent COM APIs, and the configured Windows update source. It installs only the approved UpdateID/revision pairs. Updates requiring user interaction or unaccepted license terms fail instead of silently accepting terms. Installation does not trigger an automatic restart; request a separate restart job. It never downloads executable scripts or evaluates arbitrary commands from the server.

## Request, approve, and observe

1. Sign in as an actual **engineer** under Enroll Device.
2. Open **Assets → Remote operations**. Select the enrolled device and operation, approved scan updates, reason/change ticket, exact hostname, and a maintenance window of 5 minutes to 4 hours. Times entered in the form use the operator's local browser timezone; the API stores UTC.
3. Submit the request. A separate `client_approver` signs in, reviews the exact device/update list/window/reason, types the hostname, and approves. Engineer accounts cannot approve their own jobs.
4. The worker polls every 30 seconds, claims a job once, and rechecks server authorization immediately before installation/restart. Requests outside the maintenance window are never delivered. Pending requests can be cancelled before claim. Revoked credentials cannot poll, report, or authorize execution.
5. Refresh jobs to view results. `succeeded` is the Windows installer outcome, not a compliance claim; upload a fresh scan for verification. `restart_pending` is not success: reopen the worker after reboot so it can observe the new boot time and report `restart_confirmed`.

Restart uses Windows `shutdown /r /t 0` without `/f`. Notify users in advance. Applications can block it; the job remains unconfirmed until a new boot is observed. Installing an update can run beyond the end of a window after it has started; do not terminate Windows servicing mid-install.

The local protected journal prevents replay after a worker crash. Jobs with uncertain results are never redelivered automatically. Review Windows Update history and the API job before issuing another request. Do not delete pending journal files to force a retry. Revocation or disabling remote jobs cannot undo a Windows servicing operation already in progress.

## Operational limits and validation

- Back up the SQLite volume using SQLite's backup API; test restoration. Never publish database files or job journals.
- Keep the backend private behind Caddy. Add organization-approved monitoring, request limits, backups, and identity controls before wider rollout.
- The worker runs in an elevated console, not as a service; it stops when the console closes and must be reopened after restart.
- No Windows commands have been executed by the development tests. Run a pilot covering successful installation, failure, blocked restart, new boot reporting, expired windows, revoked credentials, and disconnected endpoints.

```sh
python -m unittest discover -s backend -p 'test_*.py' -q
npx tsc --noEmit
npm run build
```
