// SQLite store. Single-file DB; swap this module to use MySQL/PostgreSQL.
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DATABASE_PATH
  ? path.resolve(process.cwd(), process.env.DATABASE_PATH)
  : path.resolve(__dirname, '..', 'data', 'cpanel.sqlite');

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function migrate() {
  db.exec(`
    -- Account holder login (in real cPanel this maps to a Linux user)
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT NOT NULL UNIQUE,
      name          TEXT NOT NULL,
      email         TEXT,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL CHECK(role IN ('admin','user','reseller')) DEFAULT 'user',
      package       TEXT DEFAULT 'Business Pro',
      disk_quota_mb INTEGER NOT NULL DEFAULT 50000,
      bw_quota_gb   INTEGER NOT NULL DEFAULT 1000,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Virtual filesystem (path-keyed)
    CREATE TABLE IF NOT EXISTS files (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      path          TEXT NOT NULL UNIQUE,           -- absolute, e.g. /home/demo/public_html/index.html
      parent_path   TEXT NOT NULL,                  -- e.g. /home/demo/public_html
      name          TEXT NOT NULL,
      type          TEXT NOT NULL CHECK(type IN ('file','dir')),
      size          INTEGER NOT NULL DEFAULT 0,     -- bytes
      content       TEXT,                           -- only for text files
      mime          TEXT,
      perms         TEXT DEFAULT '0644',
      owner         TEXT DEFAULT 'demo',
      modified_at   TEXT NOT NULL DEFAULT (datetime('now')),
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_files_parent ON files(parent_path);

    -- MySQL-style databases
    CREATE TABLE IF NOT EXISTS databases (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL UNIQUE,
      charset       TEXT NOT NULL DEFAULT 'utf8mb4',
      collation     TEXT NOT NULL DEFAULT 'utf8mb4_unicode_ci',
      size_kb       INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS db_users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS db_grants (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      database_id   INTEGER NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
      db_user_id    INTEGER NOT NULL REFERENCES db_users(id) ON DELETE CASCADE,
      privileges    TEXT NOT NULL DEFAULT 'ALL PRIVILEGES',
      UNIQUE(database_id, db_user_id)
    );

    -- Email accounts
    CREATE TABLE IF NOT EXISTS email_accounts (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      address       TEXT NOT NULL UNIQUE,
      domain        TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      quota_mb      INTEGER NOT NULL DEFAULT 1000,
      used_mb       INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS email_forwarders (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      address       TEXT NOT NULL,
      forward_to    TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Domains
    CREATE TABLE IF NOT EXISTS domains (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL UNIQUE,
      type          TEXT NOT NULL CHECK(type IN ('primary','addon','subdomain','parked')),
      document_root TEXT NOT NULL,
      redirects_to  TEXT,
      ssl           INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS dns_records (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      zone          TEXT NOT NULL,                  -- e.g. example.com
      name          TEXT NOT NULL,                  -- e.g. www, @, mail
      type          TEXT NOT NULL,                  -- A, AAAA, CNAME, MX, TXT, NS, SRV
      value         TEXT NOT NULL,
      ttl           INTEGER NOT NULL DEFAULT 14400,
      priority      INTEGER,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_dns_zone ON dns_records(zone);

    -- FTP accounts
    CREATE TABLE IF NOT EXISTS ftp_accounts (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT NOT NULL UNIQUE,
      directory     TEXT NOT NULL,
      quota_mb      INTEGER NOT NULL DEFAULT 1000,
      used_mb       INTEGER NOT NULL DEFAULT 0,
      password_hash TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Cron jobs (standard cron 5-field schedule)
    CREATE TABLE IF NOT EXISTS cron_jobs (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      minute        TEXT NOT NULL DEFAULT '*',
      hour          TEXT NOT NULL DEFAULT '*',
      day           TEXT NOT NULL DEFAULT '*',
      month         TEXT NOT NULL DEFAULT '*',
      weekday       TEXT NOT NULL DEFAULT '*',
      command       TEXT NOT NULL,
      enabled       INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- SSL/TLS certificates (one per domain)
    CREATE TABLE IF NOT EXISTS ssl_certificates (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      domain        TEXT NOT NULL UNIQUE,
      issuer        TEXT NOT NULL DEFAULT 'Let''s Encrypt Authority X3',
      common_name   TEXT,
      issued_at     TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at    TEXT NOT NULL,
      auto_renew    INTEGER NOT NULL DEFAULT 1,
      status        TEXT NOT NULL DEFAULT 'valid'
    );

    -- Backup history
    CREATE TABLE IF NOT EXISTS backups (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      type          TEXT NOT NULL CHECK(type IN ('full','home','databases','email')),
      filename      TEXT NOT NULL,
      size_mb       INTEGER NOT NULL,
      status        TEXT NOT NULL DEFAULT 'completed',
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Installed software (one-click installer history)
    CREATE TABLE IF NOT EXISTS installed_software (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      slug          TEXT NOT NULL,
      name          TEXT NOT NULL,
      version       TEXT NOT NULL,
      domain        TEXT NOT NULL,
      install_path  TEXT NOT NULL,
      installed_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Daily metric series for the Statistics page
    CREATE TABLE IF NOT EXISTS stats_daily (
      day           TEXT PRIMARY KEY,
      bandwidth_mb  REAL NOT NULL DEFAULT 0,
      visitors      INTEGER NOT NULL DEFAULT 0,
      pageviews     INTEGER NOT NULL DEFAULT 0,
      disk_used_mb  REAL NOT NULL DEFAULT 0,
      cpu_pct       REAL NOT NULL DEFAULT 0,
      memory_pct    REAL NOT NULL DEFAULT 0
    );

    -- Activity log
    CREATE TABLE IF NOT EXISTS activity_log (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER REFERENCES users(id),
      action        TEXT NOT NULL,
      entity        TEXT,
      detail        TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}
