import { Router } from 'express';
import { db } from '../db.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();
router.use(authRequired);

router.get('/summary', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);

  const productsCount = db.prepare("SELECT COUNT(*) AS c FROM products WHERE active = 1").get().c;
  const warehousesCount = db.prepare("SELECT COUNT(*) AS c FROM warehouses WHERE active = 1").get().c;
  const customersCount = db.prepare("SELECT COUNT(*) AS c FROM customers").get().c;

  const stockTotals = db.prepare(`
    SELECT COALESCE(SUM(s.quantity),0) AS total_units,
           COALESCE(SUM(s.quantity * p.purchase_price),0) AS stock_value
    FROM stock s JOIN products p ON p.id = s.product_id
  `).get();

  const todaySales = db.prepare(`
    SELECT COALESCE(SUM(total),0) AS total, COUNT(*) AS count
    FROM sales WHERE date(created_at) = date('now')
  `).get();

  const monthSales = db.prepare(`
    SELECT COALESCE(SUM(total),0) AS total, COUNT(*) AS count
    FROM sales WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m','now')
  `).get();

  const monthPurchases = db.prepare(`
    SELECT COALESCE(SUM(total),0) AS total, COUNT(*) AS count
    FROM purchases WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m','now')
  `).get();

  const pendingPayments = db.prepare(`
    SELECT COALESCE(SUM(total - paid),0) AS amount FROM sales WHERE total > paid
  `).get().amount;

  // Low-stock count
  const lowStock = db.prepare(`
    SELECT COUNT(*) AS c FROM (
      SELECT p.id FROM products p
      WHERE p.active = 1 AND
        COALESCE((SELECT SUM(quantity) FROM stock WHERE product_id = p.id),0) <= p.reorder_level
    )
  `).get().c;

  // Last 14 days sales trend
  const trend = db.prepare(`
    SELECT date(created_at) AS day, COALESCE(SUM(total),0) AS total, COUNT(*) AS count
    FROM sales
    WHERE date(created_at) >= date('now','-13 days')
    GROUP BY date(created_at) ORDER BY day
  `).all();

  // Fill missing days
  const trendMap = Object.fromEntries(trend.map(r => [r.day, r]));
  const fullTrend = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    fullTrend.push(trendMap[d] || { day: d, total: 0, count: 0 });
  }

  // Warehouse-wise stock
  const byWarehouse = db.prepare(`
    SELECT w.id, w.name, w.code,
           COALESCE(SUM(s.quantity),0) AS units,
           COALESCE(SUM(s.quantity * p.purchase_price),0) AS value
    FROM warehouses w
    LEFT JOIN stock s ON s.warehouse_id = w.id
    LEFT JOIN products p ON p.id = s.product_id
    WHERE w.active = 1
    GROUP BY w.id ORDER BY w.name
  `).all();

  // Category-wise distribution
  const byCategory = db.prepare(`
    SELECT c.name, COUNT(p.id) AS products,
           COALESCE(SUM((SELECT SUM(quantity) FROM stock WHERE product_id = p.id)), 0) AS units
    FROM categories c LEFT JOIN products p ON p.category_id = c.id AND p.active = 1
    GROUP BY c.id ORDER BY products DESC
  `).all();

  // Top selling (30d)
  const topProducts = db.prepare(`
    SELECT p.id, p.name, p.sku, SUM(si.quantity) AS qty, SUM(si.total) AS revenue
    FROM sale_items si JOIN sales s ON s.id = si.sale_id JOIN products p ON p.id = si.product_id
    WHERE s.created_at >= date('now','-30 days')
    GROUP BY p.id ORDER BY qty DESC LIMIT 8
  `).all();

  res.json({
    today,
    products: productsCount,
    warehouses: warehousesCount,
    customers: customersCount,
    units: stockTotals.total_units,
    stock_value: stockTotals.stock_value,
    sales_today: todaySales,
    sales_month: monthSales,
    purchases_month: monthPurchases,
    pending_payments: pendingPayments,
    low_stock: lowStock,
    trend: fullTrend,
    by_warehouse: byWarehouse,
    by_category: byCategory,
    top_products: topProducts
  });
});

export default router;
