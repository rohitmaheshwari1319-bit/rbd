import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';

const router = Router();
router.use(authRequired);

router.get('/', (req, res) => {
  res.json(db.prepare(
    'SELECT id, username, directory, quota_mb, used_mb, created_at FROM ftp_accounts ORDER BY username'
  ).all());
});

router.post('/', async (req, res, next) => {
  try {
    const { username, password, directory, quota_mb = 1000 } = req.body || {};
    if (!username || !password || !directory)
      throw new HttpError(400, 'username, password and directory are required');
    if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 chars');
    if (!/^[a-zA-Z][\w.-]{2,31}$/.test(username))
      throw new HttpError(400, 'Username must be 3-32 chars, alphanumeric / dash / dot / underscore');
    if (db.prepare('SELECT 1 FROM ftp_accounts WHERE username = ?').get(username))
      throw new HttpError(409, 'FTP user already exists');
    const hash = await bcrypt.hash(password, 10);
    const info = db.prepare(
      'INSERT INTO ftp_accounts (username, directory, quota_mb, password_hash) VALUES (?, ?, ?, ?)'
    ).run(username, directory, Number(quota_mb) || 1000, hash);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) { next(e); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const row = db.prepare('SELECT * FROM ftp_accounts WHERE id = ?').get(id);
    if (!row) throw new HttpError(404, 'Not found');
    const { quota_mb, password, directory } = req.body || {};
    const fields = [], params = [];
    if (quota_mb !== undefined) { fields.push('quota_mb = ?'); params.push(Number(quota_mb)); }
    if (directory !== undefined) { fields.push('directory = ?'); params.push(directory); }
    if (password) {
      if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 chars');
      const hash = await bcrypt.hash(password, 10);
      fields.push('password_hash = ?'); params.push(hash);
    }
    if (fields.length) {
      params.push(id);
      db.prepare(`UPDATE ftp_accounts SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM ftp_accounts WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

export default router;
