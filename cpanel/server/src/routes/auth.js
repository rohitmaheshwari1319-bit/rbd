import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { signToken, authRequired } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';

const router = Router();

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) throw new HttpError(400, 'Username and password are required');

    // Allow login with username OR email for convenience
    const user = db.prepare(
      'SELECT * FROM users WHERE username = ? OR email = ? LIMIT 1'
    ).get(username, username);
    if (!user) throw new HttpError(401, 'Invalid credentials');

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) throw new HttpError(401, 'Invalid credentials');

    db.prepare("INSERT INTO activity_log (user_id, action, entity) VALUES (?, 'login', 'auth')")
      .run(user.id);

    res.json({
      token: signToken(user),
      user: {
        id: user.id, username: user.username, name: user.name,
        email: user.email, role: user.role, package: user.package
      }
    });
  } catch (e) { next(e); }
});

router.get('/me', authRequired, (req, res) => {
  const u = db.prepare(
    'SELECT id, username, name, email, role, package, disk_quota_mb, bw_quota_gb, created_at FROM users WHERE id = ?'
  ).get(req.user.id);
  if (!u) return res.status(404).json({ error: 'User not found' });
  res.json({ user: u });
});

router.post('/change-password', authRequired, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword || newPassword.length < 6) {
      throw new HttpError(400, 'New password must be at least 6 characters');
    }
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    const ok = await bcrypt.compare(currentPassword, user.password_hash);
    if (!ok) throw new HttpError(400, 'Current password is incorrect');
    const hash = await bcrypt.hash(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);
    db.prepare("INSERT INTO activity_log (user_id, action, entity) VALUES (?, 'change_password', 'auth')")
      .run(user.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
