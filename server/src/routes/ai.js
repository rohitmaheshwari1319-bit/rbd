// Lightweight AI: rule-based + statistical forecasting (no external ML deps).
// Methods used:
//  - Demand forecasting: weighted moving-average of daily sales over last 30 days.
//  - Reorder advisor: lead-time aware safety-stock suggestion.
//  - Fast/slow movers: 30d sales velocity vs population average.
//  - Duplicate detection: token-based Jaccard similarity on product names.
//  - Smart warehouse allocation: recent demand-share per warehouse.
//  - Inventory chatbot: routes natural-language queries to live SQL.

import { Router } from 'express';
import { db } from '../db.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();
router.use(authRequired);

// ---------- helpers ----------
function tokenize(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
}
function jaccard(a, b) {
  const sa = new Set(a), sb = new Set(b);
  const inter = [...sa].filter(x => sb.has(x)).length;
  const uni = new Set([...sa, ...sb]).size;
  return uni === 0 ? 0 : inter / uni;
}
function dailySalesByProduct(productId, days = 30) {
  const rows = db.prepare(`
    SELECT date(s.created_at) AS day, SUM(si.quantity) AS qty
    FROM sale_items si JOIN sales s ON s.id = si.sale_id
    WHERE si.product_id = ? AND s.created_at >= date('now', ?)
    GROUP BY date(s.created_at) ORDER BY day
  `).all(productId, `-${days} days`);
  const map = Object.fromEntries(rows.map(r => [r.day, r.qty]));
  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    series.push({ day: d, qty: map[d] || 0 });
  }
  return series;
}

// ---------- 1. Demand forecasting ----------
router.get('/forecast/:productId', (req, res) => {
  const id = Number(req.params.productId);
  const product = db.prepare('SELECT id, name, reorder_level FROM products WHERE id = ?').get(id);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const series = dailySalesByProduct(id, 30);
  // Weighted moving average (recent days weigh more)
  const weights = series.map((_, i) => i + 1);
  const wSum = weights.reduce((a, b) => a + b, 0);
  const dailyAvg = series.reduce((acc, d, i) => acc + d.qty * weights[i], 0) / wSum;
  // Simple linear trend
  const n = series.length;
  const xMean = (n - 1) / 2;
  const yMean = series.reduce((a, b) => a + b.qty, 0) / n;
  let num = 0, den = 0;
  series.forEach((d, i) => { num += (i - xMean) * (d.qty - yMean); den += (i - xMean) ** 2; });
  const slope = den ? num / den : 0;
  const intercept = yMean - slope * xMean;

  const forecast = [];
  for (let i = 1; i <= 14; i++) {
    const projected = Math.max(0, intercept + slope * (n - 1 + i));
    const blended = 0.6 * dailyAvg + 0.4 * projected;
    forecast.push({
      day: new Date(Date.now() + i * 86400000).toISOString().slice(0, 10),
      qty: Math.round(blended * 100) / 100
    });
  }

  const stockNow = db.prepare(
    'SELECT COALESCE(SUM(quantity),0) AS q FROM stock WHERE product_id = ?'
  ).get(id).q;
  const expected14 = forecast.reduce((a, b) => a + b.qty, 0);
  const daysOfCover = dailyAvg > 0 ? Math.floor(stockNow / dailyAvg) : 999;

  res.json({
    product,
    history: series,
    forecast,
    daily_average: Math.round(dailyAvg * 100) / 100,
    trend_slope: Math.round(slope * 1000) / 1000,
    expected_14_day_demand: Math.round(expected14),
    stock_now: stockNow,
    days_of_cover: daysOfCover
  });
});

// ---------- 2. Reorder advisor ----------
router.get('/reorder-suggestions', (req, res) => {
  const leadTimeDays = Number(req.query.lead_days || 7);
  const products = db.prepare('SELECT id, name, sku, reorder_level FROM products WHERE active = 1').all();
  const suggestions = [];
  for (const p of products) {
    const series = dailySalesByProduct(p.id, 30);
    const avg = series.reduce((a, b) => a + b.qty, 0) / series.length;
    const stockNow = db.prepare(
      'SELECT COALESCE(SUM(quantity),0) AS q FROM stock WHERE product_id = ?'
    ).get(p.id).q;
    const expectedDuringLead = avg * leadTimeDays;
    const safetyStock = Math.ceil(avg * 3);
    const reorderQty = Math.max(0, Math.ceil(expectedDuringLead + safetyStock - stockNow));
    if (reorderQty > 0) {
      suggestions.push({
        product_id: p.id, name: p.name, sku: p.sku,
        stock_now: stockNow,
        daily_average: Math.round(avg * 100) / 100,
        suggested_qty: reorderQty,
        reason: stockNow <= p.reorder_level ? 'below_reorder_level' : 'projected_shortfall'
      });
    }
  }
  suggestions.sort((a, b) => b.suggested_qty - a.suggested_qty);
  res.json(suggestions);
});

// ---------- 3. Fast / slow movers ----------
router.get('/movers', (req, res) => {
  const rows = db.prepare(`
    SELECT p.id, p.name, p.sku,
           COALESCE(SUM(si.quantity),0) AS qty,
           COALESCE(SUM(si.total),0) AS revenue
    FROM products p
    LEFT JOIN sale_items si ON si.product_id = p.id
    LEFT JOIN sales s ON s.id = si.sale_id AND s.created_at >= date('now','-30 days')
    WHERE p.active = 1
    GROUP BY p.id
  `).all();
  const totalQty = rows.reduce((a, b) => a + b.qty, 0);
  const avgQty = rows.length ? totalQty / rows.length : 0;
  const fast = [...rows].sort((a, b) => b.qty - a.qty).slice(0, 10);
  const slow = [...rows].filter(r => r.qty <= avgQty * 0.4).sort((a, b) => a.qty - b.qty).slice(0, 10);
  res.json({ fast, slow, average_qty: Math.round(avgQty * 100) / 100 });
});

// ---------- 4. Duplicate detection ----------
router.get('/duplicates', (req, res) => {
  const products = db.prepare('SELECT id, name, sku FROM products WHERE active = 1').all();
  const tokens = products.map(p => ({ ...p, t: tokenize(p.name) }));
  const pairs = [];
  for (let i = 0; i < tokens.length; i++) {
    for (let j = i + 1; j < tokens.length; j++) {
      const score = jaccard(tokens[i].t, tokens[j].t);
      if (score >= 0.6) {
        pairs.push({
          a: { id: tokens[i].id, name: tokens[i].name, sku: tokens[i].sku },
          b: { id: tokens[j].id, name: tokens[j].name, sku: tokens[j].sku },
          similarity: Math.round(score * 100) / 100
        });
      }
    }
  }
  pairs.sort((a, b) => b.similarity - a.similarity);
  res.json(pairs.slice(0, 50));
});

// ---------- 5. Smart warehouse allocation ----------
router.get('/warehouse-allocation/:productId', (req, res) => {
  const id = Number(req.params.productId);
  const breakdown = db.prepare(`
    SELECT w.id, w.name, COALESCE(SUM(si.quantity),0) AS sold_30d
    FROM warehouses w
    LEFT JOIN sales s ON s.warehouse_id = w.id AND s.created_at >= date('now','-30 days')
    LEFT JOIN sale_items si ON si.sale_id = s.id AND si.product_id = ?
    WHERE w.active = 1 GROUP BY w.id
  `).all(id);
  const total = breakdown.reduce((a, b) => a + b.sold_30d, 0);
  const recommendations = breakdown.map(w => ({
    warehouse_id: w.id, warehouse_name: w.name, sold_30d: w.sold_30d,
    share_pct: total ? Math.round((w.sold_30d / total) * 100) : Math.round(100 / breakdown.length)
  }));
  res.json({ recommendations, total_30d_demand: total });
});

// ---------- 6. Sales growth report ----------
router.get('/sales-growth', (req, res) => {
  const cur = db.prepare(`
    SELECT COALESCE(SUM(total),0) AS total
    FROM sales WHERE created_at >= date('now','-30 days')`).get().total;
  const prev = db.prepare(`
    SELECT COALESCE(SUM(total),0) AS total
    FROM sales WHERE created_at >= date('now','-60 days') AND created_at < date('now','-30 days')`).get().total;
  const growth = prev ? Math.round(((cur - prev) / prev) * 1000) / 10 : 0;
  res.json({ current_30d: cur, previous_30d: prev, growth_pct: growth });
});

// ---------- 7. Insights bundle (used by dashboard) ----------
router.get('/insights', (req, res) => {
  const insights = [];
  const lowStockCount = db.prepare(`
    SELECT COUNT(*) AS c FROM products p WHERE p.active = 1
    AND COALESCE((SELECT SUM(quantity) FROM stock WHERE product_id = p.id),0) <= p.reorder_level
  `).get().c;
  if (lowStockCount > 0) {
    insights.push({
      severity: 'warning',
      title: `${lowStockCount} product${lowStockCount > 1 ? 's' : ''} below reorder level`,
      body: 'Open the AI Reorder Advisor to generate purchase suggestions.'
    });
  }

  const pending = db.prepare(`SELECT COALESCE(SUM(total - paid),0) AS amt FROM sales WHERE total > paid`).get().amt;
  if (pending > 0) {
    insights.push({
      severity: 'info',
      title: `Pending receivables: ₹${Math.round(pending).toLocaleString('en-IN')}`,
      body: 'Review the Sales page to follow up on unpaid invoices.'
    });
  }

  const growth = db.prepare(`
    SELECT
      COALESCE((SELECT SUM(total) FROM sales WHERE created_at >= date('now','-30 days')), 0) AS cur,
      COALESCE((SELECT SUM(total) FROM sales WHERE created_at >= date('now','-60 days')
                AND created_at < date('now','-30 days')), 0) AS prev
  `).get();
  if (growth.prev > 0) {
    const pct = ((growth.cur - growth.prev) / growth.prev) * 100;
    insights.push({
      severity: pct >= 0 ? 'success' : 'warning',
      title: `Sales ${pct >= 0 ? 'up' : 'down'} ${Math.abs(pct).toFixed(1)}% MoM`,
      body: `Last 30 days: ₹${Math.round(growth.cur).toLocaleString('en-IN')} vs prior 30 days: ₹${Math.round(growth.prev).toLocaleString('en-IN')}.`
    });
  }

  const dupCount = (() => {
    const products = db.prepare('SELECT id, name FROM products WHERE active = 1').all();
    const tokens = products.map(p => ({ id: p.id, t: tokenize(p.name) }));
    let c = 0;
    for (let i = 0; i < tokens.length; i++)
      for (let j = i + 1; j < tokens.length; j++)
        if (jaccard(tokens[i].t, tokens[j].t) >= 0.7) c++;
    return c;
  })();
  if (dupCount > 0) {
    insights.push({
      severity: 'info',
      title: `${dupCount} possible duplicate product${dupCount > 1 ? 's' : ''} detected`,
      body: 'Visit the Duplicate Detector under AI tools.'
    });
  }
  res.json(insights);
});

// ---------- 8. Chatbot (rule-based, runs against live DB) ----------
router.post('/chat', (req, res) => {
  const q = String(req.body?.message || '').toLowerCase().trim();
  if (!q) return res.json({ reply: 'Ask me about stock, sales, top products, low-stock or revenue.' });

  // Today's sales
  if (/today.*(sale|revenue)|sales today/.test(q)) {
    const r = db.prepare(`SELECT COALESCE(SUM(total),0) AS t, COUNT(*) AS c FROM sales WHERE date(created_at) = date('now')`).get();
    return res.json({ reply: `Today: ${r.c} sale(s), revenue ₹${Math.round(r.t).toLocaleString('en-IN')}.` });
  }
  // Low stock
  if (/low stock|reorder/.test(q)) {
    const rows = db.prepare(`
      SELECT p.name, p.reorder_level,
             COALESCE((SELECT SUM(quantity) FROM stock WHERE product_id = p.id),0) AS qty
      FROM products p WHERE p.active = 1
      AND COALESCE((SELECT SUM(quantity) FROM stock WHERE product_id = p.id),0) <= p.reorder_level
      ORDER BY qty ASC LIMIT 5`).all();
    if (!rows.length) return res.json({ reply: 'No products are below their reorder level right now.' });
    return res.json({
      reply: 'Low-stock items:\n' + rows.map(r => `• ${r.name} — ${r.qty}/${r.reorder_level}`).join('\n')
    });
  }
  // Top products
  if (/top|best.*sell|fast.*mov/.test(q)) {
    const rows = db.prepare(`
      SELECT p.name, SUM(si.quantity) AS qty
      FROM sale_items si JOIN sales s ON s.id = si.sale_id JOIN products p ON p.id = si.product_id
      WHERE s.created_at >= date('now','-30 days')
      GROUP BY p.id ORDER BY qty DESC LIMIT 5`).all();
    if (!rows.length) return res.json({ reply: 'No sales recorded in the last 30 days.' });
    return res.json({
      reply: 'Top sellers (30d):\n' + rows.map((r, i) => `${i + 1}. ${r.name} — ${r.qty}`).join('\n')
    });
  }
  // Stock of <name>
  const stockMatch = q.match(/stock (?:of|for)?\s*(.+)/);
  if (stockMatch) {
    const term = stockMatch[1].trim();
    const rows = db.prepare(`
      SELECT p.name,
             COALESCE((SELECT SUM(quantity) FROM stock WHERE product_id = p.id),0) AS qty
      FROM products p WHERE p.active = 1 AND p.name LIKE ? LIMIT 5`).all(`%${term}%`);
    if (!rows.length) return res.json({ reply: `No products found matching "${term}".` });
    return res.json({
      reply: rows.map(r => `${r.name}: ${r.qty} units in stock`).join('\n')
    });
  }
  // Revenue this month
  if (/revenue|month.*sale|sales this month/.test(q)) {
    const r = db.prepare(`
      SELECT COALESCE(SUM(total),0) AS t FROM sales
      WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m','now')`).get();
    return res.json({ reply: `Revenue this month: ₹${Math.round(r.t).toLocaleString('en-IN')}.` });
  }
  // Pending
  if (/pending|due|outstand/.test(q)) {
    const r = db.prepare(`SELECT COALESCE(SUM(total - paid),0) AS amt FROM sales WHERE total > paid`).get();
    return res.json({ reply: `Total pending receivables: ₹${Math.round(r.amt).toLocaleString('en-IN')}.` });
  }

  res.json({
    reply:
      "I can answer questions like:\n" +
      "• What are today's sales?\n" +
      "• Show low-stock items\n" +
      "• Top selling products this month\n" +
      "• Stock of <product name>\n" +
      "• Pending payments"
  });
});

export default router;
