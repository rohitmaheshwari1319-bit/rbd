import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Trash2, FileText, Printer, IndianRupee, Receipt, Eye } from 'lucide-react';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import Modal from '../components/Modal.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { inr, dt } from '../lib/format.js';
import { generateInvoicePDF } from '../lib/invoice.js';

function NewSaleModal({ open, onClose, onCreated }) {
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [warehouse_id, setWarehouseId] = useState('');
  const [customer_id, setCustomerId] = useState('');
  const [payment_mode, setPaymentMode] = useState('cash');
  const [discount, setDiscount] = useState(0);
  const [paid, setPaid] = useState(0);
  const [note, setNote] = useState('');
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    Promise.all([
      api.get('/products?limit=500'),
      api.get('/warehouses'),
      api.get('/customers')
    ]).then(([p, w, c]) => {
      setProducts(p); setWarehouses(w); setCustomers(c);
      if (w[0] && !warehouse_id) setWarehouseId(w[0].id);
    }).catch(e => toast.error(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const addItem = (p) => {
    setItems(prev => {
      const existing = prev.find(i => i.product_id === p.id);
      if (existing) return prev.map(i => i.product_id === p.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product_id: p.id, name: p.name, sku: p.sku, quantity: 1, unit_price: p.selling_price, gst_rate: p.gst_rate }];
    });
    setSearch('');
  };

  const totals = useMemo(() => {
    let sub = 0, tax = 0;
    for (const it of items) {
      const s = it.quantity * it.unit_price;
      sub += s; tax += s * (it.gst_rate / 100);
    }
    const total = Math.max(0, sub + tax - Number(discount || 0));
    return { sub, tax, total };
  }, [items, discount]);

  const filtered = useMemo(() => {
    if (!search) return [];
    const s = search.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s) || (p.barcode || '').includes(search))
      .slice(0, 8);
  }, [search, products]);

  const submit = async () => {
    if (!warehouse_id) return toast.error('Select a warehouse');
    if (items.length === 0) return toast.error('Add at least one item');
    setBusy(true);
    try {
      const r = await api.post('/sales', {
        warehouse_id: Number(warehouse_id),
        customer_id: customer_id ? Number(customer_id) : null,
        items: items.map(i => ({ product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price, gst_rate: i.gst_rate })),
        discount: Number(discount) || 0,
        paid: Number(paid) || totals.total,
        payment_mode, note
      });
      toast.success(`Invoice ${r.invoice_no} created`);
      onCreated?.(r.id);
      onClose();
      // Reset
      setItems([]); setDiscount(0); setPaid(0); setNote(''); setCustomerId('');
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="New sale" size="xl"
      footer={
        <>
          <div className="mr-auto text-sm">
            <span className="text-ink-500 mr-2">Total:</span>
            <span className="font-extrabold text-lg">{inr(totals.total)}</span>
          </div>
          <button className="btn-soft" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy || items.length === 0} onClick={submit}>
            {busy ? 'Saving…' : 'Create invoice'}
          </button>
        </>
      }>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div><label className="label">Warehouse</label>
            <select className="select" value={warehouse_id} onChange={e => setWarehouseId(e.target.value)}>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div><label className="label">Customer</label>
            <select className="select" value={customer_id} onChange={e => setCustomerId(e.target.value)}>
              <option value="">Walk-in customer</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div><label className="label">Add items</label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input className="input pl-9" placeholder="Search by name, SKU or barcode…"
                     value={search} onChange={e => setSearch(e.target.value)} />
              {filtered.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 rounded-lg shadow-card overflow-hidden">
                  {filtered.map(p => (
                    <li key={p.id} className="px-3 py-2 text-sm hover:bg-ink-50 dark:hover:bg-ink-800 cursor-pointer flex items-center justify-between gap-3"
                        onClick={() => addItem(p)}>
                      <div>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-ink-500">{p.sku} · stock {p.stock_qty}</div>
                      </div>
                      <span className="font-semibold">{inr(p.selling_price)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Payment mode</label>
              <select className="select" value={payment_mode} onChange={e => setPaymentMode(e.target.value)}>
                <option>cash</option><option>upi</option><option>card</option><option>bank_transfer</option><option>credit</option>
              </select>
            </div>
            <div><label className="label">Discount (₹)</label>
              <input className="input" type="number" value={discount} onChange={e => setDiscount(e.target.value)} />
            </div>
            <div><label className="label">Paid (₹)</label>
              <input className="input" type="number" value={paid} onChange={e => setPaid(e.target.value)} placeholder={String(totals.total)} />
            </div>
            <div><label className="label">Note</label>
              <input className="input" value={note} onChange={e => setNote(e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <div className="overflow-x-auto -mx-2">
          <table className="table min-w-[700px]">
            <thead><tr><th>Item</th><th className="text-center">Qty</th><th className="text-right">Price</th><th className="text-center">GST%</th><th className="text-right">Total</th><th></th></tr></thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan={6} className="!py-6 text-center text-ink-500">Search and add products to start the bill.</td></tr>}
              {items.map((it, idx) => {
                const lineSub = it.quantity * it.unit_price;
                const lineTotal = lineSub * (1 + it.gst_rate / 100);
                return (
                  <tr key={it.product_id}>
                    <td>
                      <div className="font-semibold">{it.name}</div>
                      <div className="text-xs text-ink-500">{it.sku}</div>
                    </td>
                    <td className="text-center">
                      <input className="input !py-1 w-20 text-center" type="number" min="1" value={it.quantity}
                             onChange={e => setItems(arr => arr.map((x, i) => i === idx ? { ...x, quantity: Number(e.target.value) || 1 } : x))} />
                    </td>
                    <td className="text-right">
                      <input className="input !py-1 w-24 text-right" type="number" value={it.unit_price}
                             onChange={e => setItems(arr => arr.map((x, i) => i === idx ? { ...x, unit_price: Number(e.target.value) || 0 } : x))} />
                    </td>
                    <td className="text-center">
                      <input className="input !py-1 w-16 text-center" type="number" value={it.gst_rate}
                             onChange={e => setItems(arr => arr.map((x, i) => i === idx ? { ...x, gst_rate: Number(e.target.value) || 0 } : x))} />
                    </td>
                    <td className="text-right font-semibold">{inr(lineTotal)}</td>
                    <td className="text-right">
                      <button className="btn-ghost !p-1.5 text-rbd-600" onClick={() => setItems(arr => arr.filter((_, i) => i !== idx))}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {items.length > 0 && (
              <tfoot className="text-sm">
                <tr><td colSpan={4} className="text-right text-ink-500">Subtotal</td><td className="text-right">{inr(totals.sub)}</td><td></td></tr>
                <tr><td colSpan={4} className="text-right text-ink-500">GST</td><td className="text-right">{inr(totals.tax)}</td><td></td></tr>
                {discount > 0 && <tr><td colSpan={4} className="text-right text-ink-500">Discount</td><td className="text-right text-rbd-600">- {inr(discount)}</td><td></td></tr>}
                <tr><td colSpan={4} className="text-right font-bold">Total</td><td className="text-right font-extrabold">{inr(totals.total)}</td><td></td></tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </Modal>
  );
}

export default function Sales() {
  const toast = useToast();
  const { can } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(null);
  const [settings, setSettings] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const [s, st] = await Promise.all([api.get('/sales'), api.get('/settings')]);
      setItems(s); setSettings(st);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openInvoice = async (sale, mode = 'save') => {
    try {
      const full = await api.get(`/sales/${sale.id}`);
      await generateInvoicePDF(full, settings, mode);
    } catch (e) { toast.error(e.message); }
  };

  const remove = async s => {
    if (!confirm(`Delete invoice ${s.invoice_no}? Stock will be restored.`)) return;
    try { await api.delete(`/sales/${s.id}`); toast.success('Removed'); load(); }
    catch (e) { toast.error(e.message); }
  };

  const stats = useMemo(() => {
    const total = items.reduce((s, x) => s + x.total, 0);
    const due = items.reduce((s, x) => s + Math.max(0, x.total - x.paid), 0);
    return { total, due, count: items.length };
  }, [items]);

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="card card-pad"><div className="kpi-title">Total invoices</div><div className="kpi-value mt-1">{stats.count}</div></div>
        <div className="card card-pad"><div className="kpi-title">Total revenue</div><div className="kpi-value mt-1">{inr(stats.total)}</div></div>
        <div className="card card-pad"><div className="kpi-title">Outstanding</div><div className="kpi-value mt-1 text-rbd-700 dark:text-rbd-300">{inr(stats.due)}</div></div>
      </div>

      <div className="card card-pad">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div className="font-bold">Sales invoices</div>
          {can('admin', 'manager', 'staff') && (
            <button className="btn-primary" onClick={() => setOpen(true)}><Plus size={16} /> New sale</button>
          )}
        </div>
        <div className="overflow-x-auto -mx-2">
          <table className="table min-w-[900px]">
            <thead><tr><th>Invoice</th><th>Customer</th><th>Warehouse</th><th>Payment</th><th className="text-right">Total</th><th className="text-right">Paid</th><th className="text-right">Due</th><th></th></tr></thead>
            <tbody>
              {!loading && items.length === 0 && <tr><td colSpan={8}><EmptyState icon={Receipt} title="No invoices yet" description="Create your first sale to get started." /></td></tr>}
              {items.map(s => (
                <tr key={s.id}>
                  <td>
                    <div className="font-mono text-sm font-semibold">{s.invoice_no}</div>
                    <div className="text-xs text-ink-500">{dt(s.created_at)}</div>
                  </td>
                  <td>{s.customer_name || <span className="text-ink-400">Walk-in</span>}</td>
                  <td>{s.warehouse_name}</td>
                  <td><span className="badge-slate capitalize">{s.payment_mode || '—'}</span></td>
                  <td className="text-right font-semibold">{inr(s.total)}</td>
                  <td className="text-right">{inr(s.paid)}</td>
                  <td className="text-right">
                    {s.total - s.paid > 0
                      ? <span className="badge-amber">{inr(s.total - s.paid)}</span>
                      : <span className="badge-green">Paid</span>}
                  </td>
                  <td className="text-right whitespace-nowrap">
                    <button className="btn-ghost !p-1.5" title="View" onClick={async () => setView(await api.get(`/sales/${s.id}`))}><Eye size={16} /></button>
                    <button className="btn-ghost !p-1.5" title="PDF" onClick={() => openInvoice(s, 'save')}><FileText size={16} /></button>
                    <button className="btn-ghost !p-1.5" title="Print" onClick={() => openInvoice(s, 'print')}><Printer size={16} /></button>
                    {can('admin') && (
                      <button className="btn-ghost !p-1.5 text-rbd-600" title="Delete" onClick={() => remove(s)}><Trash2 size={16} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <NewSaleModal open={open} onClose={() => setOpen(false)} onCreated={load} />

      <Modal open={!!view} onClose={() => setView(null)} title={view?.invoice_no} size="lg"
        footer={view && (
          <>
            <button className="btn-soft" onClick={() => setView(null)}>Close</button>
            <button className="btn-primary" onClick={() => generateInvoicePDF(view, settings, 'save')}>
              <FileText size={16} /> Download PDF
            </button>
          </>
        )}>
        {view && (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <div><div className="text-ink-500 text-xs uppercase tracking-wide">Customer</div><div className="font-semibold">{view.customer_name || 'Walk-in'}</div></div>
              <div><div className="text-ink-500 text-xs uppercase tracking-wide">Warehouse</div><div className="font-semibold">{view.warehouse_name}</div></div>
              <div><div className="text-ink-500 text-xs uppercase tracking-wide">Date</div><div className="font-semibold">{dt(view.created_at)}</div></div>
              <div><div className="text-ink-500 text-xs uppercase tracking-wide">Payment</div><div className="font-semibold capitalize">{view.payment_mode}</div></div>
            </div>
            <table className="table">
              <thead><tr><th>Item</th><th className="text-center">Qty</th><th className="text-right">Rate</th><th className="text-center">GST</th><th className="text-right">Total</th></tr></thead>
              <tbody>
                {view.items.map(it => (
                  <tr key={it.id}>
                    <td><div className="font-semibold">{it.product_name}</div><div className="text-xs text-ink-500">{it.sku}</div></td>
                    <td className="text-center">{it.quantity}</td>
                    <td className="text-right">{inr(it.unit_price)}</td>
                    <td className="text-center">{it.gst_rate}%</td>
                    <td className="text-right font-semibold">{inr(it.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div></div>
              <div className="space-y-1">
                <div className="flex justify-between"><span className="text-ink-500">Subtotal</span><span>{inr(view.subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-ink-500">GST</span><span>{inr(view.tax)}</span></div>
                {view.discount > 0 && <div className="flex justify-between"><span className="text-ink-500">Discount</span><span>- {inr(view.discount)}</span></div>}
                <div className="flex justify-between font-bold border-t border-ink-100 dark:border-ink-800 pt-1"><span>Total</span><span>{inr(view.total)}</span></div>
                <div className="flex justify-between text-ink-500"><span>Paid</span><span>{inr(view.paid)}</span></div>
                {view.total > view.paid && <div className="flex justify-between text-rbd-600 font-bold"><span>Balance due</span><span>{inr(view.total - view.paid)}</span></div>}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
