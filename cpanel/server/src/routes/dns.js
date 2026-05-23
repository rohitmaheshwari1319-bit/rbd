import { Router } from 'express';
import { db } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';

const router = Router();
router.use(authRequired);

const TYPES = new Set(['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA']);

router.get('/zones', (req, res) => {
  res.json(db.prepare('SELECT DISTINCT zone FROM dns_records ORDER BY zone').all().map(r => r.zone));
});

router.get('/records', (req, res) => {
  const { zone } = req.query;
  if (!zone) return res.status(400).json({ error: 'zone is required' });
  res.json(db.prepare(
    'SELECT * FROM dns_records WHERE zone = ? ORDER BY type, name'
  ).all(zone));
});

router.post('/records', (req, res, next) => {
  try {
    const { zone, name, type, value, ttl = 14400, priority } = req.body || {};
    if (!zone || !name || !type || !value) throw new HttpError(400, 'zone, name, type and value are required');
    if (!TYPES.has(type)) throw new HttpError(400, 'Unsupported record type');
    if (type === 'MX' && !priority && priority !== 0) throw new HttpError(400, 'MX records require a priority');
    const info = db.prepare(
      'INSERT INTO dns_records (zone, name, type, value, ttl, priority) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(zone, name, type, value, Number(ttl), priority !== undefined ? Number(priority) : null);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) { next(e); }
});

router.patch('/records/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const row = db.prepare('SELECT * FROM dns_records WHERE id = ?').get(id);
    if (!row) throw new HttpError(404, 'Not found');
    const fields = [], params = [];
    for (const k of ['name', 'type', 'value', 'ttl', 'priority']) {
      if (req.body[k] !== undefined) { fields.push(`${k} = ?`); params.push(req.body[k]); }
    }
    if (fields.length) {
      params.push(id);
      db.prepare(`UPDATE dns_records SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/records/:id', (req, res) => {
  db.prepare('DELETE FROM dns_records WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

export default router;
