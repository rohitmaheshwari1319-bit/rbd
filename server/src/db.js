// Thin SQLite wrapper. Swap this single file to migrate to MySQL/PostgreSQL.
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DATABASE_PATH
  ? path.resolve(process.cwd(), process.env.DATABASE_PATH)
  : path.resolve(__dirname, '..', 'data', 'rbd.sqlite');

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL CHECK(role IN ('admin','manager','staff')) DEFAULT 'staff',
      active        INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS warehouses (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      code          TEXT NOT NULL UNIQUE,
      name          TEXT NOT NULL,
      address       TEXT,
      manager       TEXT,
      phone         TEXT,
      active        INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      parent_id     INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      sku             TEXT NOT NULL UNIQUE,
      barcode         TEXT UNIQUE,
      name            TEXT NOT NULL,
      description     TEXT,
      image_url       TEXT,
      category_id     INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      hsn_code        TEXT,
      unit            TEXT DEFAULT 'pcs',
      purchase_price  REAL NOT NULL DEFAULT 0,
      selling_price   REAL NOT NULL DEFAULT 0,
      gst_rate        REAL NOT NULL DEFAULT 18,
      reorder_level   INTEGER NOT NULL DEFAULT 5,
      track_serial    INTEGER NOT NULL DEFAULT 0,
      active          INTEGER NOT NULL DEFAULT 1,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
    CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);

    CREATE TABLE IF NOT EXISTS stock (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      warehouse_id  INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
      quantity      INTEGER NOT NULL DEFAULT 0,
      UNIQUE(product_id, warehouse_id)
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      warehouse_id  INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
      type          TEXT NOT NULL CHECK(type IN ('in','out','transfer','adjust')),
      quantity      INTEGER NOT NULL,
      ref_type      TEXT,    -- 'purchase' | 'sale' | 'manual' | 'transfer'
      ref_id        INTEGER,
      note          TEXT,
      user_id       INTEGER REFERENCES users(id),
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_movements_created ON stock_movements(created_at);
    CREATE INDEX IF NOT EXISTS idx_movements_product ON stock_movements(product_id);

    CREATE TABLE IF NOT EXISTS customers (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      phone         TEXT,
      email         TEXT,
      gstin         TEXT,
      address       TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      phone         TEXT,
      email         TEXT,
      gstin         TEXT,
      address       TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      reference       TEXT NOT NULL UNIQUE,
      supplier_id     INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
      warehouse_id    INTEGER NOT NULL REFERENCES warehouses(id),
      subtotal        REAL NOT NULL DEFAULT 0,
      tax             REAL NOT NULL DEFAULT 0,
      total           REAL NOT NULL DEFAULT 0,
      paid            REAL NOT NULL DEFAULT 0,
      status          TEXT NOT NULL DEFAULT 'received',
      note            TEXT,
      user_id         INTEGER REFERENCES users(id),
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS purchase_items (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id   INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
      product_id    INTEGER NOT NULL REFERENCES products(id),
      quantity      INTEGER NOT NULL,
      unit_price    REAL NOT NULL,
      gst_rate      REAL NOT NULL DEFAULT 0,
      total         REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sales (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_no      TEXT NOT NULL UNIQUE,
      customer_id     INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      warehouse_id    INTEGER NOT NULL REFERENCES warehouses(id),
      subtotal        REAL NOT NULL DEFAULT 0,
      tax             REAL NOT NULL DEFAULT 0,
      discount        REAL NOT NULL DEFAULT 0,
      total           REAL NOT NULL DEFAULT 0,
      paid            REAL NOT NULL DEFAULT 0,
      status          TEXT NOT NULL DEFAULT 'completed',
      payment_mode    TEXT,
      note            TEXT,
      user_id         INTEGER REFERENCES users(id),
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at);

    CREATE TABLE IF NOT EXISTS sale_items (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id       INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      product_id    INTEGER NOT NULL REFERENCES products(id),
      quantity      INTEGER NOT NULL,
      unit_price    REAL NOT NULL,
      gst_rate      REAL NOT NULL DEFAULT 0,
      total         REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      type          TEXT NOT NULL,
      title         TEXT NOT NULL,
      body          TEXT,
      severity      TEXT NOT NULL DEFAULT 'info',
      read          INTEGER NOT NULL DEFAULT 0,
      meta          TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER REFERENCES users(id),
      action        TEXT NOT NULL,
      entity        TEXT,
      entity_id     INTEGER,
      meta          TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key           TEXT PRIMARY KEY,
      value         TEXT
    );
  `);
}

// Helper used by routes — keeps DB swap surface tiny.
export function tx(fn) {
  return db.transaction(fn);
}
