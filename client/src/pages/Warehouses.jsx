import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Repeat, Warehouse as WHIcon } from 'lucide-react';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import Modal from '../components/Modal.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { inr, num } from '../lib/format.js';

const empty = { code: '', name: '', address: '', manager: '', phone: '' };

export default function Warehouses() {
  const toast = useToast();
  const { can } = useAuth();
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [editor, setEditor] = useState(null);
  const [transfer, setTransfer] = useState(null); // { product_id, from_warehouse_id, to_warehouse_id, quantity, note }
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [w, p] = await Promise.all([api.get('/warehouses'), api.get('/products?limit=500')]);
      setItems(w); setProducts(p);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const save = async e => {
    e.preventDefault(); setBusy(true);
    try {
      if (editor.id) await api.patch(`/warehouses/${editor.id}`, editor);
      else await api.post('/warehouses', editor);
      toast.success('Warehouse saved');
      setEditor(null); load();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const remove = async w => {
    if (!confirm(`Delete warehouse "${w.name}"? Stock records will be removed.`)) return;
    try { await api.delete(`/warehouses/${w.id}`); toast.success('Removed'); load(); }
    catch (e) { toast.error(e.message); }
  };

  const submitTransfer = async e => {
    e.preventDefault(); setBusy(true);
    try {
      await api.post('/warehouses/transfer', {
        product_id: Number(transfer.product_id),
        from_warehouse_id: Number(transfer.from_warehouse_id),
        to_warehouse_id: Number(transfer.to_warehouse_id),
        quantity: Number(transfer.quantity),
        note: transfer.note
      });
      toast.success('Stock transferred');
      setTransfer(null); load();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="card card-pad flex flex-wrap items-center gap-3">
        <div>
          <div className="font-bold">Warehouses</div>
          <div className="text-sm text-ink-500 dark:text-ink-400">Multi-location stock with transfer support.</div>
        </div>
        <div className="ml-auto flex gap-2">
          {can('admin', 'manager') && (
            <>
              <button className="btn-soft" onClick={() => setTransfer({ product_id: '', from_warehouse_id: '', to_warehouse_id: '', quantity: 1, note: '' })}>
                <Repeat size={16} /> Transfer stock
              </button>
              <button className="btn-primary" onClick={() => setEditor({ ...empty })}>
                <Plus size={16} /> Add warehouse
              </button>
            </>
          )}
        </div>
      </div>

      {!loading && items.length === 0 && (
        <div className="card card-pad"><EmptyState icon={WHIcon} title="No warehouses yet" /></div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(w => (
          <div key={w.id} className="card card-pad">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs font-mono text-rbd-600">{w.code}</div>
                <div className="font-bold text-lg leading-tight">{w.name}</div>
                <div className="text-sm text-ink-500 dark:text-ink-400 mt-1">{w.address || '—'}</div>
                {w.manager && (
                  <div className="text-xs text-ink-500 dark:text-ink-400 mt-1">
                    Manager: {w.manager} · {w.phone || '—'}
                  </div>
                )}
              </div>
              <div className="h-10 w-10 rounded-xl bg-rbd-50 text-rbd-600 dark:bg-rbd-900/30 dark:text-rbd-300 grid place-items-center">
                <WHIcon size={20} />
              </div>
            </div>
            <hr className="my-3 border-ink-100 dark:border-ink-800" />
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-ink-500 dark:text-ink-400 text-xs uppercase tracking-wide">Units</div>
                <div className="font-bold text-lg">{num(w.total_units)}</div>
              </div>
              <div>
                <div className="text-ink-500 dark:text-ink-400 text-xs uppercase tracking-wide">Stock value</div>
                <div className="font-bold text-lg">{inr(w.stock_value)}</div>
              </div>
            </div>
            {can('admin', 'manager') && (
              <div className="flex gap-1 justify-end mt-3">
                <button className="btn-ghost !p-1.5" onClick={() => setEditor(w)}><Pencil size={16} /></button>
                <button className="btn-ghost !p-1.5 text-rbd-600" onClick={() => remove(w)}><Trash2 size={16} /></button>
              </div>
            )}
          </div>
        ))}
      </div>

      <Modal open={!!editor} onClose={() => setEditor(null)} title={editor?.id ? 'Edit warehouse' : 'New warehouse'}
        footer={
          <>
            <button className="btn-soft" onClick={() => setEditor(null)}>Cancel</button>
            <button className="btn-primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
          </>
        }>
        {editor && (
          <form onSubmit={save} className="grid sm:grid-cols-2 gap-4">
            <div><label className="label">Code *</label><input className="input" required value={editor.code} onChange={e => setEditor({ ...editor, code: e.target.value })} /></div>
            <div><label className="label">Name *</label><input className="input" required value={editor.name} onChange={e => setEditor({ ...editor, name: e.target.value })} /></div>
            <div className="sm:col-span-2"><label className="label">Address</label><textarea className="textarea" rows={2} value={editor.address || ''} onChange={e => setEditor({ ...editor, address: e.target.value })} /></div>
            <div><label className="label">Manager</label><input className="input" value={editor.manager || ''} onChange={e => setEditor({ ...editor, manager: e.target.value })} /></div>
            <div><label className="label">Phone</label><input className="input" value={editor.phone || ''} onChange={e => setEditor({ ...editor, phone: e.target.value })} /></div>
          </form>
        )}
      </Modal>

      <Modal open={!!transfer} onClose={() => setTransfer(null)} title="Transfer stock between warehouses"
        footer={
          <>
            <button className="btn-soft" onClick={() => setTransfer(null)}>Cancel</button>
            <button className="btn-primary" disabled={busy} onClick={submitTransfer}>{busy ? 'Transferring…' : 'Transfer'}</button>
          </>
        }>
        {transfer && (
          <form onSubmit={submitTransfer} className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2"><label className="label">Product</label>
              <select className="select" required value={transfer.product_id} onChange={e => setTransfer({ ...transfer, product_id: e.target.value })}>
                <option value="">Choose product…</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
              </select>
            </div>
            <div><label className="label">From warehouse</label>
              <select className="select" required value={transfer.from_warehouse_id} onChange={e => setTransfer({ ...transfer, from_warehouse_id: e.target.value })}>
                <option value="">Choose…</option>{items.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div><label className="label">To warehouse</label>
              <select className="select" required value={transfer.to_warehouse_id} onChange={e => setTransfer({ ...transfer, to_warehouse_id: e.target.value })}>
                <option value="">Choose…</option>{items.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div><label className="label">Quantity</label><input className="input" type="number" min="1" required value={transfer.quantity} onChange={e => setTransfer({ ...transfer, quantity: e.target.value })} /></div>
            <div><label className="label">Note</label><input className="input" value={transfer.note || ''} onChange={e => setTransfer({ ...transfer, note: e.target.value })} /></div>
          </form>
        )}
      </Modal>
    </div>
  );
}
