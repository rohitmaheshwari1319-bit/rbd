import { Router } from 'express';
import { db } from '../db.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';

const router = Router();
router.use(authRequired);

function nextInvoice() {
  const year = new Date().getFullYear();
  const last = db.prepare("SELECT invoice_no FROM sales WHERE invoice_no LIKE ? ORDER BY id DESC LIMIT 1")
    .get(`INV-${year}-%`);
  let n = 1;
  if (last) { const m = last.invoice_no.match(/(\d+)$/); if (m) n = Number(m[1]) + 1; }
  return `INV-${year}-${String(n).padStart(5, '0')}`;
}

router.get('/', (req, res) => {
  const { from, to, customer_id } = req.query;
  const where = ['1=1'];
  const params = [];
  if (from) { where.push('s.created_at >= ?'); params.push(from); }
  if (to) { where.push('s.created_at <= ?'); params.push(to); }
  if (customer_id) { where.push('s.customer_id = ?'); params.push(Number(customer_id)); }
  const rows = db.prepare(`
    SELECT s.*, c.name AS customer_name, w.name AS warehouse_name
    FROM sales s
    LEFT JOIN customers c ON c.id = s.customer_id
    LEFT JOIN warehouses w ON w.id = s.warehouse_id
    WHERE ${where.join(' AND ')}
    ORDER BY s.created_at DESC LIMIT 500
  `).all(...params);
  res.json(rows);
});

router.get('/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const sale = db.prepare(`
      SELECT s.*, c.name AS customer_name, c.phone AS customer_phone, c.gstin AS customer_gstin,
             c.address AS customer_address, w.name AS warehouse_name
      FROM sales s
      LEFT JOIN customers c ON c.id = s.customer_id
      LEFT JOIN warehouses w ON w.id = s.warehouse_id
      WHERE s.id = ?`).get(id);
    if (!sale) throw new HttpError(404, 'Sale not found');
    const items = db.prepare(`
      SELECT si.*, p.name AS product_name, p.sku, p.hsn_code
      FROM sale_items si JOIN products p ON p.id = si.product_id
      WHERE si.sale_id = ?`).all(id);
    res.json({ ...sale, items });
  } catch (e) { next(e); }
});

router.post('/', (req, res, next) => {
  try {
    const { customer_id, warehouse_id, items = [], discount = 0, paid = 0, payment_mode = 'cash', note } = req.body || {};
    if (!warehouse_id || !items.length) throw new HttpError(400, 'warehouse_id and items are required');

    let subtotal = 0, tax = 0;
    const norm = items.map(it => {
      const q = Number(it.quantity);
      const price = Number(it.unit_price);
      const gst = Number(it.gst_rate ?? 0);
      const lineSub = q * price;
      const lineTax = lineSub * (gst / 100);
      subtotal += lineSub;
      tax += lineTax;
      return { product_id: it.product_id, quantity: q, unit_price: price, gst_rate: gst, total: lineSub + lineTax };
    });
    const total = Math.max(0, subtotal + tax - Number(discount || 0));
    const invoice_no = nextInvoice();

    const tx = db.transaction(() => {
      // Validate stock first
      for (const it of norm) {
        const row = db.prepare('SELECT quantity FROM stock WHERE product_id = ? AND warehouse_id = ?')
          .get(it.product_id, warehouse_id);
        if (!row || row.quantity < it.quantity) {
          throw new HttpError(400, `Insufficient stock for product ${it.product_id} (have ${row?.quantity || 0}, need ${it.quantity})`);
        }
      }
      const info = db.prepare(`INSERT INTO sales
        (invoice_no, customer_id, warehouse_id, subtotal, tax, discount, total, paid, status, payment_mode, note, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?)`).run(
        invoice_no, customer_id || null, warehouse_id, subtotal, tax,
        Number(discount) || 0, total, Number(paid) || 0, payment_mode, note || null, req.user.id
      );
      const sid = info.lastInsertRowid;
      const insertItem = db.prepare(`INSERT INTO sale_items
        (sale_id, product_id, quantity, unit_price, gst_rate, total) VALUES (?, ?, ?, ?, ?, ?)`);
      const reduceStock = db.prepare(`UPDATE stock SET quantity = quantity - ?
        WHERE product_id = ? AND warehouse_id = ?`);
      const move = db.prepare(`INSERT INTO stock_movements
        (product_id, warehouse_id, type, quantity, ref_type, ref_id, user_id)
        VALUES (?, ?, 'out', ?, 'sale', ?, ?)`);
      for (const it of norm) {
        insertItem.run(sid, it.product_id, it.quantity, it.unit_price, it.gst_rate, it.total);
        reduceStock.run(it.quantity, it.product_id, warehouse_id);
        move.run(it.product_id, warehouse_id, it.quantity, sid, req.user.id);
      }

      // Low stock notifications
      for (const it of norm) {
        const totalStock = db.prepare('SELECT COALESCE(SUM(quantity), 0) AS q FROM stock WHERE product_id = ?')
          .get(it.product_id).q;
        const product = db.prepare('SELECT name, reorder_level FROM products WHERE id = ?').get(it.product_id);
        if (product && totalStock <= product.reorder_level) {
          db.prepare(`INSERT INTO notifications (type, title, body, severity)
                      VALUES ('low_stock', 'Low stock alert', ?, 'warning')`)
            .run(`${product.name} is at ${totalStock} units (reorder level: ${product.reorder_level}).`);
        }
      }

      return { sid, invoice_no };
    });
    const result = tx();
    res.status(201).json({ id: result.sid, invoice_no: result.invoice_no, total });
  } catch (e) { next(e); }
});

router.patch('/:id/payment', requireRole('admin', 'manager'), (req, res) => {
  const id = Number(req.params.id);
  const { paid } = req.body || {};
  db.prepare('UPDATE sales SET paid = ? WHERE id = ?').run(Number(paid) || 0, id);
  res.json({ ok: true });
});

router.delete('/:id', requireRole('admin'), (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const tx = db.transaction(() => {
      const items = db.prepare('SELECT product_id, quantity FROM sale_items WHERE sale_id = ?').all(id);
      const sale = db.prepare('SELECT warehouse_id FROM sales WHERE id = ?').get(id);
      if (!sale) throw new HttpError(404, 'Sale not found');
      for (const it of items) {
        db.prepare(`INSERT INTO stock (product_id, warehouse_id, quantity) VALUES (?, ?, ?)
          ON CONFLICT(product_id, warehouse_id) DO UPDATE SET quantity = quantity + excluded.quantity`)
          .run(it.product_id, sale.warehouse_id, it.quantity);
      }
      db.prepare('DELETE FROM sales WHERE id = ?').run(id);
    });
    tx();
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
