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

No installation/job/restart endpoints are supported by this release. Do not send executable commands to it.

## GET /api/agent/devices and GET /api/agent/scans (authenticated dashboard session)
Return only server-persisted live agent device and scan records. These endpoints do not include imported or demonstration records. Heartbeat freshness is based on the server receipt time; scans preserve both the agent scan timestamp and server receipt timestamp.

## POST /api/agent/devices/{deviceId}/revoke (authenticated dashboard session)
Only an authenticated Engineer may revoke a device credential. Revocation immediately prevents further heartbeat and scan submissions. The plaintext credential is never returned by read APIs.
