import { Router } from 'express';
import { db } from '../db.js';
import { authRequired, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authRequired);

const PUBLIC_KEYS = [
  'company_name', 'company_tagline', 'company_gstin',
  'company_address', 'company_phone', 'company_email',
  'currency', 'sales_target_monthly'
];

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const out = {};
  for (const r of rows) out[r.key] = r.value;
  // Provide defaults from env
  out.company_name ||= process.env.COMPANY_NAME || 'RBD Machine Tools';
  out.company_tagline ||= process.env.COMPANY_TAGLINE || 'Trust of India';
  out.company_gstin ||= process.env.COMPANY_GSTIN || '';
  out.company_address ||= process.env.COMPANY_ADDRESS || '';
  out.company_phone ||= process.env.COMPANY_PHONE || '';
  out.company_email ||= process.env.COMPANY_EMAIL || '';
  out.currency ||= 'INR';
  res.json(out);
});

router.put('/', requireRole('admin'), (req, res) => {
  const body = req.body || {};
  const stmt = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );
  const tx = db.transaction(() => {
    for (const key of PUBLIC_KEYS) {
      if (body[key] !== undefined) stmt.run(key, String(body[key] ?? ''));
    }
  });
  tx();
  res.json({ ok: true });
});

export default router;
