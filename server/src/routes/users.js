import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';

const router = Router();

router.use(authRequired);

router.get('/', requireRole('admin'), (req, res) => {
  const rows = db.prepare(`
    SELECT id, name, email, role, active, created_at
    FROM users ORDER BY created_at DESC
  `).all();
  res.json(rows);
});

router.post('/', requireRole('admin'), async (req, res, next) => {
  try {
    const { name, email, password, role = 'staff' } = req.body || {};
    if (!name || !email || !password) throw new HttpError(400, 'Name, email and password are required');
    if (!['admin', 'manager', 'staff'].includes(role)) throw new HttpError(400, 'Invalid role');
    const exists = db.prepare('SELECT 1 FROM users WHERE email = ?').get(email);
    if (exists) throw new HttpError(409, 'A user with that email already exists');
    const hash = await bcrypt.hash(password, 10);
    const info = db.prepare(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
    ).run(name, email, hash, role);
    res.status(201).json({ id: info.lastInsertRowid, name, email, role, active: 1 });
  } catch (e) { next(e); }
});

router.patch('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { name, role, active, password } = req.body || {};
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) throw new HttpError(404, 'User not found');
    const fields = [];
    const params = [];
    if (name !== undefined) { fields.push('name = ?'); params.push(name); }
    if (role !== undefined) {
      if (!['admin', 'manager', 'staff'].includes(role)) throw new HttpError(400, 'Invalid role');
      fields.push('role = ?'); params.push(role);
    }
    if (active !== undefined) { fields.push('active = ?'); params.push(active ? 1 : 0); }
    if (password) {
      if (password.length < 6) throw new HttpError(400, 'Password too short');
      fields.push('password_hash = ?'); params.push(await bcrypt.hash(password, 10));
    }
    if (!fields.length) return res.json({ ok: true });
    params.push(id);
    db.prepare(`UPDATE users SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...params);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:id', requireRole('admin'), (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (id === req.user.id) throw new HttpError(400, 'You cannot delete your own account');
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.get('/activity', requireRole('admin'), (req, res) => {
  const rows = db.prepare(`
    SELECT a.id, a.action, a.entity, a.entity_id, a.created_at, u.name as user_name
    FROM activity_log a LEFT JOIN users u ON u.id = a.user_id
    ORDER BY a.created_at DESC LIMIT 200
  `).all();
  res.json(rows);
});

export default router;
