import { Router } from 'express';
import { db } from '../db.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';

const router = Router();
router.use(authRequired);

router.get('/', (req, res) => {
  const { q = '' } = req.query;
  const params = [];
  let where = '1=1';
  if (q) {
    where = '(name LIKE ? OR phone LIKE ? OR email LIKE ?)';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  const rows = db.prepare(`
    SELECT c.*,
           COALESCE((SELECT SUM(total) FROM sales WHERE customer_id = c.id), 0) AS total_sales,
           COALESCE((SELECT SUM(total - paid) FROM sales WHERE customer_id = c.id), 0) AS pending
    FROM customers c WHERE ${where} ORDER BY c.name
  `).all(...params);
  res.json(rows);
});

router.post('/', requireRole('admin', 'manager', 'staff'), (req, res, next) => {
  try {
    const { name, phone, email, gstin, address } = req.body || {};
    if (!name) throw new HttpError(400, 'Name is required');
    const info = db.prepare('INSERT INTO customers (name, phone, email, gstin, address) VALUES (?, ?, ?, ?, ?)')
      .run(name, phone || null, email || null, gstin || null, address || null);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) { next(e); }
});

router.patch('/:id', requireRole('admin', 'manager'), (req, res) => {
  const id = Number(req.params.id);
  const fields = [], params = [];
  for (const k of ['name', 'phone', 'email', 'gstin', 'address']) {
    if (req.body[k] !== undefined) { fields.push(`${k} = ?`); params.push(req.body[k]); }
  }
  if (fields.length) {
    params.push(id);
    db.prepare(`UPDATE customers SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  }
  res.json({ ok: true });
});

router.delete('/:id', requireRole('admin', 'manager'), (req, res) => {
  db.prepare('DELETE FROM customers WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

export default router;
