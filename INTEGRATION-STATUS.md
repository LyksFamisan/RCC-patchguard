# RCC PatchGuard integration status

The dashboard, persistent Python backend, and original scanning GUI agent are included. Optional remote installation/restart support is implemented by `backend/remote_jobs.py`, `src/RemoteOperations.tsx`, and `RCC-Windows-Agent/Remote-Worker.ps1`.

Remote jobs are disabled by default and require a separate authenticated approver, an enrolled device, a maintenance window, and an elevated worker. See `backend/DEPLOYMENT.md`.

This repository change does not provision hosting or activate the public Vercel API. Backend HTTP integration tests run on Linux; actual Windows installation/restart and Docker hosting still require a pilot. The C# service reference remains separate and must not be confused with the supported console worker.
