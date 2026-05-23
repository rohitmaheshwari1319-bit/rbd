import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus, Search, Pencil, Download, Upload, Barcode as BarcodeIcon,
  Package, Trash2, RefreshCw
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import Modal from '../components/Modal.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { Barcode, QR } from '../components/Barcode.jsx';
import { inr, num } from '../lib/format.js';

const empty = {
  sku: '', barcode: '', name: '', description: '', hsn_code: '', unit: 'pcs',
  purchase_price: 0, selling_price: 0, gst_rate: 18, reorder_level: 5, category_id: ''
};

export default function Products() {
  const toast = useToast();
  const { can } = useAuth();
  const [items, setItems] = useState([]);
  const [cats, setCats] = useState([]);
  const [q, setQ] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterLow, setFilterLow] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState(null); // null = closed, {} = new, object = edit
  const [busy, setBusy] = useState(false);
  const [labelFor, setLabelFor] = useState(null); // product to print barcode/QR

  const load = async () => {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([
        api.get(`/products?limit=500${q ? `&q=${encodeURIComponent(q)}` : ''}${filterCat ? `&category_id=${filterCat}` : ''}${filterLow ? '&low_stock=1' : ''}`),
        api.get('/categories')
      ]);
      setItems(a); setCats(b);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [q, filterCat, filterLow]);

  const save = async e => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = {
        ...editor,
        category_id: editor.category_id ? Number(editor.category_id) : null,
        purchase_price: Number(editor.purchase_price) || 0,
        selling_price: Number(editor.selling_price) || 0,
        gst_rate: Number(editor.gst_rate) || 0,
        reorder_level: Number(editor.reorder_level) || 0
      };
      if (editor.id) await api.patch(`/products/${editor.id}`, body);
      else await api.post('/products', body);
      toast.success(editor.id ? 'Product updated' : 'Product created');
      setEditor(null); load();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const remove = async p => {
    if (!confirm(`Remove "${p.name}"?`)) return;
    try { await api.delete(`/products/${p.id}`); toast.success('Removed'); load(); }
    catch (e) { toast.error(e.message); }
  };

  const exportExcel = () => {
    const rows = items.map(p => ({
      SKU: p.sku, Barcode: p.barcode, Name: p.name, Category: p.category_name || '',
      HSN: p.hsn_code || '', Unit: p.unit, Purchase: p.purchase_price, Selling: p.selling_price,
      GST: p.gst_rate, Reorder: p.reorder_level, Stock: p.stock_qty
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    XLSX.writeFile(wb, `RBD-products-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success('Exported to Excel');
  };

  const importExcel = async e => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws);
      const items = rows.map(r => ({
        sku: r.SKU || r.sku, name: r.Name || r.name, hsn_code: r.HSN || r.hsn_code,
        unit: r.Unit || r.unit || 'pcs',
        purchase_price: r.Purchase ?? r.purchase_price ?? 0,
        selling_price: r.Selling ?? r.selling_price ?? 0,
        gst_rate: r.GST ?? r.gst_rate ?? 18,
        reorder_level: r.Reorder ?? r.reorder_level ?? 5
      })).filter(i => i.sku && i.name);
      const r = await api.post('/products/bulk', { items });
      toast.success(`Imported ${r.imported} products`);
      load();
    } catch (e) { toast.error(e.message || 'Import failed'); }
  };

  const stats = useMemo(() => ({
    total: items.length,
    low: items.filter(p => p.stock_qty <= p.reorder_level).length,
    value: items.reduce((s, p) => s + p.stock_qty * p.purchase_price, 0)
  }), [items]);

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="card card-pad">
          <div className="kpi-title">Total products</div>
          <div className="kpi-value mt-1">{stats.total}</div>
        </div>
        <div className="card card-pad">
          <div className="kpi-title">Low stock items</div>
          <div className="kpi-value mt-1 text-rbd-700 dark:text-rbd-300">{stats.low}</div>
        </div>
        <div className="card card-pad">
          <div className="kpi-title">Stock value</div>
          <div className="kpi-value mt-1">{inr(stats.value)}</div>
        </div>
      </div>

      <div className="card card-pad space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input className="input pl-9" placeholder="Search by name, SKU, barcode…"
                   value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <select className="select max-w-[200px]" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
            <option value="">All categories</option>
            {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm font-medium px-2">
            <input type="checkbox" checked={filterLow} onChange={e => setFilterLow(e.target.checked)} />
            Only low stock
          </label>
          <button onClick={load} className="btn-ghost" title="Refresh"><RefreshCw size={16} /></button>
          <div className="ml-auto flex flex-wrap gap-2">
            <button className="btn-soft" onClick={exportExcel}><Download size={16} /> Export</button>
            {can('admin', 'manager') && (
              <>
                <label className="btn-soft cursor-pointer">
                  <Upload size={16} /> Import
                  <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={importExcel} />
                </label>
                <button className="btn-primary" onClick={() => setEditor({ ...empty })}>
                  <Plus size={16} /> Add product
                </button>
              </>
            )}
          </div>
        </div>

        <div className="overflow-x-auto -mx-2">
          <table className="table min-w-[900px]">
            <thead>
              <tr>
                <th>Product</th><th>SKU / Barcode</th><th>Category</th>
                <th className="text-right">Purchase</th><th className="text-right">Selling</th>
                <th className="text-center">GST</th>
                <th className="text-right">Stock</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={8} className="!py-3"><div className="h-4 rounded bg-ink-100 dark:bg-ink-800 animate-pulse" /></td></tr>
              ))}
              {!loading && items.length === 0 && (
                <tr><td colSpan={8}><EmptyState icon={Package} title="No products yet" description="Add your first product to start managing inventory." /></td></tr>
              )}
              {items.map(p => (
                <tr key={p.id}>
                  <td>
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-xs text-ink-500 dark:text-ink-400">{p.unit} · HSN {p.hsn_code || '—'}</div>
                  </td>
                  <td>
                    <div className="text-sm font-mono">{p.sku}</div>
                    <div className="text-xs text-ink-500 dark:text-ink-400 font-mono">{p.barcode || '—'}</div>
                  </td>
                  <td>{p.category_name ? <span className="badge-slate">{p.category_name}</span> : <span className="text-ink-400">—</span>}</td>
                  <td className="text-right">{inr(p.purchase_price)}</td>
                  <td className="text-right font-semibold">{inr(p.selling_price)}</td>
                  <td className="text-center"><span className="badge-slate">{p.gst_rate}%</span></td>
                  <td className="text-right">
                    <span className={p.stock_qty <= p.reorder_level ? 'badge-red' : 'badge-green'}>
                      {num(p.stock_qty)}
                    </span>
                  </td>
                  <td className="text-right whitespace-nowrap">
                    <button className="btn-ghost !p-1.5" title="Barcode / QR"
                            onClick={() => setLabelFor(p)}><BarcodeIcon size={16} /></button>
                    {can('admin', 'manager') && (
                      <>
                        <button className="btn-ghost !p-1.5" title="Edit" onClick={() => setEditor(p)}>
                          <Pencil size={16} />
                        </button>
                        <button className="btn-ghost !p-1.5 text-rbd-600" title="Remove" onClick={() => remove(p)}>
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!editor} onClose={() => setEditor(null)} title={editor?.id ? 'Edit product' : 'New product'} size="lg"
        footer={
          <>
            <button className="btn-soft" onClick={() => setEditor(null)}>Cancel</button>
            <button className="btn-primary" disabled={busy} onClick={save} type="submit">
              {busy ? 'Saving…' : 'Save product'}
            </button>
          </>
        }>
        {editor && (
          <form onSubmit={save} className="grid sm:grid-cols-2 gap-4">
            <div><label className="label">SKU *</label><input className="input" required value={editor.sku} onChange={e => setEditor({ ...editor, sku: e.target.value })} /></div>
            <div><label className="label">Barcode</label><input className="input" value={editor.barcode || ''} onChange={e => setEditor({ ...editor, barcode: e.target.value })} placeholder="auto-generated if blank" /></div>
            <div className="sm:col-span-2"><label className="label">Name *</label><input className="input" required value={editor.name} onChange={e => setEditor({ ...editor, name: e.target.value })} /></div>
            <div><label className="label">Category</label>
              <select className="select" value={editor.category_id || ''} onChange={e => setEditor({ ...editor, category_id: e.target.value })}>
                <option value="">Uncategorized</option>
                {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div><label className="label">HSN</label><input className="input" value={editor.hsn_code || ''} onChange={e => setEditor({ ...editor, hsn_code: e.target.value })} /></div>
            <div><label className="label">Unit</label><input className="input" value={editor.unit || 'pcs'} onChange={e => setEditor({ ...editor, unit: e.target.value })} /></div>
            <div><label className="label">Reorder level</label><input className="input" type="number" value={editor.reorder_level ?? 5} onChange={e => setEditor({ ...editor, reorder_level: e.target.value })} /></div>
            <div><label className="label">Purchase price (₹)</label><input className="input" type="number" step="0.01" value={editor.purchase_price ?? 0} onChange={e => setEditor({ ...editor, purchase_price: e.target.value })} /></div>
            <div><label className="label">Selling price (₹)</label><input className="input" type="number" step="0.01" value={editor.selling_price ?? 0} onChange={e => setEditor({ ...editor, selling_price: e.target.value })} /></div>
            <div><label className="label">GST %</label><input className="input" type="number" step="0.01" value={editor.gst_rate ?? 18} onChange={e => setEditor({ ...editor, gst_rate: e.target.value })} /></div>
            <div className="sm:col-span-2"><label className="label">Description</label><textarea className="textarea" rows={2} value={editor.description || ''} onChange={e => setEditor({ ...editor, description: e.target.value })} /></div>
          </form>
        )}
      </Modal>

      <Modal open={!!labelFor} onClose={() => setLabelFor(null)} title={labelFor ? `Labels — ${labelFor.name}` : ''} size="md"
        footer={<button className="btn-primary" onClick={() => window.print()}>Print</button>}>
        {labelFor && (
          <div className="text-center space-y-4">
            <div className="text-xs uppercase tracking-wider text-ink-500">RBD · {labelFor.sku}</div>
            <div className="flex justify-center"><Barcode value={labelFor.barcode || labelFor.sku} /></div>
            <div className="flex justify-center"><QR value={labelFor.barcode || labelFor.sku} size={128} /></div>
            <div className="font-semibold">{labelFor.name}</div>
            <div className="text-sm text-ink-500 dark:text-ink-400">{inr(labelFor.selling_price)} · GST {labelFor.gst_rate}%</div>
          </div>
        )}
      </Modal>
    </div>
  );
}
