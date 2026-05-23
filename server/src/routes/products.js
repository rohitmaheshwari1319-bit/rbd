import { Router } from 'express';
import { db } from '../db.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';

const router = Router();
router.use(authRequired);

function generateBarcode() {
  return '890' + String(Math.floor(1e9 + Math.random() * 9e9));
}

router.get('/', (req, res) => {
  const { q = '', category_id, low_stock, limit = 200 } = req.query;
  const where = ['p.active = 1'];
  const params = [];
  if (q) {
    where.push('(p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  if (category_id) { where.push('p.category_id = ?'); params.push(Number(category_id)); }

  let rows = db.prepare(`
    SELECT p.*, c.name AS category_name,
           COALESCE((SELECT SUM(quantity) FROM stock WHERE product_id = p.id), 0) AS stock_qty
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE ${where.join(' AND ')}
    ORDER BY p.name
    LIMIT ?
  `).all(...params, Number(limit));

  if (low_stock === '1') rows = rows.filter(r => r.stock_qty <= r.reorder_level);
  res.json(rows);
});

router.get('/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const product = db.prepare(`
      SELECT p.*, c.name AS category_name
      FROM products p LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.id = ?`).get(id);
    if (!product) throw new HttpError(404, 'Product not found');
    const stock = db.prepare(`
      SELECT s.warehouse_id, s.quantity, w.code, w.name
      FROM stock s JOIN warehouses w ON w.id = s.warehouse_id
      WHERE s.product_id = ? ORDER BY w.name
    `).all(id);
    const recent = db.prepare(`
      SELECT m.*, w.name AS warehouse_name
      FROM stock_movements m JOIN warehouses w ON w.id = m.warehouse_id
      WHERE m.product_id = ?
      ORDER BY m.created_at DESC LIMIT 20
    `).all(id);
    res.json({ ...product, stock, movements: recent });
  } catch (e) { next(e); }
});

router.post('/', requireRole('admin', 'manager'), (req, res, next) => {
  try {
    const {
      sku, barcode, name, description, image_url, category_id,
      hsn_code, unit, purchase_price, selling_price, gst_rate, reorder_level, track_serial
    } = req.body || {};
    if (!sku || !name) throw new HttpError(400, 'SKU and name are required');
    const dup = db.prepare('SELECT id FROM products WHERE sku = ?').get(sku);
    if (dup) throw new HttpError(409, 'SKU already exists');
    const info = db.prepare(`
      INSERT INTO products
        (sku, barcode, name, description, image_url, category_id, hsn_code, unit,
         purchase_price, selling_price, gst_rate, reorder_level, track_serial)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sku, barcode || generateBarcode(), name, description || null, image_url || null,
      category_id || null, hsn_code || null, unit || 'pcs',
      Number(purchase_price) || 0, Number(selling_price) || 0,
      Number(gst_rate) ?? 18, Number(reorder_level) ?? 5, track_serial ? 1 : 0
    );
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) { next(e); }
});

router.patch('/:id', requireRole('admin', 'manager'), (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const fields = [], params = [];
    const allowed = [
      'sku', 'barcode', 'name', 'description', 'image_url', 'category_id',
      'hsn_code', 'unit', 'purchase_price', 'selling_price', 'gst_rate',
      'reorder_level', 'track_serial', 'active'
    ];
    for (const k of allowed) {
      if (req.body[k] !== undefined) {
        fields.push(`${k} = ?`);
        params.push(['active', 'track_serial'].includes(k) ? (req.body[k] ? 1 : 0) : req.body[k]);
      }
    }
    if (!fields.length) return res.json({ ok: true });
    params.push(id);
    db.prepare(`UPDATE products SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`)
      .run(...params);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:id', requireRole('admin', 'manager'), (req, res) => {
  // Soft delete to preserve historical sales/purchases
  db.prepare('UPDATE products SET active = 0 WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// Bulk import
router.post('/bulk', requireRole('admin', 'manager'), (req, res, next) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length) throw new HttpError(400, 'items array required');
    const insert = db.prepare(`
      INSERT INTO products (sku, barcode, name, hsn_code, unit, purchase_price, selling_price, gst_rate, reorder_level)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(sku) DO UPDATE SET
        name = excluded.name, hsn_code = excluded.hsn_code, unit = excluded.unit,
        purchase_price = excluded.purchase_price, selling_price = excluded.selling_price,
        gst_rate = excluded.gst_rate, reorder_level = excluded.reorder_level,
        updated_at = datetime('now')
    `);
    let count = 0;
    const tx = db.transaction(() => {
      for (const it of items) {
        if (!it.sku || !it.name) continue;
        insert.run(
          String(it.sku), it.barcode || generateBarcode(), String(it.name),
          it.hsn_code || null, it.unit || 'pcs',
          Number(it.purchase_price) || 0, Number(it.selling_price) || 0,
          Number(it.gst_rate) ?? 18, Number(it.reorder_level) ?? 5
        );
        count++;
      }
    });
    tx();
    res.json({ ok: true, imported: count });
  } catch (e) { next(e); }
});

// Lookup by barcode (used by scanner)
router.get('/lookup/:barcode', (req, res, next) => {
  try {
    const product = db.prepare(`
      SELECT p.*, c.name AS category_name,
             COALESCE((SELECT SUM(quantity) FROM stock WHERE product_id = p.id), 0) AS stock_qty
      FROM products p LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.barcode = ? OR p.sku = ?
    `).get(req.params.barcode, req.params.barcode);
    if (!product) throw new HttpError(404, 'Product not found for that code');
    res.json(product);
  } catch (e) { next(e); }
});

export default router;
