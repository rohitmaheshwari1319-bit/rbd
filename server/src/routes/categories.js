import { Router } from 'express';
import { db } from '../db.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';

const router = Router();
router.use(authRequired);

router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT c.id, c.name, c.parent_id, p.name AS parent_name,
           (SELECT COUNT(*) FROM products WHERE category_id = c.id) AS product_count
    FROM categories c
    LEFT JOIN categories p ON p.id = c.parent_id
    ORDER BY c.name
  `).all();
  res.json(rows);
});

router.post('/', requireRole('admin', 'manager'), (req, res, next) => {
  try {
    const { name, parent_id } = req.body || {};
    if (!name) throw new HttpError(400, 'Name is required');
    const info = db.prepare('INSERT INTO categories (name, parent_id) VALUES (?, ?)')
      .run(name, parent_id || null);
    res.status(201).json({ id: info.lastInsertRowid, name, parent_id: parent_id || null });
  } catch (e) { next(e); }
});

router.patch('/:id', requireRole('admin', 'manager'), (req, res) => {
  const id = Number(req.params.id);
  const { name, parent_id } = req.body || {};
  const fields = [], params = [];
  if (name !== undefined) { fields.push('name = ?'); params.push(name); }
  if (parent_id !== undefined) { fields.push('parent_id = ?'); params.push(parent_id || null); }
  if (fields.length) {
    params.push(id);
    db.prepare(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  }
  res.json({ ok: true });
});

router.delete('/:id', requireRole('admin', 'manager'), (req, res) => {
  db.prepare('DELETE FROM categories WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

export default router;
