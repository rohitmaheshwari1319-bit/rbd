import { Router } from 'express';
import { db } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';

const router = Router();
router.use(authRequired);

router.get('/', (req, res) => {
  // Compute days_remaining on read
  const rows = db.prepare(`
    SELECT *, CAST(julianday(expires_at) - julianday('now') AS INTEGER) AS days_remaining
    FROM ssl_certificates ORDER BY expires_at
  `).all();
  res.json(rows);
});

// Provision (mock) a cert via Let's Encrypt
router.post('/provision', (req, res, next) => {
  try {
    const { domain, auto_renew = 1 } = req.body || {};
    if (!domain) throw new HttpError(400, 'domain is required');
    const exists = db.prepare(
      "SELECT 1 FROM domains WHERE name = ? OR ('*.' || name) = ? OR name = REPLACE(?, '*.', '')"
    ).get(domain, domain, domain);
    if (!exists) throw new HttpError(404, 'Domain not found in this account');
    const expires = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 19).replace('T', ' ');
    db.prepare(`
      INSERT INTO ssl_certificates (domain, issuer, common_name, expires_at, auto_renew, status)
      VALUES (?, 'Let''s Encrypt Authority X3', ?, ?, ?, 'valid')
      ON CONFLICT(domain) DO UPDATE SET
        issuer = excluded.issuer, common_name = excluded.common_name,
        expires_at = excluded.expires_at, auto_renew = excluded.auto_renew,
        status = 'valid', issued_at = datetime('now')
    `).run(domain, domain, expires, auto_renew ? 1 : 0);
    db.prepare('UPDATE domains SET ssl = 1 WHERE name = ?').run(domain);
    db.prepare(
      "INSERT INTO activity_log (user_id, action, entity, detail) VALUES (?, 'provision', 'ssl', ?)"
    ).run(req.user.id, domain);
    res.json({ ok: true, expires_at: expires });
  } catch (e) { next(e); }
});

router.post('/:id/renew', (req, res, next) => {
  try {
    const row = db.prepare('SELECT * FROM ssl_certificates WHERE id = ?').get(Number(req.params.id));
    if (!row) throw new HttpError(404, 'Certificate not found');
    const expires = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 19).replace('T', ' ');
    db.prepare(`
      UPDATE ssl_certificates SET issued_at = datetime('now'), expires_at = ?, status = 'valid'
      WHERE id = ?
    `).run(expires, row.id);
    res.json({ ok: true, expires_at: expires });
  } catch (e) { next(e); }
});

router.delete('/:id', (req, res, next) => {
  try {
    const row = db.prepare('SELECT * FROM ssl_certificates WHERE id = ?').get(Number(req.params.id));
    if (!row) throw new HttpError(404, 'Not found');
    db.prepare('DELETE FROM ssl_certificates WHERE id = ?').run(row.id);
    db.prepare('UPDATE domains SET ssl = 0 WHERE name = ?').run(row.domain);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
