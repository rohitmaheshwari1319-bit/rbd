import { Router } from 'express';
import { db } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';

const router = Router();
router.use(authRequired);

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM cron_jobs ORDER BY id DESC').all());
});

router.post('/', (req, res, next) => {
  try {
    const {
      minute = '*', hour = '*', day = '*', month = '*', weekday = '*',
      command, enabled = 1
    } = req.body || {};
    if (!command) throw new HttpError(400, 'command is required');
    if (command.length > 1024) throw new HttpError(400, 'command too long');
    const info = db.prepare(`
      INSERT INTO cron_jobs (minute, hour, day, month, weekday, command, enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(minute, hour, day, month, weekday, command, enabled ? 1 : 0);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) { next(e); }
});

router.patch('/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const row = db.prepare('SELECT * FROM cron_jobs WHERE id = ?').get(id);
    if (!row) throw new HttpError(404, 'Not found');
    const fields = [], params = [];
    for (const k of ['minute', 'hour', 'day', 'month', 'weekday', 'command', 'enabled']) {
      if (req.body[k] !== undefined) {
        fields.push(`${k} = ?`);
        params.push(k === 'enabled' ? (req.body[k] ? 1 : 0) : req.body[k]);
      }
    }
    if (fields.length) {
      params.push(id);
      db.prepare(`UPDATE cron_jobs SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM cron_jobs WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

export default router;
