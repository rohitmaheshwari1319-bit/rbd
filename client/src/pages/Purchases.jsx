import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Trash2, Eye, ShoppingCart } from 'lucide-react';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import Modal from '../components/Modal.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { inr, dt } from '../lib/format.js';

function NewPurchaseModal({ open, onClose, onCreated }) {
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [supplier_id, setSupplierId] = useState('');
  const [warehouse_id, setWarehouseId] = useState('');
  const [paid, setPaid] = useState(0);
  const [note, setNote] = useState('');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    Promise.all([
      api.get('/products?limit=500'), api.get('/warehouses'), api.get('/suppliers')
    ]).then(([p, w, s]) => {
      setProducts(p); setWarehouses(w); setSuppliers(s);
      if (w[0] && !warehouse_id) setWarehouseId(w[0].id);
    }).catch(e => toast.error(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const filtered = useMemo(() => {
    if (!search) return [];
    const s = search.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s)).slice(0, 8);
  }, [search, products]);

  const addItem = (p) => {
    setItems(prev => {
      const existing = prev.find(i => i.product_id === p.id);
      if (existing) return prev.map(i => i.product_id === p.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product_id: p.id, name: p.name, sku: p.sku, quantity: 1, unit_price: p.purchase_price, gst_rate: p.gst_rate }];
    });
    setSearch('');
  };

  const totals = useMemo(() => {
    let sub = 0, tax = 0;
    for (const it of items) {
      const s = it.quantity * it.unit_price;
      sub += s; tax += s * (it.gst_rate / 100);
    }
    return { sub, tax, total: sub + tax };
  }, [items]);

  const submit = async () => {
    if (!warehouse_id) return toast.error('Select a warehouse');
    if (items.length === 0) return toast.error('Add at least one item');
    setBusy(true);
    try {
      const r = await api.post('/purchases', {
        warehouse_id: Number(warehouse_id),
        supplier_id: supplier_id ? Number(supplier_id) : null,
        items: items.map(i => ({ product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price, gst_rate: i.gst_rate })),
        paid: Number(paid) || 0, note
      });
      toast.success(`Purchase ${r.reference} created`);
      onCreated?.(r.id); onClose();
      setItems([]); setSupplierId(''); setPaid(0); setNote('');
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="New purchase order" size="xl"
      footer={
        <>
          <div className="mr-auto text-sm">Total: <span className="font-extrabold text-lg ml-1">{inr(totals.total)}</span></div>
          <button className="btn-soft" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy || items.length === 0} onClick={submit}>{busy ? 'Saving…' : 'Create PO'}</button>
        </>
      }>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div><label className="label">Warehouse</label>
            <select className="select" value={warehouse_id} onChange={e => setWarehouseId(e.target.value)}>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div><label className="label">Supplier</label>
            <select className="select" value={supplier_id} onChange={e => setSupplierId(e.target.value)}>
              <option value="">Select supplier (optional)</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div><label className="label">Add items</label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input className="input pl-9" placeholder="Search by name or SKU…" value={search} onChange={e => setSearch(e.target.value)} />
              {filtered.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 rounded-lg shadow-card overflow-hidden">
                  {filtered.map(p => (
                    <li key={p.id} className="px-3 py-2 text-sm hover:bg-ink-50 dark:hover:bg-ink-800 cursor-pointer flex items-center justify-between"
                        onClick={() => addItem(p)}>
                      <div>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-ink-500">{p.sku}</div>
                      </div>
                      <span className="font-semibold">{inr(p.purchase_price)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Paid (₹)</label>
              <input className="input" type="number" value={paid} onChange={e => setPaid(e.target.value)} />
            </div>
            <div><label className="label">Note</label>
              <input className="input" value={note} onChange={e => setNote(e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto -mx-2">
        <table className="table min-w-[700px]">
          <thead><tr><th>Item</th><th className="text-center">Qty</th><th className="text-right">Cost</th><th className="text-center">GST%</th><th className="text-right">Total</th><th></th></tr></thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={6} className="!py-6 text-center text-ink-500">Search and add products to receive stock.</td></tr>}
            {items.map((it, idx) => {
              const sub = it.quantity * it.unit_price;
              const total = sub * (1 + it.gst_rate / 100);
              return (
                <tr key={it.product_id}>
                  <td><div className="font-semibold">{it.name}</div><div className="text-xs text-ink-500">{it.sku}</div></td>
                  <td className="text-center"><input type="number" min="1" className="input !py-1 w-20 text-center" value={it.quantity}
                       onChange={e => setItems(arr => arr.map((x, i) => i === idx ? { ...x, quantity: Number(e.target.value) || 1 } : x))} /></td>
                  <td className="text-right"><input type="number" className="input !py-1 w-24 text-right" value={it.unit_price}
                       onChange={e => setItems(arr => arr.map((x, i) => i === idx ? { ...x, unit_price: Number(e.target.value) || 0 } : x))} /></td>
                  <td className="text-center"><input type="number" className="input !py-1 w-16 text-center" value={it.gst_rate}
                       onChange={e => setItems(arr => arr.map((x, i) => i === idx ? { ...x, gst_rate: Number(e.target.value) || 0 } : x))} /></td>
                  <td className="text-right font-semibold">{inr(total)}</td>
                  <td className="text-right"><button className="btn-ghost !p-1.5 text-rbd-600" onClick={() => setItems(arr => arr.filter((_, i) => i !== idx))}><Trash2 size={14} /></button></td>
                </tr>
              );
            })}
          </tbody>
          {items.length > 0 && (
            <tfoot className="text-sm">
              <tr><td colSpan={4} className="text-right text-ink-500">Subtotal</td><td className="text-right">{inr(totals.sub)}</td><td></td></tr>
              <tr><td colSpan={4} className="text-right text-ink-500">GST</td><td className="text-right">{inr(totals.tax)}</td><td></td></tr>
              <tr><td colSpan={4} className="text-right font-bold">Total</td><td className="text-right font-extrabold">{inr(totals.total)}</td><td></td></tr>
            </tfoot>
          )}
        </table>
      </div>
    </Modal>
  );
}

export default function Purchases() {
  const toast = useToast();
  const { can } = useAuth();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(null);

  const load = async () => {
    try { setItems(await api.get('/purchases')); }
    catch (e) { toast.error(e.message); }
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4">
      <div className="card card-pad flex items-center justify-between">
        <div>
          <div className="font-bold">Purchase orders</div>
          <div className="text-sm text-ink-500 dark:text-ink-400">Receive stock from suppliers and track pending payments.</div>
        </div>
        {can('admin', 'manager') && <button className="btn-primary" onClick={() => setOpen(true)}><Plus size={16} /> New purchase</button>}
      </div>

      <div className="card card-pad">
        <div className="overflow-x-auto -mx-2">
          <table className="table min-w-[900px]">
            <thead><tr><th>Reference</th><th>Supplier</th><th>Warehouse</th><th className="text-right">Subtotal</th><th className="text-right">Tax</th><th className="text-right">Total</th><th className="text-right">Paid</th><th></th></tr></thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan={8}><EmptyState icon={ShoppingCart} title="No purchase orders yet" /></td></tr>}
              {items.map(p => (
                <tr key={p.id}>
                  <td>
                    <div className="font-mono text-sm font-semibold">{p.reference}</div>
                    <div className="text-xs text-ink-500">{dt(p.created_at)}</div>
                  </td>
                  <td>{p.supplier_name || <span className="text-ink-400">—</span>}</td>
                  <td>{p.warehouse_name}</td>
                  <td className="text-right">{inr(p.subtotal)}</td>
                  <td className="text-right">{inr(p.tax)}</td>
                  <td className="text-right font-semibold">{inr(p.total)}</td>
                  <td className="text-right">
                    {p.paid >= p.total ? <span className="badge-green">Paid</span> : <span className="badge-amber">{inr(p.paid)} / {inr(p.total)}</span>}
                  </td>
                  <td className="text-right">
                    <button className="btn-ghost !p-1.5" onClick={async () => setView(await api.get(`/purchases/${p.id}`))}><Eye size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <NewPurchaseModal open={open} onClose={() => setOpen(false)} onCreated={load} />

      <Modal open={!!view} onClose={() => setView(null)} title={view?.reference} size="lg">
        {view && (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <div><div className="text-ink-500 text-xs uppercase tracking-wide">Supplier</div><div className="font-semibold">{view.supplier_name || '—'}</div></div>
              <div><div className="text-ink-500 text-xs uppercase tracking-wide">Warehouse</div><div className="font-semibold">{view.warehouse_name}</div></div>
            </div>
            <table className="table">
              <thead><tr><th>Item</th><th className="text-center">Qty</th><th className="text-right">Cost</th><th className="text-center">GST</th><th className="text-right">Total</th></tr></thead>
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
          </div>
        )}
      </Modal>
    </div>
  );
}
