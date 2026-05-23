import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db, migrate } from './db.js';

migrate();

const USER     = process.env.ACCOUNT_USERNAME || 'demo';
const DOMAIN   = process.env.ACCOUNT_DOMAIN   || 'example.com';
const HOME     = `/home/${USER}`;

console.log('[seed] Starting seed...');

const tx = db.transaction(() => {
  // ---- Users ---------------------------------------------------------
  const seedUser = (username, name, email, password, role, pkg) => {
    if (!db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) {
      db.prepare(`
        INSERT INTO users (username, name, email, password_hash, role, package, disk_quota_mb, bw_quota_gb)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(username, name, email, bcrypt.hashSync(password, 10), role, pkg, 50000, 1000);
      console.log(`[seed] Created user: ${username} / ${password}`);
    }
  };
  seedUser(USER,    'Demo User',     `user@cpanel.local`,  'cpanel123', 'user',  'Business Pro');
  seedUser('admin', 'Server Admin',  'admin@cpanel.local', 'admin123',  'admin', 'Unlimited');

  // ---- Virtual filesystem -------------------------------------------
  const mkdir = (p, perms = '0755') => {
    if (db.prepare('SELECT 1 FROM files WHERE path = ?').get(p)) return;
    const parent = p.split('/').slice(0, -1).join('/') || '/';
    const name = p.split('/').slice(-1)[0];
    db.prepare(`
      INSERT INTO files (path, parent_path, name, type, perms, owner)
      VALUES (?, ?, ?, 'dir', ?, ?)
    `).run(p, parent, name, perms, USER);
  };
  const writeFile = (p, content, mime = 'text/plain') => {
    if (db.prepare('SELECT 1 FROM files WHERE path = ?').get(p)) return;
    const parent = p.split('/').slice(0, -1).join('/') || '/';
    const name = p.split('/').slice(-1)[0];
    const size = Buffer.byteLength(content, 'utf8');
    db.prepare(`
      INSERT INTO files (path, parent_path, name, type, size, content, mime, owner)
      VALUES (?, ?, ?, 'file', ?, ?, ?, ?)
    `).run(p, parent, name, size, content, mime, USER);
  };

  // Build a realistic /home/<user> tree
  mkdir('/home');
  mkdir(HOME);
  mkdir(`${HOME}/public_html`, '0750');
  mkdir(`${HOME}/public_ftp`,  '0755');
  mkdir(`${HOME}/mail`,        '0700');
  mkdir(`${HOME}/etc`,         '0755');
  mkdir(`${HOME}/logs`,        '0755');
  mkdir(`${HOME}/tmp`,         '0700');
  mkdir(`${HOME}/ssl`,         '0700');
  mkdir(`${HOME}/public_html/wp-admin`);
  mkdir(`${HOME}/public_html/wp-content`);
  mkdir(`${HOME}/public_html/wp-content/themes`);
  mkdir(`${HOME}/public_html/wp-content/plugins`);
  mkdir(`${HOME}/public_html/wp-content/uploads`);

  writeFile(`${HOME}/public_html/index.html`, `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Welcome to ${DOMAIN}</title>
  </head>
  <body>
    <h1>It works!</h1>
    <p>This is the default landing page for ${DOMAIN}, served from cPanel.</p>
  </body>
</html>
`, 'text/html');

  writeFile(`${HOME}/public_html/.htaccess`, `# Apache config for ${DOMAIN}
Options -Indexes +FollowSymLinks
DirectoryIndex index.html index.php
RewriteEngine On
RewriteCond %{HTTPS} !=on
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
`, 'text/plain');

  writeFile(`${HOME}/public_html/robots.txt`, `User-agent: *
Disallow:
Sitemap: https://${DOMAIN}/sitemap.xml
`, 'text/plain');

  writeFile(`${HOME}/public_html/wp-config-sample.php`, `<?php
/**
 * The base configuration for WordPress.
 */
define('DB_NAME',     '${USER}_wp');
define('DB_USER',     '${USER}_wpuser');
define('DB_PASSWORD', 'replace-me');
define('DB_HOST',     'localhost');
define('DB_CHARSET',  'utf8mb4');
define('DB_COLLATE',  '');

$table_prefix = 'wp_';
define('WP_DEBUG', false);

if ( ! defined( 'ABSPATH' ) ) {
  define( 'ABSPATH', __DIR__ . '/' );
}
require_once ABSPATH . 'wp-settings.php';
`, 'application/x-php');

  writeFile(`${HOME}/etc/${DOMAIN}.email`, `# Per-domain email metadata for ${DOMAIN}
quota=unlimited
spam_filter=enabled
`, 'text/plain');

  writeFile(`${HOME}/logs/access.log`, `192.0.2.1 - - [${new Date().toUTCString()}] "GET / HTTP/1.1" 200 1024
192.0.2.2 - - [${new Date().toUTCString()}] "GET /favicon.ico HTTP/1.1" 200 256
192.0.2.3 - - [${new Date().toUTCString()}] "GET /robots.txt HTTP/1.1" 200 64
`, 'text/plain');

  // ---- Databases ----------------------------------------------------
  const ensureDb = (name, kb) => {
    if (db.prepare('SELECT 1 FROM databases WHERE name = ?').get(name)) return;
    db.prepare('INSERT INTO databases (name, charset, collation, size_kb) VALUES (?, ?, ?, ?)')
      .run(name, 'utf8mb4', 'utf8mb4_unicode_ci', kb);
  };
  ensureDb(`${USER}_wp`,        18432);
  ensureDb(`${USER}_blog`,       8192);
  ensureDb(`${USER}_analytics`, 32768);

  const ensureDbUser = (username, password) => {
    if (db.prepare('SELECT 1 FROM db_users WHERE username = ?').get(username)) return;
    db.prepare('INSERT INTO db_users (username, password_hash) VALUES (?, ?)')
      .run(username, bcrypt.hashSync(password, 10));
  };
  ensureDbUser(`${USER}_wpuser`,   'WPpass!2024');
  ensureDbUser(`${USER}_admin`,    'AdminPass!9');
  ensureDbUser(`${USER}_readonly`, 'ReadOnly!1');

  // Grant all privileges on a user's matching db
  const dbId = (n) => db.prepare('SELECT id FROM databases WHERE name = ?').get(n)?.id;
  const userId = (n) => db.prepare('SELECT id FROM db_users WHERE username = ?').get(n)?.id;
  const grant = (dbName, userName, privs = 'ALL PRIVILEGES') => {
    const d = dbId(dbName), u = userId(userName);
    if (d && u) {
      db.prepare('INSERT OR IGNORE INTO db_grants (database_id, db_user_id, privileges) VALUES (?, ?, ?)')
        .run(d, u, privs);
    }
  };
  grant(`${USER}_wp`,        `${USER}_wpuser`);
  grant(`${USER}_blog`,      `${USER}_admin`);
  grant(`${USER}_analytics`, `${USER}_admin`);
  grant(`${USER}_analytics`, `${USER}_readonly`, 'SELECT');

  // ---- Email accounts -----------------------------------------------
  const seedEmail = (local, quota, used) => {
    const address = `${local}@${DOMAIN}`;
    if (db.prepare('SELECT 1 FROM email_accounts WHERE address = ?').get(address)) return;
    db.prepare(`
      INSERT INTO email_accounts (address, domain, password_hash, quota_mb, used_mb)
      VALUES (?, ?, ?, ?, ?)
    `).run(address, DOMAIN, bcrypt.hashSync('MailPass!2024', 10), quota, used);
  };
  seedEmail('admin',   2048, 312);
  seedEmail('info',    1024, 87);
  seedEmail('sales',   1024, 168);
  seedEmail('support', 5120, 1247);
  seedEmail('hr',       512, 12);

  if (!db.prepare('SELECT 1 FROM email_forwarders WHERE address = ?').get(`team@${DOMAIN}`)) {
    db.prepare('INSERT INTO email_forwarders (address, forward_to) VALUES (?, ?)')
      .run(`team@${DOMAIN}`, `support@${DOMAIN}, sales@${DOMAIN}`);
    db.prepare('INSERT INTO email_forwarders (address, forward_to) VALUES (?, ?)')
      .run(`webmaster@${DOMAIN}`, `admin@${DOMAIN}`);
  }

  // ---- Domains -------------------------------------------------------
  const seedDomain = (name, type, root, redirect = null) => {
    if (db.prepare('SELECT 1 FROM domains WHERE name = ?').get(name)) return;
    db.prepare('INSERT INTO domains (name, type, document_root, redirects_to) VALUES (?, ?, ?, ?)')
      .run(name, type, root, redirect);
  };
  seedDomain(DOMAIN,            'primary',   `${HOME}/public_html`);
  seedDomain(`shop.${DOMAIN}`,  'subdomain', `${HOME}/shop`);
  seedDomain(`blog.${DOMAIN}`,  'subdomain', `${HOME}/blog`);
  seedDomain(`mail.${DOMAIN}`,  'subdomain', `${HOME}/mail-app`);
  seedDomain('mybusiness.in',   'addon',     `${HOME}/mybusiness`);
  seedDomain('mybusiness.co',   'parked',    `${HOME}/public_html`, 'mybusiness.in');

  // ---- DNS records (zone files) -------------------------------------
  const seedRec = (zone, name, type, value, opts = {}) => {
    const exists = db.prepare(
      'SELECT 1 FROM dns_records WHERE zone = ? AND name = ? AND type = ? AND value = ?'
    ).get(zone, name, type, value);
    if (exists) return;
    db.prepare(`
      INSERT INTO dns_records (zone, name, type, value, ttl, priority)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(zone, name, type, value, opts.ttl || 14400, opts.priority ?? null);
  };
  const ip = process.env.SERVER_IP || '192.0.2.10';
  // Primary domain
  seedRec(DOMAIN, '@',    'A',     ip);
  seedRec(DOMAIN, 'www',  'A',     ip);
  seedRec(DOMAIN, 'mail', 'A',     ip);
  seedRec(DOMAIN, 'shop', 'A',     ip);
  seedRec(DOMAIN, 'blog', 'A',     ip);
  seedRec(DOMAIN, '@',    'MX',    `mail.${DOMAIN}`, { priority: 10 });
  seedRec(DOMAIN, '@',    'TXT',   `v=spf1 a mx include:_spf.${DOMAIN} ~all`);
  seedRec(DOMAIN, '_dmarc','TXT',  `v=DMARC1; p=none; rua=mailto:postmaster@${DOMAIN}`);
  seedRec(DOMAIN, '@',    'NS',    `ns1.${DOMAIN}`);
  seedRec(DOMAIN, '@',    'NS',    `ns2.${DOMAIN}`);
  seedRec(DOMAIN, 'ftp',  'CNAME', `${DOMAIN}.`);
  seedRec(DOMAIN, '@',    'CAA',   `0 issue "letsencrypt.org"`);
  // Addon domain
  seedRec('mybusiness.in', '@',   'A',  ip);
  seedRec('mybusiness.in', 'www', 'A',  ip);
  seedRec('mybusiness.in', '@',   'MX', `mail.${DOMAIN}`, { priority: 10 });

  // ---- FTP accounts --------------------------------------------------
  const seedFtp = (username, dir, quota, used) => {
    if (db.prepare('SELECT 1 FROM ftp_accounts WHERE username = ?').get(username)) return;
    db.prepare(`
      INSERT INTO ftp_accounts (username, directory, quota_mb, used_mb, password_hash)
      VALUES (?, ?, ?, ?, ?)
    `).run(username, dir, quota, used, bcrypt.hashSync('FtpPass!2024', 10));
  };
  seedFtp(`${USER}@${DOMAIN}`,        HOME,                              5000, 412);
  seedFtp(`webmaster@${DOMAIN}`,      `${HOME}/public_html`,             1000,  87);
  seedFtp(`uploads@${DOMAIN}`,        `${HOME}/public_html/wp-content/uploads`, 2000, 256);

  // ---- Cron jobs -----------------------------------------------------
  const seedCron = (m, h, d, mo, w, cmd) => {
    const exists = db.prepare(
      'SELECT 1 FROM cron_jobs WHERE minute=? AND hour=? AND command=?'
    ).get(m, h, cmd);
    if (exists) return;
    db.prepare(`
      INSERT INTO cron_jobs (minute, hour, day, month, weekday, command)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(m, h, d, mo, w, cmd);
  };
  seedCron('*/5', '*',  '*', '*', '*', `/usr/bin/php ${HOME}/public_html/wp-cron.php > /dev/null 2>&1`);
  seedCron('0',   '2',  '*', '*', '*', `/usr/bin/curl -s https://${DOMAIN}/api/backup/run`);
  seedCron('30',  '3',  '*', '*', '0', `/usr/bin/php ${HOME}/scripts/weekly-report.php`);
  seedCron('0',   '*/6','*', '*', '*', `/usr/bin/wget -q -O - https://${DOMAIN}/cron/cleanup`);

  // ---- SSL certificates ---------------------------------------------
  const seedSsl = (domain, daysOut) => {
    if (db.prepare('SELECT 1 FROM ssl_certificates WHERE domain = ?').get(domain)) return;
    const expires = new Date(Date.now() + daysOut * 86400000).toISOString().slice(0, 19).replace('T', ' ');
    db.prepare(`
      INSERT INTO ssl_certificates (domain, issuer, common_name, expires_at, auto_renew, status)
      VALUES (?, 'Let''s Encrypt Authority X3', ?, ?, 1, 'valid')
    `).run(domain, domain, expires);
    db.prepare('UPDATE domains SET ssl = 1 WHERE name = ?').run(domain);
  };
  seedSsl(DOMAIN, 67);
  seedSsl(`shop.${DOMAIN}`, 67);
  seedSsl(`mail.${DOMAIN}`, 12);  // Near-expiry to demo the warning UI
  seedSsl(`blog.${DOMAIN}`, 67);

  // ---- Backups -------------------------------------------------------
  if (db.prepare('SELECT COUNT(*) AS c FROM backups').get().c === 0) {
    db.prepare("INSERT INTO backups (type, filename, size_mb, created_at) VALUES ('full', ?, ?, datetime('now','-7 days'))")
      .run(`backup-${new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)}_${USER}_full.tar.gz`, 1240);
    db.prepare("INSERT INTO backups (type, filename, size_mb, created_at) VALUES ('home', ?, ?, datetime('now','-3 days'))")
      .run(`backup-${new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10)}_${USER}_home.tar.gz`, 412);
    db.prepare("INSERT INTO backups (type, filename, size_mb, created_at) VALUES ('databases', ?, ?, datetime('now','-1 day'))")
      .run(`backup-${new Date(Date.now() - 1 * 86400000).toISOString().slice(0, 10)}_${USER}_databases.tar.gz`, 64);
  }

  // ---- Installed software --------------------------------------------
  if (db.prepare('SELECT COUNT(*) AS c FROM installed_software').get().c === 0) {
    db.prepare(`
      INSERT INTO installed_software (slug, name, version, domain, install_path, installed_at)
      VALUES ('wordpress', 'WordPress', '6.6.2', ?, '/', datetime('now','-30 days'))
    `).run(DOMAIN);
    db.prepare(`
      INSERT INTO installed_software (slug, name, version, domain, install_path, installed_at)
      VALUES ('phpmyadmin', 'phpMyAdmin', '5.2.1', ?, '/pma', datetime('now','-90 days'))
    `).run(DOMAIN);
  }

  // ---- 30 days of stats ---------------------------------------------
  if (db.prepare('SELECT COUNT(*) AS c FROM stats_daily').get().c === 0) {
    const rng = (min, max) => Math.random() * (max - min) + min;
    const insertStat = db.prepare(`
      INSERT OR REPLACE INTO stats_daily (day, bandwidth_mb, visitors, pageviews, disk_used_mb, cpu_pct, memory_pct)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    let baseDisk = 8400;
    for (let i = 29; i >= 0; i--) {
      const day = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      const visitors = Math.floor(rng(180, 740));
      const pageviews = visitors * Math.floor(rng(2.4, 4.8));
      baseDisk += rng(-25, 80);
      insertStat.run(
        day,
        Math.round(rng(380, 1700) * 10) / 10,
        visitors,
        pageviews,
        Math.round(baseDisk * 10) / 10,
        Math.round(rng(8, 42) * 10) / 10,
        Math.round(rng(35, 78) * 10) / 10
      );
    }
  }
});

tx();
console.log('[seed] Done.');
