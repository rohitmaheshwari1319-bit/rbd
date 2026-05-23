import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, ShieldCheck, History } from 'lucide-react';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import Modal from '../components/Modal.jsx';
import { dt } from '../lib/format.js';

const empty = { name: '', email: '', password: '', role: 'staff', active: true };

export default function Users() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [activity, setActivity] = useState([]);
  const [editor, setEditor] = useState(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('users');

  const load = async () => {
    try {
      const [u, a] = await Promise.all([api.get('/users'), api.get('/users/activity')]);
      setItems(u); setActivity(a);
    } catch (e) { toast.error(e.message); }
  };
  useEffect(() => { load(); }, []);

  const save = async e => {
    e.preventDefault(); setBusy(true);
    try {
      const body = { ...editor };
      if (editor.id) {
        if (!body.password) delete body.password;
        await api.patch(`/users/${editor.id}`, body);
      } else {
        await api.post('/users', body);
      }
      toast.success('Saved'); setEditor(null); load();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const remove = async u => {
    if (!confirm(`Delete user "${u.name}"?`)) return;
    try { await api.delete(`/users/${u.id}`); toast.success('Deleted'); load(); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="card card-pad flex flex-wrap items-center gap-3">
        <ShieldCheck className="text-rbd-600" />
        <div>
          <div className="font-bold">Users & roles</div>
          <div className="text-sm text-ink-500 dark:text-ink-400">Manage staff, managers and admins.</div>
        </div>
        <button className="btn-primary ml-auto" onClick={() => setEditor({ ...empty })}><Plus size={16} /> New user</button>
      </div>

      <div className="card">
        <div className="flex gap-1 p-2 border-b border-ink-100 dark:border-ink-800">
          {[['users', 'Users'], ['activity', 'Activity log']].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
                    className={`px-4 py-2 text-sm font-semibold rounded-lg ${tab === k
                      ? 'bg-rbd-50 text-rbd-700 dark:bg-rbd-900/30 dark:text-rbd-200'
                      : 'text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800'}`}>{l}</button>
          ))}
        </div>

        <div className="p-4">
          {tab === 'users' && (
            <div className="overflow-x-auto -mx-2">
              <table className="table">
                <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Active</th><th>Created</th><th></th></tr></thead>
                <tbody>
                  {items.map(u => (
                    <tr key={u.id}>
                      <td className="font-semibold">{u.name}</td>
                      <td className="font-mono text-xs">{u.email}</td>
                      <td><span className={`badge-${u.role === 'admin' ? 'red' : u.role === 'manager' ? 'amber' : 'slate'} capitalize`}>{u.role}</span></td>
                      <td>{u.active ? <span className="badge-green">Active</span> : <span className="badge-slate">Disabled</span>}</td>
                      <td className="text-ink-500 dark:text-ink-400 text-xs">{dt(u.created_at)}</td>
                      <td className="text-right whitespace-nowrap">
                        <button className="btn-ghost !p-1.5" onClick={() => setEditor({ ...u, password: '' })}><Pencil size={16} /></button>
                        <button className="btn-ghost !p-1.5 text-rbd-600" onClick={() => remove(u)}><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {tab === 'activity' && (
            <ul className="divide-y divide-ink-100 dark:divide-ink-800">
              {activity.length === 0 && <li className="py-8 text-center text-ink-500">No activity yet.</li>}
              {activity.map(a => (
                <li key={a.id} className="py-2.5 flex items-center gap-3 text-sm">
                  <History size={14} className="text-ink-400" />
                  <span className="font-semibold">{a.user_name || 'system'}</span>
                  <span className="text-ink-500">{a.action}</span>
                  {a.entity && <span className="badge-slate">{a.entity}{a.entity_id ? ` #${a.entity_id}` : ''}</span>}
                  <span className="ml-auto text-xs text-ink-500 dark:text-ink-400">{dt(a.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <Modal open={!!editor} onClose={() => setEditor(null)} title={editor?.id ? 'Edit user' : 'New user'}
        footer={
          <>
            <button className="btn-soft" onClick={() => setEditor(null)}>Cancel</button>
            <button className="btn-primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
          </>
        }>
        {editor && (
          <form onSubmit={save} className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2"><label className="label">Name *</label><input className="input" required value={editor.name} onChange={e => setEditor({ ...editor, name: e.target.value })} /></div>
            <div><label className="label">Email *</label><input type="email" className="input" required value={editor.email} onChange={e => setEditor({ ...editor, email: e.target.value })} /></div>
            <div><label className="label">Role</label>
              <select className="select" value={editor.role} onChange={e => setEditor({ ...editor, role: e.target.value })}>
                <option value="staff">Staff</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div><label className="label">{editor.id ? 'New password (optional)' : 'Password *'}</label>
              <input type="password" className="input" required={!editor.id} value={editor.password || ''} onChange={e => setEditor({ ...editor, password: e.target.value })} />
            </div>
            <div className="flex items-center gap-2 pt-7">
              <input id="active" type="checkbox" checked={!!editor.active} onChange={e => setEditor({ ...editor, active: e.target.checked })} />
              <label htmlFor="active" className="text-sm font-semibold">Account active</label>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
