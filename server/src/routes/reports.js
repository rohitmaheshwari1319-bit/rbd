import { Router } from 'express';
import { db } from '../db.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();
router.use(authRequired);

// Inventory snapshot
router.get('/inventory', (req, res) => {
  const rows = db.prepare(`
    SELECT p.id, p.sku, p.name, p.unit, c.name AS category,
           p.purchase_price, p.selling_price, p.gst_rate, p.reorder_level,
           COALESCE((SELECT SUM(quantity) FROM stock WHERE product_id = p.id),0) AS stock_qty,
           COALESCE((SELECT SUM(quantity) FROM stock WHERE product_id = p.id),0) * p.purchase_price AS stock_value
    FROM products p LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.active = 1 ORDER BY p.name
  `).all();
  res.json(rows);
});

// Warehouse-wise stock value
router.get('/warehouse', (req, res) => {
  const rows = db.prepare(`
    SELECT w.id, w.code, w.name,
           COALESCE(SUM(s.quantity),0) AS units,
           COALESCE(SUM(s.quantity * p.purchase_price),0) AS purchase_value,
           COALESCE(SUM(s.quantity * p.selling_price),0) AS selling_value
    FROM warehouses w
    LEFT JOIN stock s ON s.warehouse_id = w.id
    LEFT JOIN products p ON p.id = s.product_id
    WHERE w.active = 1 GROUP BY w.id ORDER BY w.name
  `).all();
  res.json(rows);
});

// Sales report (range)
router.get('/sales', (req, res) => {
  const { from, to } = req.query;
  const where = ['1=1'], params = [];
  if (from) { where.push('s.created_at >= ?'); params.push(from); }
  if (to) { where.push('s.created_at <= ?'); params.push(to); }
  const rows = db.prepare(`
    SELECT s.invoice_no, s.created_at, c.name AS customer, w.name AS warehouse,
           s.subtotal, s.tax, s.discount, s.total, s.paid, (s.total - s.paid) AS due,
           s.payment_mode
    FROM sales s
    LEFT JOIN customers c ON c.id = s.customer_id
    LEFT JOIN warehouses w ON w.id = s.warehouse_id
    WHERE ${where.join(' AND ')} ORDER BY s.created_at DESC
  `).all(...params);
  res.json(rows);
});

// Purchase report
router.get('/purchases', (req, res) => {
  const { from, to } = req.query;
  const where = ['1=1'], params = [];
  if (from) { where.push('p.created_at >= ?'); params.push(from); }
  if (to) { where.push('p.created_at <= ?'); params.push(to); }
  const rows = db.prepare(`
    SELECT p.reference, p.created_at, s.name AS supplier, w.name AS warehouse,
           p.subtotal, p.tax, p.total, p.paid, (p.total - p.paid) AS due
    FROM purchases p
    LEFT JOIN suppliers s ON s.id = p.supplier_id
    LEFT JOIN warehouses w ON w.id = p.warehouse_id
    WHERE ${where.join(' AND ')} ORDER BY p.created_at DESC
  `).all(...params);
  res.json(rows);
});

// Profit & loss (basic): revenue - cogs (using avg purchase price)
router.get('/profit-loss', (req, res) => {
  const { from = "date('now','-30 days')", to = "date('now')" } = req.query;
  const range = req.query.from && req.query.to ? '? AND ?' : `${from} AND ${to}`;
  const params = req.query.from && req.query.to ? [req.query.from, req.query.to] : [];

  const sales = db.prepare(`
    SELECT COALESCE(SUM(total),0) AS revenue, COALESCE(SUM(tax),0) AS tax,
           COALESCE(SUM(discount),0) AS discount
    FROM sales WHERE date(created_at) BETWEEN ${range}
  `).get(...params);

  const cogs = db.prepare(`
    SELECT COALESCE(SUM(si.quantity * p.purchase_price),0) AS cogs
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    JOIN products p ON p.id = si.product_id
    WHERE date(s.created_at) BETWEEN ${range}
  `).get(...params).cogs;

  const purchases = db.prepare(`
    SELECT COALESCE(SUM(total),0) AS total FROM purchases
    WHERE date(created_at) BETWEEN ${range}
  `).get(...params).total;

  const grossProfit = sales.revenue - sales.tax - cogs;
  res.json({
    revenue: sales.revenue,
    tax_collected: sales.tax,
    discount: sales.discount,
    cogs,
    gross_profit: grossProfit,
    margin_pct: sales.revenue ? Math.round((grossProfit / sales.revenue) * 1000) / 10 : 0,
    purchases_total: purchases
  });
});

export default router;
