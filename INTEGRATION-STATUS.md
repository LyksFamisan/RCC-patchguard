# RCC PatchGuard integration status

This package merges the uploaded dashboard and both agent implementations, and removes the Figma Make configuration directory. It is NOT a completed live deployment.

## Existing compatible path
The dashboard `src/agent-api.ts` and `RCC-Windows-Agent/RCC-Agent.ps1` use the enrollment/heartbeat/scans contract documented in `RCC-Windows-Agent/API-CONTRACT.md`. The dashboard source does not include the backend service. To use live agent connectivity, obtain/deploy the matching authenticated API backend described in that contract. The PowerShell agent is a manually launched read-only Windows application, not a Windows Service.

## Experimental Windows service reference
`agent-service-reference/RCC-PatchGuard-Windows-Agent/` contains the separate C# Windows Service source with a 2-minute heartbeat and 12-hour scan interval. Its API contract is DIFFERENT from the existing dashboard API. It is NOT wired to the dashboard and MUST NOT be installed in production or enabled for remote patch installation until the backend contract, enrollment, credential handling, approval enforcement, durable job idempotency, signed software updates, and Windows testing are completed.

## Still required
1. Implement/deploy secure backend with database, HTTPS, enrollment, authentication and audit logs.
2. Align service endpoint schemas to the existing contract, or extend the backend with authorized job endpoints.
3. Implement admin-approved patch jobs with maintenance windows and safe reboot controls.
4. Implement signed agent updates, rollback and health monitoring.
5. Compile, sign and test the Windows Service on supported Windows devices before client deployment.

No remote installation or restart capability is claimed as working in this bundle.
