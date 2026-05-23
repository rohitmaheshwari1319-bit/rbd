import { Router } from 'express';
import { db } from '../db.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();
router.use(authRequired);

// Top of dashboard summary: counts, quotas, server info.
router.get('/summary', (req, res) => {
  const user = db.prepare(
    'SELECT id, username, name, email, package, disk_quota_mb, bw_quota_gb, created_at FROM users WHERE id = ?'
  ).get(req.user.id);

  const files = db.prepare("SELECT COUNT(*) AS c FROM files WHERE type = 'file'").get().c;
  const dirs  = db.prepare("SELECT COUNT(*) AS c FROM files WHERE type = 'dir'").get().c;
  const databases = db.prepare('SELECT COUNT(*) AS c FROM databases').get().c;
  const emails    = db.prepare('SELECT COUNT(*) AS c FROM email_accounts').get().c;
  const domains   = db.prepare('SELECT COUNT(*) AS c FROM domains').get().c;
  const subdomains= db.prepare("SELECT COUNT(*) AS c FROM domains WHERE type='subdomain'").get().c;
  const ftp       = db.prepare('SELECT COUNT(*) AS c FROM ftp_accounts').get().c;
  const cron      = db.prepare('SELECT COUNT(*) AS c FROM cron_jobs').get().c;
  const ssl       = db.prepare("SELECT COUNT(*) AS c FROM ssl_certificates WHERE status='valid'").get().c;
  const apps      = db.prepare('SELECT COUNT(*) AS c FROM installed_software').get().c;

  // Disk usage from virtual files (KB rolled up)
  const disk_used_mb = (db.prepare("SELECT COALESCE(SUM(size),0) AS b FROM files WHERE type='file'").get().b) / 1048576;

  // Last day stats for headline figures
  const last = db.prepare('SELECT * FROM stats_daily ORDER BY day DESC LIMIT 1').get() || {};
  const monthBw = db.prepare(
    "SELECT COALESCE(SUM(bandwidth_mb),0) AS bw FROM stats_daily WHERE day >= date('now','-30 days')"
  ).get().bw;

  res.json({
    user,
    server: {
      hostname: process.env.HOSTNAME || 'server01.example.com',
      ip: process.env.SERVER_IP || '192.0.2.10',
      php: process.env.PHP_VERSION || '8.3',
      mysql: process.env.MYSQL_VERSION || '8.0',
      apache: process.env.APACHE_VERSION || '2.4',
      kernel: 'Linux 5.15.0',
      os: 'AlmaLinux 9'
    },
    counts: { files, dirs, databases, emails, domains, subdomains, ftp, cron, ssl, apps },
    usage: {
      disk_used_mb: Math.round(disk_used_mb * 100) / 100,
      disk_quota_mb: user?.disk_quota_mb || 0,
      bandwidth_mb_30d: Math.round(monthBw),
      bw_quota_gb: user?.bw_quota_gb || 0,
      cpu_pct: last.cpu_pct || 0,
      memory_pct: last.memory_pct || 0
    },
    last_login: db.prepare(
      "SELECT created_at FROM activity_log WHERE user_id = ? AND action='login' ORDER BY created_at DESC LIMIT 1 OFFSET 1"
    ).get(req.user.id)?.created_at || null
  });
});

// Trend series for the Statistics page
router.get('/series', (req, res) => {
  const days = Math.min(Number(req.query.days) || 30, 90);
  const rows = db.prepare(
    `SELECT day, bandwidth_mb, visitors, pageviews, disk_used_mb, cpu_pct, memory_pct
     FROM stats_daily WHERE day >= date('now', ?) ORDER BY day`
  ).all(`-${days} days`);
  res.json(rows);
});

router.get('/activity', (req, res) => {
  const rows = db.prepare(
    `SELECT a.id, a.action, a.entity, a.detail, a.created_at, u.username
     FROM activity_log a LEFT JOIN users u ON u.id = a.user_id
     ORDER BY a.created_at DESC LIMIT 100`
  ).all();
  res.json(rows);
});

export default router;
