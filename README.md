# RBD Machine Tools — AI Inventory Automation System

Enterprise-grade, AI-powered inventory automation built for **RBD Machine Tools**
("Trust of India"). The system handles stock management, multi-warehouse
operations, purchases, sales, GST invoicing, intelligent forecasting and
dashboard analytics — packaged in a premium red / white industrial UI with full
dark-mode support.

The stack is fully self-hostable on your own server. There are zero external
dependencies for the database — it runs on file-based SQLite by default and can
be swapped to MySQL / PostgreSQL by replacing a single module.

---

## Tech Stack

| Layer       | Technology                                                  |
| ----------- | ----------------------------------------------------------- |
| Frontend    | React 18, Vite, TailwindCSS, Recharts, lucide-react         |
| Backend     | Node.js 18+, Express, better-sqlite3                        |
| Auth        | JWT + bcrypt (Admin / Manager / Staff roles)                |
| AI / ML     | Moving-average demand forecasting, reorder advisor, anomaly |
| Barcodes    | JsBarcode, qrcode, html5-qrcode (camera scanner)            |
| Documents   | jsPDF + jspdf-autotable, SheetJS (xlsx)                     |
| Branding    | Red (#E11D2E), White, Dark theme, RBD logo SVG              |

---

## Features

### AI Smart Dashboard
- Real-time inventory analytics & KPIs
- Daily stock movement tracking
- Warehouse-wise stock overview
- AI-generated business insights
- Sales trend analysis with charts
- Fast-moving & slow-moving product detection
- Profit and stock valuation reports

### Inventory Management
- Products with SKU, barcode, QR code, images, categories
- Purchase price, selling price, GST %, HSN code
- Multi-warehouse stock with transfer support
- Bulk import / export (Excel / CSV)
- Serial number tracking
- Reorder level + low-stock auto detection

### AI Automation
- Demand forecasting using sales history (moving average + trend)
- Auto purchase recommendations
- Auto reorder level suggestions
- Sales growth reports
- Duplicate product detection (fuzzy match)
- Smart warehouse allocation suggestions

### Barcode & Scanner
- Barcode + QR code generation per product
- Camera-based scanner (mobile + desktop)
- Instant stock update after scan
- Batch scanning mode

### Purchases & Sales
- Purchase order creation
- Supplier management
- Sales invoice generation with GST
- Automated GST invoice PDF download
- Customer management
- Payment tracking & pending payment alerts

### Notifications
- Low stock, expiry, sales target, transfer alerts
- WhatsApp / email hooks (pluggable)

### Security
- Admin / Manager / Staff roles with permission gates
- JWT auth, hashed passwords
- Activity log
- Backup / restore (DB file)

### Reports
- Inventory, warehouse, purchase, sales, P&L reports
- PDF + Excel export
- Interactive charts

### Modern UI/UX
- Responsive, mobile-first
- Premium animations & micro-interactions
- Light + dark mode
- RBD branded throughout

### Extra AI
- Voice-based inventory search (Web Speech API)
- AI chatbot assistant for inventory queries
- Smart business analytics

---

## Project Structure

```
rbd/
  package.json          # workspace scripts (concurrently)
  server/               # Node.js + Express + SQLite API
    src/
      index.js
      db.js
      seed.js
      middleware/
      routes/
      services/
  client/               # React + Vite + Tailwind UI
    src/
      main.jsx
      App.jsx
      api/
      context/
      components/
      pages/
```

---

## Quick Start

```bash
# 1. Install everything (root + server + client)
npm run install:all

# 2. Seed the database (creates default admin + sample data)
npm run seed

# 3. Run dev servers (api on :4000, web on :5173)
npm run dev
```

Default login:

- **Email:** `admin@rbd.local`
- **Password:** `admin123`

> Change this immediately in production.

### Production build

```bash
npm run build      # builds client
npm start          # serves API + static client from server/
```

The Express server serves the built React app from `client/dist`, so you only
need a single Node process behind nginx in production.

---

## Configuration (`server/.env`)

```
PORT=4000
JWT_SECRET=change-me-in-production
DATABASE_PATH=./data/rbd.sqlite
COMPANY_NAME=RBD Machine Tools
COMPANY_GSTIN=
COMPANY_ADDRESS=
COMPANY_PHONE=
```

To swap to MySQL/PostgreSQL, replace `server/src/db.js` with a Knex / Prisma
implementation — all routes use a thin query helper, so the surface area is
small.

---

## Default Roles

| Role    | Capabilities                                               |
| ------- | ---------------------------------------------------------- |
| Admin   | Everything (users, settings, backup, all CRUD, reports)    |
| Manager | Products, stock, purchases, sales, reports                 |
| Staff   | Sales, scan-in/out, view inventory                         |

---

## License

Proprietary — RBD Machine Tools.
