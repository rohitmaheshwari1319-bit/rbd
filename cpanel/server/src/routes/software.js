import { Router } from 'express';
import { db } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';

const router = Router();
router.use(authRequired);

// One-click installer registry. In a real panel this would proxy to Softaculous.
const CATALOG = [
  { slug: 'wordpress',  name: 'WordPress',   version: '6.6.2',  category: 'Blogs / CMS',  icon: '📝',
    description: 'The world\u2019s most popular CMS. Build any site in minutes.' },
  { slug: 'joomla',     name: 'Joomla',      version: '5.1.4',  category: 'Blogs / CMS',  icon: '🟧',
    description: 'Flexible CMS with multilingual support out of the box.' },
  { slug: 'drupal',     name: 'Drupal',      version: '10.3.5', category: 'Blogs / CMS',  icon: '🔵',
    description: 'Enterprise-grade CMS for complex content needs.' },
  { slug: 'ghost',      name: 'Ghost',       version: '5.96.1', category: 'Blogs / CMS',  icon: '👻',
    description: 'Modern publishing platform for professional blogs.' },
  { slug: 'magento',    name: 'Magento',     version: '2.4.7',  category: 'E-commerce',   icon: '🛒',
    description: 'Powerful, flexible e-commerce for serious stores.' },
  { slug: 'prestashop', name: 'PrestaShop',  version: '8.2.0',  category: 'E-commerce',   icon: '🛍️',
    description: 'Open-source online store with 500+ features.' },
  { slug: 'opencart',   name: 'OpenCart',    version: '4.0.2',  category: 'E-commerce',   icon: '🧺',
    description: 'Feature-rich, easy to use online store.' },
  { slug: 'phpbb',      name: 'phpBB',       version: '3.3.13', category: 'Forums',       icon: '💬',
    description: 'Free, popular forum platform built with PHP.' },
  { slug: 'mediawiki',  name: 'MediaWiki',   version: '1.42.3', category: 'Wikis',        icon: '📚',
    description: 'The wiki platform that powers Wikipedia.' },
  { slug: 'moodle',     name: 'Moodle',      version: '4.4.3',  category: 'Education',    icon: '🎓',
    description: 'World\u2019s leading learning management system.' },
  { slug: 'dolibarr',   name: 'Dolibarr',    version: '20.0.0', category: 'Business',     icon: '💼',
    description: 'Modern ERP and CRM for small businesses.' },
  { slug: 'nextcloud',  name: 'Nextcloud',   version: '29.0.6', category: 'File / Cloud', icon: '☁️',
    description: 'Self-hosted productivity, file sync and share.' },
  { slug: 'mautic',     name: 'Mautic',      version: '5.1.1',  category: 'Marketing',    icon: '📣',
    description: 'Open-source marketing automation platform.' },
  { slug: 'phpmyadmin', name: 'phpMyAdmin',  version: '5.2.1',  category: 'Database',     icon: '🗄️',
    description: 'Web-based MySQL / MariaDB administration tool.' }
];

router.get('/catalog', (_req, res) => {
  res.json(CATALOG);
});

router.get('/installed', (_req, res) => {
  res.json(db.prepare('SELECT * FROM installed_software ORDER BY installed_at DESC').all());
});

router.post('/install', (req, res, next) => {
  try {
    const { slug, domain, install_path = '/' } = req.body || {};
    const item = CATALOG.find(c => c.slug === slug);
    if (!item) throw new HttpError(404, 'Unknown software slug');
    if (!domain) throw new HttpError(400, 'domain is required');
    const dom = db.prepare('SELECT 1 FROM domains WHERE name = ?').get(domain);
    if (!dom) throw new HttpError(404, 'Domain not found in this account');
    const info = db.prepare(`
      INSERT INTO installed_software (slug, name, version, domain, install_path)
      VALUES (?, ?, ?, ?, ?)
    `).run(slug, item.name, item.version, domain, install_path);
    db.prepare(
      "INSERT INTO activity_log (user_id, action, entity, detail) VALUES (?, 'install', 'software', ?)"
    ).run(req.user.id, `${item.name} on ${domain}${install_path}`);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) { next(e); }
});

router.delete('/installed/:id', (req, res) => {
  db.prepare('DELETE FROM installed_software WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

export default router;
