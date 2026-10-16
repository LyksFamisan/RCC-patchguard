# RCC PatchGuard Windows Agent — starter implementation

This is source code for a Windows .NET 8 Worker Service, **not** a compiled or end-to-end validated production agent. It provides a 2-minute heartbeat and command polling, a 12-hour missing-update scan, and approved KB installation via Windows Update Agent COM. It does not provide agent self-update, restart orchestration, durable command idempotency, or a backend server.

## Requirements
- Windows 10/11 or supported Windows Server, .NET 8 SDK to build, Windows Update services and policy configured.
- HTTPS backend implementing the endpoints in `API-CONTRACT.md`.
- A unique, revocable credential **per device** (never a single shared global token).
- Install as an authorized administrator, preferably test in a VM first.

## Build on Windows PowerShell
```powershell
dotnet restore .\src\RCCPatchGuard.Agent.csproj
dotnet publish .\src\RCCPatchGuard.Agent.csproj -c Release -r win-x64 --self-contained true -o .\publish
```

## Configure (elevated PowerShell)
```powershell
[Environment]::SetEnvironmentVariable('RCC_API_URL','https://YOUR-BACKEND.example.com','Machine')
[Environment]::SetEnvironmentVariable('RCC_AGENT_TOKEN','UNIQUE_DEVICE_TOKEN','Machine')
New-Service -Name 'RCCPatchGuardAgent' -BinaryPathName 'C:\RCCPatchGuard\RCCPatchGuard.Agent.exe' -DisplayName 'RCC PatchGuard Agent' -StartupType Automatic
Start-Service RCCPatchGuardAgent
```
Copy the contents of `publish` into `C:\RCCPatchGuard` before creating the service. Protect token and service files with restrictive ACLs. Restart the service after changing environment variables.

## Production hardening needed
1. Backend with persistent database, authentication, RBAC, audit trail, approval workflows, command leases and signed command IDs.
2. Durable on-disk command state so repeated delivery cannot repeat patch installation after reboot.
3. Per-device certificate/mTLS or equivalent secure identity, enrollment, rotation and revocation.
4. Explicit patch maintenance windows, staged rollout, Windows Update policy compatibility, reboot handling, and rollback/recovery plan.
5. Signed installers, verified signed self-update packages and safe atomic upgrades.
6. Handle COM apartment threading and WUA error codes, add retry/backoff, detailed per-update results, rate limits, and security review.
7. No arbitrary shell/PowerShell execution endpoints; only allowlisted commands.

**Important:** The `approved` field alone is NOT proof of authorization. The backend must enforce admin RBAC and sign or authenticate job delivery. Never expose the backend endpoint without robust authorization.
