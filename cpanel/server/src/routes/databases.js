import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';

const router = Router();
router.use(authRequired);

// List databases with attached users
router.get('/', (req, res) => {
  const dbs = db.prepare('SELECT * FROM databases ORDER BY name').all();
  const grants = db.prepare(`
    SELECT g.database_id, u.username, u.id AS db_user_id, g.privileges
    FROM db_grants g JOIN db_users u ON u.id = g.db_user_id
  `).all();
  const map = {};
  for (const g of grants) {
    map[g.database_id] = map[g.database_id] || [];
    map[g.database_id].push({ id: g.db_user_id, username: g.username, privileges: g.privileges });
  }
  res.json(dbs.map(d => ({ ...d, users: map[d.id] || [] })));
});

router.post('/', (req, res, next) => {
  try {
    const { name, charset = 'utf8mb4', collation = 'utf8mb4_unicode_ci' } = req.body || {};
    if (!name || !/^[a-zA-Z][\w]{2,63}$/.test(name)) {
      throw new HttpError(400, 'Database name must be 3-64 chars, alphanumeric/underscore, starting with a letter');
    }
    if (db.prepare('SELECT 1 FROM databases WHERE name = ?').get(name))
      throw new HttpError(409, 'A database with that name already exists');
    const info = db.prepare(
      'INSERT INTO databases (name, charset, collation, size_kb) VALUES (?, ?, ?, ?)'
    ).run(name, charset, collation, 16);
    db.prepare(
      "INSERT INTO activity_log (user_id, action, entity, detail) VALUES (?, 'create', 'database', ?)"
    ).run(req.user.id, name);
    res.status(201).json({ id: info.lastInsertRowid, name });
  } catch (e) { next(e); }
});

router.delete('/:id', (req, res, next) => {
  try {
    const row = db.prepare('SELECT * FROM databases WHERE id = ?').get(Number(req.params.id));
    if (!row) throw new HttpError(404, 'Database not found');
    db.prepare('DELETE FROM databases WHERE id = ?').run(row.id);
    db.prepare(
      "INSERT INTO activity_log (user_id, action, entity, detail) VALUES (?, 'drop', 'database', ?)"
    ).run(req.user.id, row.name);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// DB users
router.get('/users', (req, res) => {
  res.json(db.prepare('SELECT id, username, created_at FROM db_users ORDER BY username').all());
});

router.post('/users', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password || password.length < 6)
      throw new HttpError(400, 'username and password (min 6 chars) are required');
    if (!/^[a-zA-Z][\w]{2,31}$/.test(username))
      throw new HttpError(400, 'Username must be 3-32 chars, alphanumeric/underscore');
    if (db.prepare('SELECT 1 FROM db_users WHERE username = ?').get(username))
      throw new HttpError(409, 'A user with that name already exists');
    const hash = await bcrypt.hash(password, 10);
    const info = db.prepare('INSERT INTO db_users (username, password_hash) VALUES (?, ?)').run(username, hash);
    res.status(201).json({ id: info.lastInsertRowid, username });
  } catch (e) { next(e); }
});

router.delete('/users/:id', (req, res, next) => {
  try {
    const row = db.prepare('SELECT * FROM db_users WHERE id = ?').get(Number(req.params.id));
    if (!row) throw new HttpError(404, 'User not found');
    db.prepare('DELETE FROM db_users WHERE id = ?').run(row.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Grants
router.post('/grants', (req, res, next) => {
  try {
    const { database_id, db_user_id, privileges = 'ALL PRIVILEGES' } = req.body || {};
    if (!database_id || !db_user_id) throw new HttpError(400, 'database_id and db_user_id are required');
    db.prepare(
      'INSERT OR REPLACE INTO db_grants (database_id, db_user_id, privileges) VALUES (?, ?, ?)'
    ).run(Number(database_id), Number(db_user_id), privileges);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/grants', (req, res, next) => {
  try {
    const { database_id, db_user_id } = req.query;
    db.prepare('DELETE FROM db_grants WHERE database_id = ? AND db_user_id = ?')
      .run(Number(database_id), Number(db_user_id));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
