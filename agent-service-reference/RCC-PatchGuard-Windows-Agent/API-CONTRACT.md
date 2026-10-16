# Required backend API (not included)
All endpoints HTTPS with Authorization: Bearer <per-device-token>.

- POST /api/agent/heartbeat — {deviceId,hostname,os,version,timestamp}
- POST /api/agent/scan-results — {deviceId,updates:[{title,kbIds,updateId,requiresReboot}],scannedAt}
- GET /api/agent/commands?deviceId=... — [{id,type:"scan"|"install",approved:true,kbIds:["KB..."]}]
- POST /api/agent/command-results — {deviceId,commandId,status,message,completedAt}

Server must bind authenticated token to a single device, prevent impersonation, authorize commands, persist jobs/results, deduplicate commands, and never send a job outside the assigned device. Dashboard should talk to the backend, not directly to agents.
