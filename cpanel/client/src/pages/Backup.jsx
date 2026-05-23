import React, { useEffect, useState } from 'react';
import { FileArchive, Download, Trash2, Plus, Database, Mail, FolderArchive, Server } from 'lucide-react';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { dt } from '../lib/format.js';

const TYPES = [
  { type: 'full',      label: 'Full backup',      icon: Server,        desc: 'Files + databases + email' },
  { type: 'home',      label: 'Home directory',   icon: FolderArchive, desc: 'All files under /home' },
  { type: 'databases', label: 'Databases only',   icon: Database,      desc: 'All MySQL databases' },
  { type: 'email',     label: 'Email only',       icon: Mail,          desc: 'Mailboxes and forwarders' }
];

export default function Backup() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(null);

  const load = async () => {
    try { setItems(await api.get('/backup')); } catch (e) { toast.error(e.message); }
  };
  useEffect(() => { load(); }, []);

  const generate = async (type) => {
    setBusy(type);
    try { await api.post('/backup', { type }); toast.success('Backup queued'); load(); }
    catch (e) { toast.error(e.message); }
    finally { setBusy(null); }
  };

  const remove = async (b) => {
    if (!confirm(`Delete backup ${b.filename}?`)) return;
    try { await api.delete(`/backup/${b.id}`); toast.success('Removed'); load(); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {TYPES.map(t => (
          <button key={t.type} onClick={() => generate(t.type)}
                  disabled={busy === t.type}
                  className="card card-pad text-left hover:-translate-y-0.5 hover:border-brand-200 dark:hover:border-brand-700 transition disabled:opacity-50 disabled:translate-y-0">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300 grid place-items-center">
                <t.icon size={20} />
              </div>
              <Plus size={18} className="text-ink-300" />
            </div>
            <div className="mt-3 font-semibold">{t.label}</div>
            <div className="text-xs text-ink-500 dark:text-ink-400">{t.desc}</div>
            {busy === t.type && <div className="mt-2 text-xs text-brand-600">Generating…</div>}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="p-4 border-b border-ink-100 dark:border-ink-800 font-bold flex items-center gap-2">
          <FileArchive size={16} className="text-brand-600" /> Backup history
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>File</th><th>Type</th><th>Size</th><th>Status</th><th>Created</th><th></th></tr></thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan={6}><EmptyState icon={FileArchive} title="No backups yet" /></td></tr>}
              {items.map(b => (
                <tr key={b.id}>
                  <td className="font-mono text-xs break-all">{b.filename}</td>
                  <td><span className="badge-blue">{b.type}</span></td>
                  <td>{b.size_mb} MB</td>
                  <td><span className="badge-green">{b.status}</span></td>
                  <td className="text-xs text-ink-500">{dt(b.created_at)}</td>
                  <td className="text-right whitespace-nowrap">
                    <button className="btn-ghost !p-1.5" title="Download (demo)" onClick={() => toast.info('In a real cPanel this would stream the tar.gz file.')}>
                      <Download size={14} />
                    </button>
                    <button className="btn-ghost !p-1.5 text-rose-600" onClick={() => remove(b)}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
