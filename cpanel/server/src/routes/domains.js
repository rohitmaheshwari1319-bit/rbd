import { Router } from 'express';
import { db } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';

const router = Router();
router.use(authRequired);

router.get('/', (req, res) => {
  res.json(db.prepare(`
    SELECT d.*, (SELECT 1 FROM ssl_certificates s WHERE s.domain = d.name AND s.status='valid') AS has_ssl
    FROM domains d ORDER BY type, name
  `).all());
});

router.post('/', (req, res, next) => {
  try {
    const { name, type = 'addon', document_root, redirects_to } = req.body || {};
    if (!name) throw new HttpError(400, 'Name is required');
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(name)) throw new HttpError(400, 'Invalid domain name');
    if (!['primary', 'addon', 'subdomain', 'parked'].includes(type))
      throw new HttpError(400, 'Invalid type');
    if (db.prepare('SELECT 1 FROM domains WHERE name = ?').get(name))
      throw new HttpError(409, 'Domain already exists');
    const home = `/home/${process.env.ACCOUNT_USERNAME || 'demo'}`;
    const root = document_root || (
      type === 'primary' ? `${home}/public_html` : `${home}/${name.split('.')[0]}`
    );
    const info = db.prepare(
      'INSERT INTO domains (name, type, document_root, redirects_to) VALUES (?, ?, ?, ?)'
    ).run(name, type, root, redirects_to || null);
    db.prepare(
      "INSERT INTO activity_log (user_id, action, entity, detail) VALUES (?, 'create', 'domain', ?)"
    ).run(req.user.id, name);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) { next(e); }
});

router.patch('/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const row = db.prepare('SELECT * FROM domains WHERE id = ?').get(id);
    if (!row) throw new HttpError(404, 'Not found');
    const fields = [], params = [];
    for (const k of ['document_root', 'redirects_to', 'ssl']) {
      if (req.body[k] !== undefined) { fields.push(`${k} = ?`); params.push(req.body[k]); }
    }
    if (fields.length) {
      params.push(id);
      db.prepare(`UPDATE domains SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:id', (req, res, next) => {
  try {
    const row = db.prepare('SELECT * FROM domains WHERE id = ?').get(Number(req.params.id));
    if (!row) throw new HttpError(404, 'Not found');
    if (row.type === 'primary') throw new HttpError(400, 'Cannot delete the primary domain');
    db.prepare('DELETE FROM domains WHERE id = ?').run(row.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
