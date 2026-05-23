import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { migrate } from './db.js';
import { notFound, errorHandler } from './middleware/errors.js';

import authRoutes from './routes/auth.js';
import statsRoutes from './routes/stats.js';
import filesRoutes from './routes/files.js';
import dbRoutes from './routes/databases.js';
import emailRoutes from './routes/email.js';
import domainsRoutes from './routes/domains.js';
import ftpRoutes from './routes/ftp.js';
import dnsRoutes from './routes/dns.js';
import cronRoutes from './routes/cron.js';
import sslRoutes from './routes/ssl.js';
import backupRoutes from './routes/backup.js';
import softwareRoutes from './routes/software.js';
import accountRoutes from './routes/account.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

migrate();

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') || true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'cpanel-app', time: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/databases', dbRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/domains', domainsRoutes);
app.use('/api/ftp', ftpRoutes);
app.use('/api/dns', dnsRoutes);
app.use('/api/cron', cronRoutes);
app.use('/api/ssl', sslRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/software', softwareRoutes);
app.use('/api/account', accountRoutes);

const clientDist = path.resolve(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use('/api', notFound);
app.use(errorHandler);

const PORT = Number(process.env.PORT || 4100);
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[cpanel-server] API listening on http://localhost:${PORT}`);
});
