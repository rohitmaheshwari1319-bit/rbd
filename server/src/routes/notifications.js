import { Router } from 'express';
import { db } from '../db.js';
import { authRequired, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authRequired);

router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM notifications ORDER BY created_at DESC LIMIT 100
  `).all();
  res.json(rows);
});

router.get('/unread-count', (req, res) => {
  const c = db.prepare('SELECT COUNT(*) AS c FROM notifications WHERE read = 0').get().c;
  res.json({ count: c });
});

router.post('/:id/read', (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

router.post('/read-all', (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE read = 0').run();
  res.json({ ok: true });
});

router.delete('/:id', requireRole('admin', 'manager'), (req, res) => {
  db.prepare('DELETE FROM notifications WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// Re-scan and produce alerts (low stock, pending payments, sales target)
router.post('/scan', requireRole('admin', 'manager'), (req, res) => {
  const inserts = [];
  const lows = db.prepare(`
    SELECT p.name, p.reorder_level,
           COALESCE((SELECT SUM(quantity) FROM stock WHERE product_id = p.id),0) AS qty
    FROM products p WHERE p.active = 1
    AND COALESCE((SELECT SUM(quantity) FROM stock WHERE product_id = p.id),0) <= p.reorder_level
  `).all();
  for (const l of lows) {
    inserts.push({
      type: 'low_stock', severity: 'warning',
      title: `Low stock: ${l.name}`,
      body: `Only ${l.qty} units remaining (reorder level ${l.reorder_level}).`
    });
  }
  const overdue = db.prepare(`
    SELECT s.invoice_no, c.name, (s.total - s.paid) AS due
    FROM sales s LEFT JOIN customers c ON c.id = s.customer_id
    WHERE s.total > s.paid AND s.created_at < date('now','-7 days')
    ORDER BY s.created_at ASC LIMIT 20
  `).all();
  for (const o of overdue) {
    inserts.push({
      type: 'pending_payment', severity: 'warning',
      title: `Pending payment: ${o.invoice_no}`,
      body: `${o.name || 'Walk-in'} owes ₹${Math.round(o.due).toLocaleString('en-IN')}.`
    });
  }

  const stmt = db.prepare(
    'INSERT INTO notifications (type, title, body, severity) VALUES (?, ?, ?, ?)'
  );
  const tx = db.transaction(() => { for (const n of inserts) stmt.run(n.type, n.title, n.body, n.severity); });
  tx();
  res.json({ created: inserts.length });
});

export default router;
