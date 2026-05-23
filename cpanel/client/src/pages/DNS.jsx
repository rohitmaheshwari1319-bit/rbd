import React, { useEffect, useState } from 'react';
import { Plus, Trash2, ScrollText, Pencil } from 'lucide-react';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import Modal from '../components/Modal.jsx';
import EmptyState from '../components/EmptyState.jsx';

const TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA'];

export default function DNS() {
  const toast = useToast();
  const [zones, setZones] = useState([]);
  const [zone, setZone] = useState('');
  const [records, setRecords] = useState([]);
  const [editor, setEditor] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/dns/zones').then(z => { setZones(z); if (z[0]) setZone(z[0]); })
      .catch(e => toast.error(e.message));
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (!zone) return;
    api.get(`/dns/records?zone=${encodeURIComponent(zone)}`).then(setRecords)
      .catch(e => toast.error(e.message));
    // eslint-disable-next-line
  }, [zone]);

  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const fd = new FormData(e.target);
      const body = {
        zone,
        name: fd.get('name'),
        type: fd.get('type'),
        value: fd.get('value'),
        ttl: Number(fd.get('ttl')) || 14400,
        priority: fd.get('priority') ? Number(fd.get('priority')) : null
      };
      if (editor?.id) await api.patch(`/dns/records/${editor.id}`, body);
      else await api.post('/dns/records', body);
      toast.success('Record saved'); setEditor(null);
      setRecords(await api.get(`/dns/records?zone=${encodeURIComponent(zone)}`));
    } catch (err) { toast.error(err.message); }
    finally { setBusy(false); }
  };

  const remove = async (r) => {
    if (!confirm(`Delete ${r.type} record ${r.name}?`)) return;
    try {
      await api.delete(`/dns/records/${r.id}`);
      toast.success('Removed');
      setRecords(await api.get(`/dns/records?zone=${encodeURIComponent(zone)}`));
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="card card-pad flex flex-wrap items-center gap-3">
        <ScrollText className="text-brand-600" />
        <div>
          <div className="font-bold">DNS Zone Editor</div>
          <div className="text-sm text-ink-500 dark:text-ink-400">Manage A, AAAA, CNAME, MX, TXT, NS, SRV and CAA records.</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <select className="select max-w-[280px]" value={zone} onChange={e => setZone(e.target.value)}>
            {zones.map(z => <option key={z} value={z}>{z}</option>)}
          </select>
          <button className="btn-primary" onClick={() => setEditor({ ttl: 14400, type: 'A' })}>
            <Plus size={16} /> Add record
          </button>
        </div>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>Name</th><th>Type</th><th>Value</th><th>TTL</th><th>Priority</th><th></th></tr></thead>
            <tbody>
              {records.length === 0 && <tr><td colSpan={6}><EmptyState icon={ScrollText} title="No records yet" /></td></tr>}
              {records.map(r => (
                <tr key={r.id}>
                  <td className="font-mono font-semibold">{r.name}</td>
                  <td><span className="badge-blue">{r.type}</span></td>
                  <td className="font-mono text-xs break-all">{r.value}</td>
                  <td className="font-mono text-xs">{r.ttl}</td>
                  <td className="font-mono text-xs">{r.priority ?? '—'}</td>
                  <td className="text-right whitespace-nowrap">
                    <button className="btn-ghost !p-1.5" onClick={() => setEditor(r)}><Pencil size={14} /></button>
                    <button className="btn-ghost !p-1.5 text-rose-600" onClick={() => remove(r)}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!editor} onClose={() => setEditor(null)} title={editor?.id ? 'Edit record' : 'Add DNS record'}
        footer={<>
          <button className="btn-soft" onClick={() => setEditor(null)}>Cancel</button>
          <button form="dns-form" type="submit" disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Save'}</button>
        </>}>
        {editor && (
          <form id="dns-form" onSubmit={save} className="grid sm:grid-cols-2 gap-3">
            <div><label className="label">Name *</label>
              <input className="input font-mono" name="name" required defaultValue={editor.name || '@'} />
            </div>
            <div><label className="label">Type *</label>
              <select className="select" name="type" defaultValue={editor.type || 'A'}>
                {TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2"><label className="label">Value *</label>
              <input className="input font-mono" name="value" required defaultValue={editor.value || ''}
                     placeholder="192.0.2.10 or v=spf1 include:_spf.example.com ~all" />
            </div>
            <div><label className="label">TTL (seconds)</label>
              <input className="input" name="ttl" type="number" defaultValue={editor.ttl ?? 14400} />
            </div>
            <div><label className="label">Priority (MX/SRV)</label>
              <input className="input" name="priority" type="number" defaultValue={editor.priority ?? ''} />
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
