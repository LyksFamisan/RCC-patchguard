# Backend integration contract v0.2

This contract is implemented by the PatchGuard API in the existing Security Services Platform backend. All responses are JSON; non-2xx means failure. HTTPS with a trusted certificate is mandatory for agent requests. Redirects are not supported. Agent requests authenticate with an HTTP Authorization header carrying `Bearer <deviceToken>`.

## POST /api/agent/enrollment-tokens (authenticated dashboard session)
Input: `{ "hostname": "WIN-TEST-01" }`

Only an authenticated Engineer may issue a token. The server binds it to that exact hostname, stores only its hash, records an audit event, and returns `{ "enrollmentToken": "single-use-secret", "hostname": "WIN-TEST-01", "expiresAt": "UTC ISO8601" }`. Tokens expire after 10 minutes and are returned only once. The dashboard must not persist or log the token. Client Approver and Read-only Reviewer roles cannot issue enrollment tokens.

## POST /api/agent/enroll
Input: `{ "enrollmentToken": "single-use-secret", "inventory": { "hostname": "...", "os": "...", "version": "...", "build": "...", "agentVersion": "0.1.0", "architecture": "..." } }`

Success: `{ "deviceId": "server-issued-id", "deviceToken": "server-issued-device-secret" }`

Server must atomically consume a short-lived, hashed enrollment token scoped to an authorized workspace; reject reuse, expiry and unauthorized devices. Issue a unique device credential; hash it server-side and support revocation. Do not log either secret. The app encrypts the saved device token for the current Windows user using DPAPI through ConvertFrom-SecureString. Enrollment token is cleared and not saved.

## POST /api/agent/heartbeat
Authorization: Bearer deviceToken
Input: `{ "deviceId": "...", "observedAt": "UTC ISO8601", "inventory": { ... }, "capabilities": ["inventory", "heartbeat", "read-only-scan"] }`

Success: `{ "acknowledged": true }`

Server must authenticate device credential, bind to deviceId/workspace, and use its own receipt timestamp for connection freshness. Suggested stale threshold: 180 seconds, configurable. Enrollment alone is not connected status. This app reports backend reachability only after a successful HTTP response; validate acknowledgment semantics in the adapter.

## POST /api/agent/scans
Authorization: Bearer deviceToken
Input: `{ "deviceId": "...", "report": { "inventory": {...}, "scannedAt": "UTC ISO8601", "resultCode": 2, "rebootRequired": false, "source": "Windows configured update source", "updates": [{ "UpdateId": "...", "Revision": 1, "KB": "...", "Title": "...", "Severity": "Unknown", "Source": "Windows configured update source" }] } }`

Success: `{ "accepted": true }`

Validate payload sizes and schema; bind identity to authenticated device, preserve source timestamps, separate from sample and historical records. Escape imported text when rendering. Record an audit event and return errors as JSON. Do not infer compliance across products not assessed by the Windows Update source.

The original GUI agent does not process jobs. The optional `Remote-Worker.ps1` uses the remote-job endpoints below; it never accepts executable command strings.

## GET /api/agent/devices and GET /api/agent/scans (authenticated dashboard session)
Return only server-persisted live agent device and scan records. These endpoints do not include imported or demonstration records. Heartbeat freshness is based on the server receipt time; scans preserve both the agent scan timestamp and server receipt timestamp.

## POST /api/agent/devices/{deviceId}/revoke (authenticated dashboard session)
Only an authenticated Engineer may revoke a device credential. Revocation immediately prevents further heartbeat and scan submissions. The plaintext credential is never returned by read APIs.

## Remote operations v0.3 (explicit server opt-in)

All routes return 503 while `PATCHGUARD_REMOTE_JOBS` is not `1`.

- `GET /api/remote/jobs`: authenticated session; list jobs with status and device-reported results. Claim secrets are never returned.
- `POST /api/remote/jobs`: engineer session; `{deviceId, confirmHostname, kind: "install"|"restart", updates:[{id,revision}], reason, startsAt, endsAt}`. Install selections must match the latest uploaded scan (24-hour maximum age). Returns a pending job.
- `POST /api/remote/jobs/{id}/approve`: separate client_approver session with `{confirmHostname}`. Approval binds the immutable device, update list, reason, and UTC maintenance window.
- `POST /api/remote/jobs/{id}/cancel`: engineer or approver; pending/approved jobs only.
- `POST /api/remote/poll`: device Bearer credential and `{deviceId}`; returns `{job:null}` or one job with immutable parameters and a one-time claim token. Jobs are delivered once and are never automatically requeued.
- `POST /api/remote/authorize`: device Bearer credential and `{deviceId,jobId,claimToken}`; rechecks revocation, job state and window immediately before action.
- `POST /api/remote/result`: same device credential/claim plus `{status,detail}`. States: running → succeeded/failed for installation; running → restart_pending → restart_confirmed/failed for restart. Repeated final acknowledgments are idempotent.

A restart acknowledgment is not proof of a completed reboot. `restart_confirmed` requires worker observation of a changed Windows boot timestamp. Installer success requires a fresh scan for remediation verification. See `backend/DEPLOYMENT.md` for deployment and operational limits.
