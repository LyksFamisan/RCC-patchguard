CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,role TEXT NOT NULL,salt TEXT NOT NULL,password_hash TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS enrollments(token_hash TEXT PRIMARY KEY,hostname TEXT NOT NULL,expires TEXT NOT NULL,used INTEGER DEFAULT 0);
  CREATE TABLE IF NOT EXISTS devices(id TEXT PRIMARY KEY,hostname TEXT NOT NULL,os_name TEXT,os_version TEXT,os_build TEXT,architecture TEXT,agent_version TEXT,enrollment_status TEXT DEFAULT 'active',restart_status TEXT DEFAULT 'unknown',last_heartbeat_at TEXT,last_scan_at TEXT,created_at TEXT NOT NULL,token_hash TEXT UNIQUE NOT NULL);
  CREATE TABLE IF NOT EXISTS scans(id TEXT PRIMARY KEY,asset_id TEXT NOT NULL,hostname TEXT,provider TEXT,started_at TEXT,completed_at TEXT,received_at TEXT,status TEXT,updates TEXT NOT NULL,FOREIGN KEY(asset_id) REFERENCES devices(id));
  CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY,event TEXT NOT NULL,subject TEXT,at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS remote_jobs (
 id TEXT PRIMARY KEY, device_id TEXT NOT NULL REFERENCES devices(id),
 kind TEXT NOT NULL, updates TEXT NOT NULL, reason TEXT NOT NULL,
 starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, status TEXT NOT NULL,
 requested_by TEXT NOT NULL, approved_by TEXT, created_at TEXT NOT NULL,
 claimed_at TEXT, claim_hash TEXT, result TEXT
);
