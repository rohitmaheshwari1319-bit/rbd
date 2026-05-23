import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Server, Pencil } from 'lucide-react';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import Modal from '../components/Modal.jsx';
import EmptyState from '../components/EmptyState.jsx';

export default function FTP() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [editor, setEditor] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try { setItems(await api.get('/ftp')); } catch (e) { toast.error(e.message); }
  };
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const fd = new FormData(e.target);
      const body = {
        username: fd.get('username'),
        directory: fd.get('directory'),
        quota_mb: Number(fd.get('quota_mb')) || 1000
      };
      if (fd.get('password')) body.password = fd.get('password');
      if (editor?.id) await api.patch(`/ftp/${editor.id}`, body);
      else await api.post('/ftp', body);
      toast.success('Saved'); setEditor(null); load();
    } catch (err) { toast.error(err.message); }
    finally { setBusy(false); }
  };

  const remove = async (a) => {
    if (!confirm(`Remove FTP user ${a.username}?`)) return;
    try { await api.delete(`/ftp/${a.id}`); toast.success('Removed'); load(); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-center justify-between p-4 border-b border-ink-100 dark:border-ink-800">
          <h2 className="font-bold flex items-center gap-2"><Server size={16} className="text-brand-600" /> FTP Accounts</h2>
          <button className="btn-primary" onClick={() => setEditor({})}><Plus size={16} /> Add FTP user</button>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>Username</th><th>Directory</th><th>Quota</th><th>Used</th><th></th></tr></thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan={5}><EmptyState icon={Server} title="No FTP accounts" /></td></tr>}
              {items.map(a => {
                const pct = a.quota_mb > 0 ? Math.min(100, (a.used_mb / a.quota_mb) * 100) : 0;
                const tone = pct >= 90 ? 'danger' : pct >= 75 ? 'warn' : '';
                return (
                  <tr key={a.id}>
                    <td className="font-mono font-semibold">{a.username}</td>
                    <td className="font-mono text-xs">{a.directory}</td>
                    <td>{a.quota_mb} MB</td>
                    <td className="min-w-[180px]">
                      <div className="text-xs flex justify-between mb-1">
                        <span className="font-mono">{a.used_mb} MB</span>
                        <span className="text-ink-500">{pct.toFixed(0)}%</span>
                      </div>
                      <div className="quota-bar"><div className={`quota-fill ${tone}`} style={{ width: `${pct}%` }} /></div>
                    </td>
                    <td className="text-right whitespace-nowrap">
                      <button className="btn-ghost !p-1.5" onClick={() => setEditor(a)}><Pencil size={14} /></button>
                      <button className="btn-ghost !p-1.5 text-rose-600" onClick={() => remove(a)}><Trash2 size={14} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!editor} onClose={() => setEditor(null)} title={editor?.id ? `Edit ${editor.username}` : 'New FTP user'}
        footer={<>
          <button className="btn-soft" onClick={() => setEditor(null)}>Cancel</button>
          <button form="ftp-form" type="submit" disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Save'}</button>
        </>}>
        {editor && (
          <form id="ftp-form" onSubmit={save} className="grid sm:grid-cols-2 gap-3">
            <div><label className="label">Username *</label>
              <input className="input font-mono" name="username" required defaultValue={editor.username || ''} disabled={!!editor.id} />
            </div>
            <div><label className="label">Quota (MB)</label>
              <input className="input" name="quota_mb" type="number" defaultValue={editor.quota_mb || 1000} />
            </div>
            <div className="sm:col-span-2"><label className="label">Directory *</label>
              <input className="input font-mono" name="directory" required defaultValue={editor.directory || '/home/demo/public_html'} />
            </div>
            <div className="sm:col-span-2"><label className="label">{editor.id ? 'Reset password (optional)' : 'Password *'}</label>
              <input className="input font-mono" type="password" name="password" minLength={8} required={!editor.id} placeholder={editor.id ? 'Leave blank to keep current' : ''} />
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
