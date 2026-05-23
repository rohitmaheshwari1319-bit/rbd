import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';

const router = Router();
router.use(authRequired);

router.get('/', (req, res) => {
  res.json(db.prepare(`
    SELECT id, address, domain, quota_mb, used_mb, created_at
    FROM email_accounts ORDER BY address
  `).all());
});

router.post('/', async (req, res, next) => {
  try {
    const { local, domain, password, quota_mb = 1000 } = req.body || {};
    if (!local || !domain || !password) throw new HttpError(400, 'local, domain and password are required');
    if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters');
    if (!/^[a-zA-Z0-9._+-]+$/.test(local)) throw new HttpError(400, 'Invalid characters in mailbox name');
    const address = `${local}@${domain}`;
    if (db.prepare('SELECT 1 FROM email_accounts WHERE address = ?').get(address))
      throw new HttpError(409, 'That email address already exists');
    const hash = await bcrypt.hash(password, 10);
    const info = db.prepare(
      'INSERT INTO email_accounts (address, domain, password_hash, quota_mb) VALUES (?, ?, ?, ?)'
    ).run(address, domain, hash, Number(quota_mb) || 1000);
    db.prepare(
      "INSERT INTO activity_log (user_id, action, entity, detail) VALUES (?, 'create', 'email', ?)"
    ).run(req.user.id, address);
    res.status(201).json({ id: info.lastInsertRowid, address });
  } catch (e) { next(e); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const row = db.prepare('SELECT * FROM email_accounts WHERE id = ?').get(Number(req.params.id));
    if (!row) throw new HttpError(404, 'Not found');
    const { quota_mb, password } = req.body || {};
    if (quota_mb !== undefined) {
      db.prepare('UPDATE email_accounts SET quota_mb = ? WHERE id = ?').run(Number(quota_mb), row.id);
    }
    if (password) {
      if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters');
      const hash = await bcrypt.hash(password, 10);
      db.prepare('UPDATE email_accounts SET password_hash = ? WHERE id = ?').run(hash, row.id);
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:id', (req, res, next) => {
  try {
    const row = db.prepare('SELECT * FROM email_accounts WHERE id = ?').get(Number(req.params.id));
    if (!row) throw new HttpError(404, 'Not found');
    db.prepare('DELETE FROM email_accounts WHERE id = ?').run(row.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Forwarders
router.get('/forwarders', (req, res) => {
  res.json(db.prepare('SELECT * FROM email_forwarders ORDER BY address').all());
});

router.post('/forwarders', (req, res, next) => {
  try {
    const { address, forward_to } = req.body || {};
    if (!address || !forward_to) throw new HttpError(400, 'address and forward_to are required');
    const info = db.prepare(
      'INSERT INTO email_forwarders (address, forward_to) VALUES (?, ?)'
    ).run(address, forward_to);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) { next(e); }
});

router.delete('/forwarders/:id', (req, res) => {
  db.prepare('DELETE FROM email_forwarders WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

export default router;
