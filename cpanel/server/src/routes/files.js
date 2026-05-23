// Virtual filesystem: path-keyed entries persisted in SQLite.
// Mirrors a real filesystem's mental model (parent_path + name) so the UI
// can render breadcrumbs, listings, and a text editor.
import path from 'node:path';
import { Router } from 'express';
import { db } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';

const router = Router();
router.use(authRequired);

const TEXT_EXT = new Set([
  '.txt', '.md', '.html', '.htm', '.css', '.js', '.json', '.yaml', '.yml',
  '.xml', '.svg', '.csv', '.log', '.ini', '.conf', '.htaccess', '.env',
  '.php', '.py', '.rb', '.sh'
]);

function normalize(p) {
  if (!p) return '/';
  const norm = path.posix.normalize(p);
  return norm === '.' ? '/' : norm;
}
function ensureUnderHome(p) {
  // For UI cleanliness — restrict the virtual FS root to /home/<user>
  const root = `/home/${process.env.ACCOUNT_USERNAME || 'demo'}`;
  if (p === root) return p;
  if (!p.startsWith(root + '/') && p !== '/') {
    throw new HttpError(400, `Path must be inside ${root}`);
  }
  return p;
}
function isText(name) {
  const ext = path.posix.extname(name).toLowerCase();
  return TEXT_EXT.has(ext) || name === '.htaccess';
}

// List a directory
router.get('/list', (req, res, next) => {
  try {
    const dir = ensureUnderHome(normalize(req.query.path || `/home/${process.env.ACCOUNT_USERNAME || 'demo'}`));
    const exists = db.prepare("SELECT 1 FROM files WHERE path = ? AND type='dir'").get(dir);
    if (!exists && dir !== `/home/${process.env.ACCOUNT_USERNAME || 'demo'}`) {
      // Allow listing the root even before any seed — empty array
      throw new HttpError(404, 'Directory not found');
    }
    const rows = db.prepare(
      'SELECT id, path, name, type, size, mime, perms, owner, modified_at FROM files WHERE parent_path = ? ORDER BY type DESC, name'
    ).all(dir);
    res.json({ path: dir, entries: rows });
  } catch (e) { next(e); }
});

// Read a single file's content (text only)
router.get('/read', (req, res, next) => {
  try {
    const p = ensureUnderHome(normalize(req.query.path));
    const f = db.prepare("SELECT * FROM files WHERE path = ? AND type='file'").get(p);
    if (!f) throw new HttpError(404, 'File not found');
    if (!isText(f.name)) throw new HttpError(400, 'Binary files cannot be opened in the editor');
    res.json({ path: f.path, name: f.name, size: f.size, mime: f.mime, content: f.content || '' });
  } catch (e) { next(e); }
});

// Create dir or file
router.post('/create', (req, res, next) => {
  try {
    const { path: dir, name, type = 'file', content = '' } = req.body || {};
    if (!dir || !name) throw new HttpError(400, 'path and name are required');
    if (!/^[\w.\-+@]+$/.test(name)) throw new HttpError(400, 'Invalid characters in name');
    const parent = ensureUnderHome(normalize(dir));
    const full = parent === '/' ? `/${name}` : `${parent}/${name}`;
    const exists = db.prepare('SELECT 1 FROM files WHERE path = ?').get(full);
    if (exists) throw new HttpError(409, 'A file or folder with that name already exists');
    const size = type === 'file' ? Buffer.byteLength(content || '', 'utf8') : 0;
    const mime = type === 'file' ? guessMime(name) : null;
    db.prepare(
      `INSERT INTO files (path, parent_path, name, type, size, content, mime)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(full, parent, name, type, size, type === 'file' ? content : null, mime);
    db.prepare(
      "INSERT INTO activity_log (user_id, action, entity, detail) VALUES (?, ?, 'files', ?)"
    ).run(req.user.id, type === 'dir' ? 'mkdir' : 'create_file', full);
    res.status(201).json({ ok: true, path: full });
  } catch (e) { next(e); }
});

// Save / overwrite text file content
router.put('/save', (req, res, next) => {
  try {
    const { path: p, content = '' } = req.body || {};
    const full = ensureUnderHome(normalize(p));
    const f = db.prepare("SELECT * FROM files WHERE path = ? AND type='file'").get(full);
    if (!f) throw new HttpError(404, 'File not found');
    if (!isText(f.name)) throw new HttpError(400, 'Cannot edit binary files');
    const size = Buffer.byteLength(content, 'utf8');
    db.prepare("UPDATE files SET content = ?, size = ?, modified_at = datetime('now') WHERE path = ?")
      .run(content, size, full);
    db.prepare(
      "INSERT INTO activity_log (user_id, action, entity, detail) VALUES (?, 'save_file', 'files', ?)"
    ).run(req.user.id, full);
    res.json({ ok: true, size });
  } catch (e) { next(e); }
});

// Rename / move within same parent
router.post('/rename', (req, res, next) => {
  try {
    const { path: p, newName } = req.body || {};
    if (!p || !newName) throw new HttpError(400, 'path and newName are required');
    if (!/^[\w.\-+@]+$/.test(newName)) throw new HttpError(400, 'Invalid characters in name');
    const full = ensureUnderHome(normalize(p));
    const row = db.prepare('SELECT * FROM files WHERE path = ?').get(full);
    if (!row) throw new HttpError(404, 'Not found');
    const newPath = row.parent_path === '/' ? `/${newName}` : `${row.parent_path}/${newName}`;
    if (db.prepare('SELECT 1 FROM files WHERE path = ?').get(newPath))
      throw new HttpError(409, 'Target name already exists');

    const tx = db.transaction(() => {
      db.prepare('UPDATE files SET path = ?, name = ? WHERE id = ?').run(newPath, newName, row.id);
      if (row.type === 'dir') {
        // Rewrite paths of all descendants
        const children = db.prepare('SELECT id, path, parent_path FROM files WHERE path LIKE ? OR parent_path LIKE ?')
          .all(`${full}/%`, `${full}/%`);
        for (const c of children) {
          const newChildPath = newPath + c.path.slice(full.length);
          const newChildParent = newPath + c.parent_path.slice(full.length);
          db.prepare('UPDATE files SET path = ?, parent_path = ? WHERE id = ?')
            .run(newChildPath, newChildParent, c.id);
        }
        // Also rewrite rows where parent_path matches old path
        db.prepare('UPDATE files SET parent_path = ? WHERE parent_path = ?').run(newPath, full);
      }
    });
    tx();
    res.json({ ok: true, path: newPath });
  } catch (e) { next(e); }
});

// Delete (recursive for directories)
router.delete('/delete', (req, res, next) => {
  try {
    const p = ensureUnderHome(normalize(req.query.path));
    const row = db.prepare('SELECT * FROM files WHERE path = ?').get(p);
    if (!row) throw new HttpError(404, 'Not found');
    const tx = db.transaction(() => {
      if (row.type === 'dir') {
        db.prepare('DELETE FROM files WHERE path = ? OR path LIKE ? OR parent_path = ? OR parent_path LIKE ?')
          .run(p, `${p}/%`, p, `${p}/%`);
      } else {
        db.prepare('DELETE FROM files WHERE id = ?').run(row.id);
      }
    });
    tx();
    db.prepare(
      "INSERT INTO activity_log (user_id, action, entity, detail) VALUES (?, 'delete', 'files', ?)"
    ).run(req.user.id, p);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Disk usage breakdown for the dashboard widget
router.get('/disk-usage', (req, res) => {
  const rows = db.prepare(
    `SELECT parent_path AS path, COUNT(*) AS files, COALESCE(SUM(size),0) AS bytes
     FROM files WHERE type='file' GROUP BY parent_path ORDER BY bytes DESC LIMIT 10`
  ).all();
  res.json(rows);
});

function guessMime(name) {
  const ext = path.posix.extname(name).toLowerCase();
  return {
    '.html': 'text/html', '.htm': 'text/html', '.css': 'text/css',
    '.js': 'application/javascript', '.json': 'application/json',
    '.txt': 'text/plain', '.md': 'text/markdown', '.csv': 'text/csv',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.pdf': 'application/pdf',
    '.zip': 'application/zip', '.php': 'application/x-php'
  }[ext] || 'application/octet-stream';
}

export default router;
