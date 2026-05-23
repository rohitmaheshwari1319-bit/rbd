import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db, migrate } from './db.js';

migrate();

console.log('[seed] Starting seed...');

const tx = db.transaction(() => {
  // --- Users ---
  const adminExists = db.prepare('SELECT 1 FROM users WHERE email = ?').get('admin@rbd.local');
  if (!adminExists) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')")
      .run('RBD Admin', 'admin@rbd.local', hash);
    console.log('[seed] Created admin: admin@rbd.local / admin123');
  }
  const managerExists = db.prepare('SELECT 1 FROM users WHERE email = ?').get('manager@rbd.local');
  if (!managerExists) {
    const hash = bcrypt.hashSync('manager123', 10);
    db.prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'manager')")
      .run('Warehouse Manager', 'manager@rbd.local', hash);
  }
  const staffExists = db.prepare('SELECT 1 FROM users WHERE email = ?').get('staff@rbd.local');
  if (!staffExists) {
    const hash = bcrypt.hashSync('staff123', 10);
    db.prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'staff')")
      .run('Sales Staff', 'staff@rbd.local', hash);
  }

  // --- Warehouses ---
  const warehouses = [
    { code: 'WH-MAIN', name: 'Main Warehouse - Delhi', address: 'Industrial Area, Phase 2, Delhi', manager: 'R. Singh', phone: '9999000001' },
    { code: 'WH-NORTH', name: 'North Hub - Ludhiana', address: 'Focal Point, Ludhiana, Punjab', manager: 'A. Kaur', phone: '9999000002' },
    { code: 'WH-WEST', name: 'West Hub - Pune', address: 'MIDC, Bhosari, Pune', manager: 'S. Patil', phone: '9999000003' }
  ];
  const insertWh = db.prepare(
    'INSERT OR IGNORE INTO warehouses (code, name, address, manager, phone) VALUES (?, ?, ?, ?, ?)'
  );
  for (const w of warehouses) insertWh.run(w.code, w.name, w.address, w.manager, w.phone);

  // --- Categories ---
  const cats = [
    'Tractor Parts', 'Power Tools', 'Hand Tools', 'Agriculture Implements',
    'Hydraulic Components', 'Lubricants & Oils', 'Safety Equipment', 'Bearings & Belts'
  ];
  const insertCat = db.prepare('INSERT OR IGNORE INTO categories (name) VALUES (?)');
  for (const c of cats) insertCat.run(c);

  // --- Products ---
  const sampleProducts = [
    { sku: 'TRC-OF-001', name: 'Tractor Oil Filter (Mahindra 575)',     cat: 'Tractor Parts',           pp: 280,  sp: 425,  gst: 18, hsn: '8421' },
    { sku: 'TRC-AF-002', name: 'Tractor Air Filter (Sonalika 745)',     cat: 'Tractor Parts',           pp: 410,  sp: 595,  gst: 18, hsn: '8421' },
    { sku: 'PT-DRL-101', name: 'Heavy Duty Cordless Drill 18V',         cat: 'Power Tools',             pp: 4200, sp: 6499, gst: 18, hsn: '8467' },
    { sku: 'PT-GRD-102', name: 'Angle Grinder 850W',                    cat: 'Power Tools',             pp: 1850, sp: 2799, gst: 18, hsn: '8467' },
    { sku: 'HT-WRN-201', name: 'Combination Wrench Set 12pc',           cat: 'Hand Tools',              pp: 980,  sp: 1499, gst: 18, hsn: '8204' },
    { sku: 'HT-HMR-202', name: 'Claw Hammer 500g',                      cat: 'Hand Tools',              pp: 220,  sp: 349,  gst: 18, hsn: '8205' },
    { sku: 'AG-PLW-301', name: 'MB Plough 3 Bottom',                    cat: 'Agriculture Implements',  pp: 18500,sp: 24999,gst: 12, hsn: '8432' },
    { sku: 'AG-CLT-302', name: 'Cultivator 9 Tyne',                     cat: 'Agriculture Implements',  pp: 9500, sp: 13499,gst: 12, hsn: '8432' },
    { sku: 'HY-PMP-401', name: 'Hydraulic Gear Pump 12cc',              cat: 'Hydraulic Components',    pp: 2400, sp: 3599, gst: 18, hsn: '8413' },
    { sku: 'LB-OIL-501', name: 'Engine Oil 15W-40 (5L)',                cat: 'Lubricants & Oils',       pp: 1100, sp: 1499, gst: 18, hsn: '2710' },
    { sku: 'LB-GRS-502', name: 'Multi-Purpose Grease (1Kg)',            cat: 'Lubricants & Oils',       pp: 240,  sp: 379,  gst: 18, hsn: '2710' },
    { sku: 'SF-HLM-601', name: 'Industrial Safety Helmet',              cat: 'Safety Equipment',        pp: 320,  sp: 499,  gst: 18, hsn: '6506' },
    { sku: 'SF-GLV-602', name: 'Anti-Cut Work Gloves (Pair)',           cat: 'Safety Equipment',        pp: 110,  sp: 199,  gst: 18, hsn: '6116' },
    { sku: 'BR-BRG-701', name: 'Tapered Roller Bearing 32208',          cat: 'Bearings & Belts',        pp: 380,  sp: 599,  gst: 18, hsn: '8482' },
    { sku: 'BR-VBL-702', name: 'V-Belt B-72',                           cat: 'Bearings & Belts',        pp: 145,  sp: 249,  gst: 18, hsn: '4010' }
  ];

  const insertProd = db.prepare(`
    INSERT OR IGNORE INTO products (sku, barcode, name, category_id, hsn_code, unit, purchase_price, selling_price, gst_rate, reorder_level)
    VALUES (?, ?, ?, (SELECT id FROM categories WHERE name = ?), ?, 'pcs', ?, ?, ?, ?)
  `);
  for (const p of sampleProducts) {
    const barcode = '890' + String(Math.floor(1e9 + Math.random() * 9e9));
    insertProd.run(p.sku, barcode, p.name, p.cat, p.hsn, p.pp, p.sp, p.gst, 10);
  }

  // --- Initial stock per warehouse ---
  const products = db.prepare('SELECT id FROM products').all();
  const whIds = db.prepare('SELECT id FROM warehouses').all();
  const insertStock = db.prepare(
    'INSERT OR IGNORE INTO stock (product_id, warehouse_id, quantity) VALUES (?, ?, ?)'
  );
  for (const p of products) {
    for (const w of whIds) {
      const q = Math.floor(Math.random() * 80) + 5;
      insertStock.run(p.id, w.id, q);
    }
  }

  // --- Customers & Suppliers ---
  const insertCust = db.prepare('INSERT OR IGNORE INTO customers (name, phone, email, gstin, address) VALUES (?, ?, ?, ?, ?)');
  insertCust.run('Sharma Agro Services',  '9876500011', 'sharma@example.com',  '07ABCDE1234F1Z5', 'Sonipat, Haryana');
  insertCust.run('Verma Tractors Pvt Ltd','9876500012', 'verma@example.com',   '03ABCDE5678F1Z9', 'Ludhiana, Punjab');
  insertCust.run('Patil Farm Equipments', '9876500013', 'patil@example.com',   '27ABCDE9012F1Z3', 'Pune, Maharashtra');

  const insertSup = db.prepare('INSERT OR IGNORE INTO suppliers (name, phone, email, gstin, address) VALUES (?, ?, ?, ?, ?)');
  insertSup.run('National Bearings Co.',     '9123400001', 'sales@nbc.example',     '07AAACN1234F1Z5', 'Faridabad, Haryana');
  insertSup.run('Apex Power Tools Ltd',      '9123400002', 'orders@apex.example',   '27AAACA5678F1Z9', 'Mumbai, Maharashtra');
  insertSup.run('Bharat Lubricants Pvt Ltd', '9123400003', 'contact@blpl.example',  '24AAACB9012F1Z3', 'Vadodara, Gujarat');

  // --- A few historical sales for AI forecasting ---
  const customers = db.prepare('SELECT id FROM customers').all();
  const productList = db.prepare('SELECT id, selling_price, gst_rate FROM products').all();
  const insertSale = db.prepare(`
    INSERT INTO sales (invoice_no, customer_id, warehouse_id, subtotal, tax, total, paid, status, payment_mode, user_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', ?, 1, datetime('now', ?))
  `);
  const insertSaleItem = db.prepare(`
    INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, gst_rate, total) VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertMove = db.prepare(`
    INSERT INTO stock_movements (product_id, warehouse_id, type, quantity, ref_type, ref_id, user_id, created_at)
    VALUES (?, ?, 'out', ?, 'sale', ?, 1, datetime('now', ?))
  `);

  let invSeq = 1;
  for (let dayOffset = 60; dayOffset >= 0; dayOffset--) {
    const salesPerDay = 1 + Math.floor(Math.random() * 4);
    for (let s = 0; s < salesPerDay; s++) {
      const cust = customers[Math.floor(Math.random() * customers.length)];
      const wh = whIds[Math.floor(Math.random() * whIds.length)];
      const lineCount = 1 + Math.floor(Math.random() * 3);
      let subtotal = 0, tax = 0;
      const items = [];
      for (let i = 0; i < lineCount; i++) {
        const p = productList[Math.floor(Math.random() * productList.length)];
        const q = 1 + Math.floor(Math.random() * 4);
        const lineSubtotal = q * p.selling_price;
        const lineTax = lineSubtotal * (p.gst_rate / 100);
        subtotal += lineSubtotal;
        tax += lineTax;
        items.push({ p, q, total: lineSubtotal + lineTax });
      }
      const total = subtotal + tax;
      const invoiceNo = 'INV-2026-' + String(invSeq++).padStart(5, '0');
      const offset = `-${dayOffset} days`;
      const saleId = insertSale.run(
        invoiceNo, cust.id, wh.id, subtotal, tax, total, total, 'cash', offset
      ).lastInsertRowid;
      for (const it of items) {
        insertSaleItem.run(saleId, it.p.id, it.q, it.p.selling_price, it.p.gst_rate, it.total);
        insertMove.run(it.p.id, wh.id, it.q, saleId, offset);
        // decrement stock
        db.prepare('UPDATE stock SET quantity = MAX(0, quantity - ?) WHERE product_id = ? AND warehouse_id = ?')
          .run(it.q, it.p.id, wh.id);
      }
    }
  }

  // --- Seed notifications ---
  db.prepare(`INSERT INTO notifications (type, title, body, severity)
              VALUES ('welcome', 'Welcome to RBD Inventory', 'Your AI-powered inventory system is ready.', 'info')`).run();
});

tx();

console.log('[seed] Done.');
