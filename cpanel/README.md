# cPanel-style Hosting Control Panel

A self-hosted, modern recreation of the iconic cPanel hosting control panel UI,
built end-to-end with Node.js, SQLite and React. Includes the famous tile-grid
dashboard with live search, plus functional pages for File Manager, Databases,
Email, Domains, DNS, FTP, Cron, SSL, Statistics, Backups, Software Installer
and account preferences.

> This is a *demonstration* control panel: it persists everything to a local
> SQLite database and simulates the operations a real hosting panel would
> delegate to Apache, MySQL, Postfix, BIND etc. It is **not** wired to actual
> system services — perfect as a UI/UX showcase, an admin shell for an SaaS
> hosting product, or as a starting point for a real panel.

---

## Tech Stack

| Layer       | Technology                                              |
| ----------- | ------------------------------------------------------- |
| Frontend    | React 18, Vite, TailwindCSS, Recharts, lucide-react     |
| Backend     | Node.js 18+, Express, better-sqlite3                    |
| Auth        | JWT + bcrypt                                            |
| Theme       | cPanel-Jupiter-inspired (navy header, white tile grid)  |

---

## Features

- **Login** with JWT auth (account holder + admin roles)
- **Dashboard** — iconic tile grid with categories and live search
- **File Manager** — virtual filesystem: browse, create folders/files,
  rename, delete, in-browser text editor, breadcrumb navigation
- **Databases** — create / drop databases, manage DB users
- **Email Accounts** — CRUD with quota usage bars
- **Domains** — primary, subdomains, addon domains, parked, redirects
- **DNS Zone Editor** — A / AAAA / CNAME / MX / TXT / NS records
- **FTP Accounts** — CRUD with directory + quota
- **Cron Jobs** — schedule editor with common-task presets
- **SSL/TLS** — certificate listing, expiry tracking
- **Statistics** — bandwidth, visitors, disk usage, CPU/memory charts
- **Backup** — generate / list backups
- **Software Installer** — one-click install registry (WordPress, etc.)
- **Preferences** — change password, contact info

---

## Quick start

```bash
npm run install:all
npm run seed
npm run dev          # API :4100, Web :5174
```

Default login: `user@cpanel.local` / `cpanel123`

### Production build

```bash
npm run build
npm start
```

The Express server serves the built React app, so a single Node process is all
you need behind nginx.

---

## Configuration (`server/.env`)

```
PORT=4100
JWT_SECRET=change-me-in-production
DATABASE_PATH=./data/cpanel.sqlite
ACCOUNT_DOMAIN=example.com
ACCOUNT_USERNAME=demo
HOSTNAME=server01.example.com
SERVER_IP=192.0.2.10
```
