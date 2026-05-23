import { Router } from 'express';
import { db } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';

const router = Router();
router.use(authRequired);

// Update contact info (name / email)
router.put('/profile', (req, res, next) => {
  try {
    const { name, email } = req.body || {};
    const fields = [], params = [];
    if (name !== undefined) { fields.push('name = ?'); params.push(name); }
    if (email !== undefined) { fields.push('email = ?'); params.push(email); }
    if (!fields.length) return res.json({ ok: true });
    params.push(req.user.id);
    db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    db.prepare(
      "INSERT INTO activity_log (user_id, action, entity) VALUES (?, 'update_profile', 'account')"
    ).run(req.user.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.get('/branding', (_req, res) => {
  res.json({
    company: 'cPanel-Style Hosting',
    tagline: 'The control panel that does it all',
    support_url: 'https://example.com/support',
    docs_url: 'https://docs.example.com'
  });
});

export default router;
