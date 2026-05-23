import { Router } from 'express';
import { db } from '../db.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';

const router = Router();
router.use(authRequired);

router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT w.*,
           COALESCE((SELECT SUM(s.quantity) FROM stock s WHERE s.warehouse_id = w.id), 0) AS total_units,
           COALESCE((SELECT SUM(s.quantity * p.purchase_price) FROM stock s
                     JOIN products p ON p.id = s.product_id
                     WHERE s.warehouse_id = w.id), 0) AS stock_value
    FROM warehouses w
    ORDER BY w.name
  `).all();
  res.json(rows);
});

router.post('/', requireRole('admin', 'manager'), (req, res, next) => {
  try {
    const { code, name, address, manager, phone } = req.body || {};
    if (!code || !name) throw new HttpError(400, 'Code and name are required');
    const info = db.prepare(
      'INSERT INTO warehouses (code, name, address, manager, phone) VALUES (?, ?, ?, ?, ?)'
    ).run(code, name, address || null, manager || null, phone || null);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) { next(e); }
});

router.patch('/:id', requireRole('admin', 'manager'), (req, res) => {
  const id = Number(req.params.id);
  const { name, address, manager, phone, active } = req.body || {};
  const fields = [], params = [];
  if (name !== undefined) { fields.push('name = ?'); params.push(name); }
  if (address !== undefined) { fields.push('address = ?'); params.push(address); }
  if (manager !== undefined) { fields.push('manager = ?'); params.push(manager); }
  if (phone !== undefined) { fields.push('phone = ?'); params.push(phone); }
  if (active !== undefined) { fields.push('active = ?'); params.push(active ? 1 : 0); }
  if (fields.length) {
    params.push(id);
    db.prepare(`UPDATE warehouses SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  }
  res.json({ ok: true });
});

router.delete('/:id', requireRole('admin'), (req, res) => {
  db.prepare('DELETE FROM warehouses WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

router.post('/transfer', requireRole('admin', 'manager'), (req, res, next) => {
  try {
    const { product_id, from_warehouse_id, to_warehouse_id, quantity, note } = req.body || {};
    if (!product_id || !from_warehouse_id || !to_warehouse_id || !quantity)
      throw new HttpError(400, 'product_id, from_warehouse_id, to_warehouse_id, quantity are required');
    if (from_warehouse_id === to_warehouse_id) throw new HttpError(400, 'Source and destination must differ');
    const tx = db.transaction(() => {
      const src = db.prepare('SELECT quantity FROM stock WHERE product_id = ? AND warehouse_id = ?')
        .get(product_id, from_warehouse_id);
      if (!src || src.quantity < quantity) throw new HttpError(400, 'Insufficient stock at source');
      db.prepare('UPDATE stock SET quantity = quantity - ? WHERE product_id = ? AND warehouse_id = ?')
        .run(quantity, product_id, from_warehouse_id);
      db.prepare(`INSERT INTO stock (product_id, warehouse_id, quantity) VALUES (?, ?, ?)
                  ON CONFLICT(product_id, warehouse_id) DO UPDATE SET quantity = quantity + excluded.quantity`)
        .run(product_id, to_warehouse_id, quantity);
      db.prepare(`INSERT INTO stock_movements (product_id, warehouse_id, type, quantity, ref_type, note, user_id)
                  VALUES (?, ?, 'transfer', ?, 'transfer', ?, ?)`)
        .run(product_id, from_warehouse_id, -quantity, note || 'transfer out', req.user.id);
      db.prepare(`INSERT INTO stock_movements (product_id, warehouse_id, type, quantity, ref_type, note, user_id)
                  VALUES (?, ?, 'transfer', ?, 'transfer', ?, ?)`)
        .run(product_id, to_warehouse_id, quantity, note || 'transfer in', req.user.id);
      db.prepare(`INSERT INTO notifications (type, title, body, severity)
                  VALUES ('transfer','Stock transfer recorded', ?, 'info')`)
        .run(`Moved ${quantity} units between warehouses.`);
    });
    tx();
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
