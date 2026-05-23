import { Router } from 'express';
import { db } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';

const router = Router();
router.use(authRequired);

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM backups ORDER BY created_at DESC LIMIT 50').all());
});

// Generate a (simulated) backup. Filename mirrors cPanel's convention.
router.post('/', (req, res, next) => {
  try {
    const { type = 'full' } = req.body || {};
    if (!['full', 'home', 'databases', 'email'].includes(type))
      throw new HttpError(400, 'Invalid backup type');
    const ts = new Date().toISOString().slice(0, 10);
    const user = process.env.ACCOUNT_USERNAME || 'demo';
    const filename = `backup-${ts}_${user}_${type}.tar.gz`;
    // Approximate the size based on what we have
    const fileBytes = db.prepare("SELECT COALESCE(SUM(size),0) AS b FROM files").get().b;
    const dbsKb     = db.prepare('SELECT COALESCE(SUM(size_kb),0) AS k FROM databases').get().k;
    const emailMb   = db.prepare('SELECT COALESCE(SUM(used_mb),0) AS m FROM email_accounts').get().m;
    let size_mb;
    switch (type) {
      case 'home':      size_mb = Math.max(1, Math.round(fileBytes / 1048576)); break;
      case 'databases': size_mb = Math.max(1, Math.round(dbsKb / 1024)); break;
      case 'email':     size_mb = Math.max(1, Math.round(emailMb)); break;
      default:          size_mb = Math.max(1, Math.round(fileBytes / 1048576 + dbsKb / 1024 + emailMb));
    }
    const info = db.prepare(
      "INSERT INTO backups (type, filename, size_mb, status) VALUES (?, ?, ?, 'completed')"
    ).run(type, filename, size_mb);
    db.prepare(
      "INSERT INTO activity_log (user_id, action, entity, detail) VALUES (?, 'create', 'backup', ?)"
    ).run(req.user.id, filename);
    res.status(201).json({ id: info.lastInsertRowid, filename, size_mb });
  } catch (e) { next(e); }
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM backups WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

export default router;
