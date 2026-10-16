# RCC PatchGuard Windows Agent 0.2

A real Windows desktop application implemented in Windows PowerShell 5.1 and WinForms. This is source software, not an image, compiled EXE, Windows service, or production-certified agent. No external packages required. Intended first for an authorized RCC Windows 10/11 test laptop with Windows PowerShell 5.1. Windows runtime validation is outstanding: this package was authored in Linux, which cannot execute WinForms or Windows Update COM.

## What works in the implementation
- Displays real local hostname, Windows version/build and architecture through CIM.
- Starts an actual asynchronous read-only Windows Update search in a background process; displays update IDs/revisions, KBs and provider severity (unknown stays unknown).
- Reads Windows Update pending-restart state.
- Exports real successful scan results to JSON.
- HTTPS registration against the existing PatchGuard API, user-encrypted device credentials, manual/optional 60-second heartbeat and explicit read-only scan submission using API-CONTRACT.md.
- No fake connected states, sample devices, patch installation, arbitrary command execution or restart capability.

## Start on Laptop 2
1. Extract the ZIP into a folder on your authorized Windows test laptop.
2. Review RCC-Agent.ps1 or have the RCC technical engineer review it.
3. Double-click Start-Agent.cmd. It launches Windows PowerShell in STA mode. You can also run `powershell.exe -NoProfile -STA -File .\RCC-Agent.ps1` from that folder.
4. If enterprise policy blocks unsigned scripts, obtain your administrator's approval/signing procedure. The launcher does NOT bypass execution policy. Do not disable security protections.
5. Device information is local and should appear immediately. Click **Scan missing updates** to query the device's configured update source. Scans may take minutes. Check Windows Update access/policy if it fails. No updates are installed.
6. Use **Export scan JSON** for portable evidence.

## Laptop 1 — start the dashboard and backend

The authenticated API is in the existing `Security Services Platform` project; the RCC PatchGuard dashboard is the `High-fidelity Figma prototype` project. From separate Laptop 1 terminals:

```sh
cd "/Users/rcc/Downloads/Security Services Platform"
npm run api
```

```sh
cd "/Users/rcc/Downloads/High-fidelity Figma prototype"
npm run dev
```

If the updated API is already running, stop it in its existing terminal with Ctrl+C and restart it once so the additive database migration and new API routes load. Do not start a second API process. Open the actual dashboard URL printed by Vite. If no sign-in account exists yet, create the initial Engineer account interactively from the backend project with `npm run bootstrap:user -- engineer@example.com`.

The API listens on Laptop 1 loopback at `127.0.0.1:8787`; that is intentionally not reachable from Laptop 2. For Laptop 2, the client must approve a reachable HTTPS hostname and TLS certificate. Configure an HTTPS reverse proxy on Laptop 1 to route `/api` to `127.0.0.1:8787`, overwrite `X-Forwarded-Proto` with `https`, and serve the dashboard on the same approved HTTPS origin. Set `PATCHGUARD_COOKIE_SECURE=true` and configure `PATCHGUARD_ALLOWED_ORIGINS` to the exact dashboard origin. Keep the API on loopback, firewall restrictions enabled, and the certificate trusted by Laptop 2. Proxy/access logs must not record authorization headers or request bodies. Do not expose the API directly, use HTTP, or bypass certificate validation. The client-approved hostname, certificate, reverse proxy and firewall rules are environment-specific and are not present in this package.

On the dashboard, open **Enroll Device**, sign in with the existing PatchGuard Engineer account, enter the authorized Windows hostname, then generate a token. It is hostname-scoped, single-use, expires after 10 minutes and is shown once. Do not paste it into tickets or logs.

## Laptop 2 — run and verify the Windows agent

1. Extract this folder onto the authorized Windows test laptop and review `RCC-Agent.ps1`.
2. Double-click `Start-Agent.cmd`. It launches Windows PowerShell in STA mode. Alternatively, from that folder run `powershell.exe -NoProfile -STA -File .\RCC-Agent.ps1`. It does not bypass execution policy.
3. In the agent, enter the reachable HTTPS API base address on Laptop 1 (not `localhost` or `127.0.0.1`) and the fresh token for this exact Windows hostname. Click **Register device**.
4. Click **Send heartbeat**. Registration alone is not evidence of current connectivity. The backend acknowledges heartbeats and stores its own receipt timestamp.
5. In the dashboard **Assets** page, refresh and confirm the real hostname, OS/build, architecture, agent version and API-received heartbeat. These records are fetched from the backend and are separate from sample/imported assets.
6. In the agent click **Scan missing updates**. After a successful read-only scan, click **Send scan to backend**. In dashboard **Scan results**, refresh and verify the agent source, scan timestamp, backend receipt timestamp and submitted updates.
7. Optionally enable periodic heartbeat while the app remains open. Revoke credentials from the Assets page as an authenticated Engineer when needed.

The UI may pause for up to 20 seconds during a network request; scans run separately. Device credentials are stored under `%LOCALAPPDATA%\RCCPatchGuardAgent\connection.json`, encrypted for that Windows user. Do not share that file. Nothing auto-starts at boot.

## Stop/remove
Close the app to stop the timer and running scan worker. Use **Forget locally** to delete the saved credential; revoke the device token separately on the server. Delete the extracted files and `%LOCALAPPDATA%\RCCPatchGuardAgent` if no longer needed. There is no service or scheduled task to remove.

## Limits and remaining work
- Windows PowerShell/WinForms, Windows Update COM, TLS trust, network path, actual Laptop 2 enrollment, heartbeat, scan comparison, and credential revocation still require Windows testing.
- Scan coverage depends on configured Windows Update/WSUS/Microsoft Update policy. It is NOT a full vulnerability scanner, full software inventory or guaranteed coverage of all Microsoft products.
- No independent testing/pilot approval flow, deployment, installation, verification of remediation or automatic reporting schedule.
- No compiled/signed EXE or installer included. A C#/.NET implementation or reviewed packaging step would be needed for that deliverable.
- This user-session app is not a hardened production background service. Reliability, security, scale and Windows end-to-end testing remain required before client rollout. The local SQLite backend and this agent are not production-approved.

## Windows acceptance checklist
- Launch under the intended Windows user; confirm hostname/OS matches the laptop.
- Scan a real device; compare results with its configured update source and export JSON.
- Invalid token/URL must never show registered/connected.
- Backend API tests verify authenticated hostname-scoped token issuance, single-use consumption, hashed credentials, heartbeat receipt, scan persistence/idempotency, and rejection after revocation.
- On Windows, enroll once, reject token reuse, acknowledge heartbeat, store a real scan, and reject revoked credentials.
- Disconnect network: show heartbeat failure and keep last-success timestamp; reconnect and retry.
- Verify no installer/restart occurs. Close app and confirm heartbeat stops.

## Official reference
Windows Update Agent search: https://learn.microsoft.com/en-us/windows/win32/api/wuapi/nf-wuapi-iupdatesearcher-search
