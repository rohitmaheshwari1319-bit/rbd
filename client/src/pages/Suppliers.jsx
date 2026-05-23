import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Search, Truck } from 'lucide-react';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import Modal from '../components/Modal.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { inr } from '../lib/format.js';

const empty = { name: '', phone: '', email: '', gstin: '', address: '' };

export default function Suppliers() {
  const toast = useToast();
  const { can } = useAuth();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [editor, setEditor] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try { setItems(await api.get(`/suppliers${q ? `?q=${encodeURIComponent(q)}` : ''}`)); }
    catch (e) { toast.error(e.message); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [q]);

  const save = async e => {
    e.preventDefault(); setBusy(true);
    try {
      if (editor.id) await api.patch(`/suppliers/${editor.id}`, editor);
      else await api.post('/suppliers', editor);
      toast.success('Saved'); setEditor(null); load();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const remove = async s => {
    if (!confirm(`Delete supplier "${s.name}"?`)) return;
    try { await api.delete(`/suppliers/${s.id}`); toast.success('Removed'); load(); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="card card-pad flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input className="input pl-9" placeholder="Search suppliers…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        {can('admin', 'manager') && (
          <button className="btn-primary ml-auto" onClick={() => setEditor({ ...empty })}>
            <Plus size={16} /> Add supplier
          </button>
        )}
      </div>

      <div className="card card-pad">
        <div className="overflow-x-auto -mx-2">
          <table className="table min-w-[800px]">
            <thead><tr><th>Supplier</th><th>Contact</th><th>GSTIN</th><th className="text-right">Total purchases</th><th></th></tr></thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan={5}><EmptyState icon={Truck} title="No suppliers yet" /></td></tr>}
              {items.map(s => (
                <tr key={s.id}>
                  <td>
                    <div className="font-semibold">{s.name}</div>
                    <div className="text-xs text-ink-500 dark:text-ink-400">{s.address || '—'}</div>
                  </td>
                  <td>
                    <div>{s.phone || '—'}</div>
                    <div className="text-xs text-ink-500 dark:text-ink-400">{s.email || '—'}</div>
                  </td>
                  <td className="font-mono text-xs">{s.gstin || '—'}</td>
                  <td className="text-right font-semibold">{inr(s.total_purchases)}</td>
                  <td className="text-right whitespace-nowrap">
                    {can('admin', 'manager') && (
                      <>
                        <button className="btn-ghost !p-1.5" onClick={() => setEditor(s)}><Pencil size={16} /></button>
                        <button className="btn-ghost !p-1.5 text-rbd-600" onClick={() => remove(s)}><Trash2 size={16} /></button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!editor} onClose={() => setEditor(null)} title={editor?.id ? 'Edit supplier' : 'New supplier'}
        footer={
          <>
            <button className="btn-soft" onClick={() => setEditor(null)}>Cancel</button>
            <button className="btn-primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
          </>
        }>
        {editor && (
          <form onSubmit={save} className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2"><label className="label">Name *</label><input className="input" required value={editor.name} onChange={e => setEditor({ ...editor, name: e.target.value })} /></div>
            <div><label className="label">Phone</label><input className="input" value={editor.phone || ''} onChange={e => setEditor({ ...editor, phone: e.target.value })} /></div>
            <div><label className="label">Email</label><input className="input" type="email" value={editor.email || ''} onChange={e => setEditor({ ...editor, email: e.target.value })} /></div>
            <div><label className="label">GSTIN</label><input className="input" value={editor.gstin || ''} onChange={e => setEditor({ ...editor, gstin: e.target.value })} /></div>
            <div className="sm:col-span-2"><label className="label">Address</label><textarea className="textarea" rows={2} value={editor.address || ''} onChange={e => setEditor({ ...editor, address: e.target.value })} /></div>
          </form>
        )}
      </Modal>
    </div>
  );
}
