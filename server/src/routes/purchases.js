import { Router } from 'express';
import { db } from '../db.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';

const router = Router();
router.use(authRequired);

function nextRef() {
  const year = new Date().getFullYear();
  const last = db.prepare("SELECT reference FROM purchases WHERE reference LIKE ? ORDER BY id DESC LIMIT 1")
    .get(`PO-${year}-%`);
  let n = 1;
  if (last) { const m = last.reference.match(/(\d+)$/); if (m) n = Number(m[1]) + 1; }
  return `PO-${year}-${String(n).padStart(5, '0')}`;
}

router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT p.*, s.name AS supplier_name, w.name AS warehouse_name
    FROM purchases p
    LEFT JOIN suppliers s ON s.id = p.supplier_id
    LEFT JOIN warehouses w ON w.id = p.warehouse_id
    ORDER BY p.created_at DESC LIMIT 200
  `).all();
  res.json(rows);
});

router.get('/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const order = db.prepare(`
      SELECT p.*, s.name AS supplier_name, s.gstin AS supplier_gstin, s.address AS supplier_address,
             w.name AS warehouse_name
      FROM purchases p
      LEFT JOIN suppliers s ON s.id = p.supplier_id
      LEFT JOIN warehouses w ON w.id = p.warehouse_id
      WHERE p.id = ?`).get(id);
    if (!order) throw new HttpError(404, 'Purchase not found');
    const items = db.prepare(`
      SELECT pi.*, p.name AS product_name, p.sku
      FROM purchase_items pi JOIN products p ON p.id = pi.product_id
      WHERE pi.purchase_id = ?`).all(id);
    res.json({ ...order, items });
  } catch (e) { next(e); }
});

router.post('/', requireRole('admin', 'manager'), (req, res, next) => {
  try {
    const { supplier_id, warehouse_id, items = [], paid = 0, note } = req.body || {};
    if (!warehouse_id || !items.length) throw new HttpError(400, 'warehouse_id and items are required');

    let subtotal = 0, tax = 0;
    const normItems = items.map(it => {
      const q = Number(it.quantity);
      const price = Number(it.unit_price);
      const gst = Number(it.gst_rate ?? 0);
      const lineSub = q * price;
      const lineTax = lineSub * (gst / 100);
      subtotal += lineSub;
      tax += lineTax;
      return { product_id: it.product_id, quantity: q, unit_price: price, gst_rate: gst, total: lineSub + lineTax };
    });
    const total = subtotal + tax;
    const reference = nextRef();

    const tx = db.transaction(() => {
      const info = db.prepare(`INSERT INTO purchases
        (reference, supplier_id, warehouse_id, subtotal, tax, total, paid, status, note, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'received', ?, ?)`).run(
        reference, supplier_id || null, warehouse_id, subtotal, tax, total,
        Number(paid) || 0, note || null, req.user.id
      );
      const pid = info.lastInsertRowid;
      const insertItem = db.prepare(`INSERT INTO purchase_items
        (purchase_id, product_id, quantity, unit_price, gst_rate, total) VALUES (?, ?, ?, ?, ?, ?)`);
      const upStock = db.prepare(`INSERT INTO stock (product_id, warehouse_id, quantity) VALUES (?, ?, ?)
        ON CONFLICT(product_id, warehouse_id) DO UPDATE SET quantity = quantity + excluded.quantity`);
      const move = db.prepare(`INSERT INTO stock_movements
        (product_id, warehouse_id, type, quantity, ref_type, ref_id, user_id)
        VALUES (?, ?, 'in', ?, 'purchase', ?, ?)`);
      for (const it of normItems) {
        insertItem.run(pid, it.product_id, it.quantity, it.unit_price, it.gst_rate, it.total);
        upStock.run(it.product_id, warehouse_id, it.quantity);
        move.run(it.product_id, warehouse_id, it.quantity, pid, req.user.id);
      }
      return pid;
    });
    const id = tx();
    res.status(201).json({ id, reference });
  } catch (e) { next(e); }
});

router.patch('/:id/payment', requireRole('admin', 'manager'), (req, res) => {
  const id = Number(req.params.id);
  const { paid } = req.body || {};
  db.prepare('UPDATE purchases SET paid = ? WHERE id = ?').run(Number(paid) || 0, id);
  res.json({ ok: true });
});

export default router;
