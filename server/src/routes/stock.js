import { Router } from 'express';
import { db } from '../db.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';

const router = Router();
router.use(authRequired);

// Stock matrix: products x warehouses
router.get('/matrix', (req, res) => {
  const products = db.prepare(`
    SELECT id, sku, name, reorder_level FROM products WHERE active = 1 ORDER BY name
  `).all();
  const warehouses = db.prepare('SELECT id, code, name FROM warehouses WHERE active = 1 ORDER BY name').all();
  const stock = db.prepare('SELECT product_id, warehouse_id, quantity FROM stock').all();
  const map = {};
  for (const s of stock) {
    map[s.product_id] = map[s.product_id] || {};
    map[s.product_id][s.warehouse_id] = s.quantity;
  }
  res.json({ products, warehouses, stock: map });
});

// Recent stock movements
router.get('/movements', (req, res) => {
  const { limit = 50, product_id, warehouse_id } = req.query;
  const params = [];
  let where = '1=1';
  if (product_id) { where += ' AND m.product_id = ?'; params.push(Number(product_id)); }
  if (warehouse_id) { where += ' AND m.warehouse_id = ?'; params.push(Number(warehouse_id)); }
  const rows = db.prepare(`
    SELECT m.*, p.name AS product_name, p.sku, w.name AS warehouse_name, u.name AS user_name
    FROM stock_movements m
    JOIN products p ON p.id = m.product_id
    JOIN warehouses w ON w.id = m.warehouse_id
    LEFT JOIN users u ON u.id = m.user_id
    WHERE ${where}
    ORDER BY m.created_at DESC LIMIT ?
  `).all(...params, Number(limit));
  res.json(rows);
});

// Manual adjustment (in/out/adjust)
router.post('/adjust', requireRole('admin', 'manager'), (req, res, next) => {
  try {
    const { product_id, warehouse_id, type = 'adjust', quantity, note } = req.body || {};
    if (!product_id || !warehouse_id || quantity === undefined)
      throw new HttpError(400, 'product_id, warehouse_id, quantity are required');
    if (!['in', 'out', 'adjust'].includes(type)) throw new HttpError(400, 'Invalid type');
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty === 0) throw new HttpError(400, 'Quantity must be non-zero');

    const tx = db.transaction(() => {
      const delta = type === 'out' ? -Math.abs(qty) : Math.abs(qty);
      db.prepare(`INSERT INTO stock (product_id, warehouse_id, quantity) VALUES (?, ?, ?)
                  ON CONFLICT(product_id, warehouse_id) DO UPDATE SET quantity = quantity + excluded.quantity`)
        .run(product_id, warehouse_id, delta);
      db.prepare('UPDATE stock SET quantity = MAX(0, quantity) WHERE product_id = ? AND warehouse_id = ?')
        .run(product_id, warehouse_id);
      db.prepare(`INSERT INTO stock_movements (product_id, warehouse_id, type, quantity, ref_type, note, user_id)
                  VALUES (?, ?, ?, ?, 'manual', ?, ?)`)
        .run(product_id, warehouse_id, type, delta, note || null, req.user.id);
    });
    tx();
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Scan in / out (used by camera scanner UI)
router.post('/scan', (req, res, next) => {
  try {
    const { code, warehouse_id, action = 'in', quantity = 1 } = req.body || {};
    if (!code || !warehouse_id) throw new HttpError(400, 'code and warehouse_id are required');
    const product = db.prepare('SELECT * FROM products WHERE barcode = ? OR sku = ?').get(code, code);
    if (!product) throw new HttpError(404, 'Unknown barcode');
    const delta = action === 'out' ? -Math.abs(Number(quantity)) : Math.abs(Number(quantity));
    const tx = db.transaction(() => {
      db.prepare(`INSERT INTO stock (product_id, warehouse_id, quantity) VALUES (?, ?, ?)
                  ON CONFLICT(product_id, warehouse_id) DO UPDATE SET quantity = quantity + excluded.quantity`)
        .run(product.id, warehouse_id, delta);
      db.prepare('UPDATE stock SET quantity = MAX(0, quantity) WHERE product_id = ? AND warehouse_id = ?')
        .run(product.id, warehouse_id);
      db.prepare(`INSERT INTO stock_movements (product_id, warehouse_id, type, quantity, ref_type, note, user_id)
                  VALUES (?, ?, ?, ?, 'manual', 'scan', ?)`)
        .run(product.id, warehouse_id, action === 'out' ? 'out' : 'in', delta, req.user.id);
    });
    tx();
    const stockNow = db.prepare('SELECT quantity FROM stock WHERE product_id = ? AND warehouse_id = ?')
      .get(product.id, warehouse_id);
    res.json({ ok: true, product, quantity: stockNow?.quantity ?? 0 });
  } catch (e) { next(e); }
});

export default router;
