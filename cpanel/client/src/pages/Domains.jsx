import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Globe, ShieldCheck, Forward } from 'lucide-react';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import Modal from '../components/Modal.jsx';
import EmptyState from '../components/EmptyState.jsx';

const TYPE_TONE = { primary: 'badge-blue', addon: 'badge-green', subdomain: 'badge-amber', parked: 'badge-slate' };

export default function Domains() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try { setItems(await api.get('/domains')); }
    catch (e) { toast.error(e.message); }
  };
  useEffect(() => { load(); }, []);

  const grouped = useMemo(() => {
    const g = { primary: [], subdomain: [], addon: [], parked: [] };
    for (const d of items) g[d.type]?.push(d);
    return g;
  }, [items]);

  const create = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const fd = new FormData(e.target);
      await api.post('/domains', {
        name: fd.get('name'),
        type: fd.get('type'),
        document_root: fd.get('document_root') || null,
        redirects_to: fd.get('redirects_to') || null
      });
      toast.success('Domain added'); setCreating(false); load();
    } catch (err) { toast.error(err.message); }
    finally { setBusy(false); }
  };

  const remove = async (d) => {
    if (!confirm(`Delete domain ${d.name}?`)) return;
    try { await api.delete(`/domains/${d.id}`); toast.success('Removed'); load(); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-4 gap-3">
        <Kpi label="Primary"    value={grouped.primary.length} />
        <Kpi label="Subdomains" value={grouped.subdomain.length} />
        <Kpi label="Addon"      value={grouped.addon.length} />
        <Kpi label="Parked"     value={grouped.parked.length} />
      </div>

      <div className="card">
        <div className="flex items-center justify-between p-4 border-b border-ink-100 dark:border-ink-800">
          <h2 className="font-bold flex items-center gap-2"><Globe size={16} className="text-brand-600" /> Domains</h2>
          <button className="btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> Add domain</button>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>Domain</th><th>Type</th><th>Document root</th><th>Redirect</th><th>SSL</th><th></th></tr></thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan={6}><EmptyState icon={Globe} title="No domains" /></td></tr>}
              {items.map(d => (
                <tr key={d.id}>
                  <td className="font-mono font-semibold">{d.name}</td>
                  <td><span className={TYPE_TONE[d.type] || 'badge-slate'}>{d.type}</span></td>
                  <td className="font-mono text-xs">{d.document_root}</td>
                  <td className="font-mono text-xs">{d.redirects_to ? <><Forward size={12} className="inline -mt-0.5 mr-1" />{d.redirects_to}</> : '—'}</td>
                  <td>
                    {d.has_ssl
                      ? <span className="badge-green"><ShieldCheck size={12} /> Active</span>
                      : <a href="/ssl" className="badge-slate hover:bg-ink-200">Install</a>}
                  </td>
                  <td className="text-right">
                    {d.type !== 'primary' && (
                      <button className="btn-ghost !p-1.5 text-rose-600" onClick={() => remove(d)}><Trash2 size={14} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={creating} onClose={() => setCreating(false)} title="Add domain"
        footer={<>
          <button className="btn-soft" onClick={() => setCreating(false)}>Cancel</button>
          <button form="dom-form" type="submit" disabled={busy} className="btn-primary">{busy ? 'Adding…' : 'Add'}</button>
        </>}>
        <form id="dom-form" onSubmit={create} className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2"><label className="label">Domain *</label>
            <input className="input font-mono" name="name" required placeholder="example.com" />
          </div>
          <div><label className="label">Type</label>
            <select className="select" name="type" defaultValue="addon">
              <option value="addon">Addon</option>
              <option value="subdomain">Subdomain</option>
              <option value="parked">Parked / Alias</option>
            </select>
          </div>
          <div><label className="label">Document root (optional)</label>
            <input className="input font-mono" name="document_root" placeholder="/home/demo/example" />
          </div>
          <div className="sm:col-span-2"><label className="label">Redirect to (optional)</label>
            <input className="input font-mono" name="redirects_to" placeholder="https://other.example.com" />
          </div>
        </form>
      </Modal>
    </div>
  );
}

function Kpi({ label, value }) {
  return <div className="card card-pad"><div className="kpi-title">{label}</div><div className="kpi-value mt-1">{value}</div></div>;
}
