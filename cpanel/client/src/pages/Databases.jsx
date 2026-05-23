import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Database, UserPlus, Link2, Unlink } from 'lucide-react';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import Modal from '../components/Modal.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { bytes } from '../lib/format.js';

export default function Databases() {
  const toast = useToast();
  const [dbs, setDbs] = useState([]);
  const [users, setUsers] = useState([]);
  const [creating, setCreating] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [granting, setGranting] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [d, u] = await Promise.all([api.get('/databases'), api.get('/databases/users')]);
      setDbs(d); setUsers(u);
    } catch (e) { toast.error(e.message); }
  };
  useEffect(() => { load(); }, []);

  const createDb = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      await api.post('/databases', { name: new FormData(e.target).get('name') });
      toast.success('Database created'); setCreating(false); load();
    } catch (err) { toast.error(err.message); }
    finally { setBusy(false); }
  };

  const dropDb = async (db) => {
    if (!confirm(`Drop database "${db.name}"? This action is irreversible.`)) return;
    try { await api.delete(`/databases/${db.id}`); toast.success('Dropped'); load(); }
    catch (e) { toast.error(e.message); }
  };

  const createUser = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const fd = new FormData(e.target);
      await api.post('/databases/users', { username: fd.get('username'), password: fd.get('password') });
      toast.success('User created'); setCreatingUser(false); load();
    } catch (err) { toast.error(err.message); }
    finally { setBusy(false); }
  };

  const removeUser = async (u) => {
    if (!confirm(`Remove user "${u.username}"?`)) return;
    try { await api.delete(`/databases/users/${u.id}`); toast.success('Removed'); load(); }
    catch (e) { toast.error(e.message); }
  };

  const addGrant = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const fd = new FormData(e.target);
      await api.post('/databases/grants', {
        database_id: granting.database_id,
        db_user_id: Number(fd.get('user')),
        privileges: fd.get('privileges')
      });
      toast.success('Privileges granted'); setGranting(null); load();
    } catch (err) { toast.error(err.message); }
    finally { setBusy(false); }
  };

  const revokeGrant = async (db, user) => {
    if (!confirm(`Revoke privileges of "${user.username}" on "${db.name}"?`)) return;
    try {
      await api.delete(`/databases/grants?database_id=${db.id}&db_user_id=${user.id}`);
      toast.success('Revoked'); load();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-3">
        <Kpi label="MySQL Databases" value={dbs.length} />
        <Kpi label="MySQL Users" value={users.length} />
        <Kpi label="Total size" value={bytes(dbs.reduce((s, d) => s + d.size_kb * 1024, 0))} />
      </div>

      {/* Databases */}
      <div className="card">
        <div className="flex items-center justify-between p-4 border-b border-ink-100 dark:border-ink-800">
          <h2 className="font-bold flex items-center gap-2"><Database size={16} className="text-brand-600" /> Current Databases</h2>
          <button className="btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> Create database</button>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>Name</th><th>Charset</th><th>Size</th><th>Privileged users</th><th></th></tr></thead>
            <tbody>
              {dbs.length === 0 && <tr><td colSpan={5}><EmptyState icon={Database} title="No databases" description="Create your first MySQL database." /></td></tr>}
              {dbs.map(d => (
                <tr key={d.id}>
                  <td className="font-mono font-semibold">{d.name}</td>
                  <td className="font-mono text-xs">{d.charset} / {d.collation}</td>
                  <td>{bytes(d.size_kb * 1024)}</td>
                  <td>
                    {d.users.length === 0
                      ? <span className="text-ink-400 text-xs">— no users assigned —</span>
                      : <div className="flex flex-wrap gap-1">
                          {d.users.map(u => (
                            <span key={u.id} className="badge-blue gap-1">
                              <span className="font-mono">{u.username}</span>
                              <span className="opacity-70">({u.privileges.replace(' PRIVILEGES', '')})</span>
                              <button onClick={() => revokeGrant(d, u)} className="ml-1 hover:text-rose-600" title="Revoke">
                                <Unlink size={11} />
                              </button>
                            </span>
                          ))}
                        </div>
                    }
                  </td>
                  <td className="text-right whitespace-nowrap">
                    <button className="btn-ghost !p-1.5" onClick={() => setGranting({ database_id: d.id, name: d.name })} title="Add user">
                      <Link2 size={14} />
                    </button>
                    <button className="btn-ghost !p-1.5 text-rose-600" onClick={() => dropDb(d)} title="Drop database">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Users */}
      <div className="card">
        <div className="flex items-center justify-between p-4 border-b border-ink-100 dark:border-ink-800">
          <h2 className="font-bold flex items-center gap-2"><UserPlus size={16} className="text-brand-600" /> Current Users</h2>
          <button className="btn-soft" onClick={() => setCreatingUser(true)}><Plus size={16} /> Create user</button>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>Username</th><th>Created</th><th></th></tr></thead>
            <tbody>
              {users.length === 0 && <tr><td colSpan={3}><EmptyState title="No MySQL users yet" /></td></tr>}
              {users.map(u => (
                <tr key={u.id}>
                  <td className="font-mono font-semibold">{u.username}</td>
                  <td className="text-xs text-ink-500">{u.created_at}</td>
                  <td className="text-right">
                    <button className="btn-ghost !p-1.5 text-rose-600" onClick={() => removeUser(u)}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={creating} onClose={() => setCreating(false)} title="Create database"
        footer={<>
          <button className="btn-soft" onClick={() => setCreating(false)}>Cancel</button>
          <button form="db-form" type="submit" disabled={busy} className="btn-primary">{busy ? 'Creating…' : 'Create'}</button>
        </>}>
        <form id="db-form" onSubmit={createDb}>
          <label className="label">Database name *</label>
          <input className="input font-mono" name="name" required pattern="[A-Za-z][A-Za-z0-9_]{2,63}" placeholder="demo_appdata" />
          <p className="text-xs text-ink-500 mt-2">3-64 characters; letters, numbers and underscores; must start with a letter.</p>
        </form>
      </Modal>

      <Modal open={creatingUser} onClose={() => setCreatingUser(false)} title="Create database user"
        footer={<>
          <button className="btn-soft" onClick={() => setCreatingUser(false)}>Cancel</button>
          <button form="user-form" type="submit" disabled={busy} className="btn-primary">{busy ? 'Creating…' : 'Create'}</button>
        </>}>
        <form id="user-form" onSubmit={createUser} className="space-y-3">
          <div>
            <label className="label">Username *</label>
            <input className="input font-mono" name="username" required pattern="[A-Za-z][A-Za-z0-9_]{2,31}" />
          </div>
          <div>
            <label className="label">Password *</label>
            <input className="input font-mono" name="password" type="password" required minLength={6} />
          </div>
        </form>
      </Modal>

      <Modal open={!!granting} onClose={() => setGranting(null)} title={`Add user to ${granting?.name}`}
        footer={<>
          <button className="btn-soft" onClick={() => setGranting(null)}>Cancel</button>
          <button form="grant-form" type="submit" disabled={busy} className="btn-primary">{busy ? 'Granting…' : 'Grant'}</button>
        </>}>
        <form id="grant-form" onSubmit={addGrant} className="space-y-3">
          <div>
            <label className="label">User</label>
            <select className="select" name="user" required>
              <option value="">Choose user…</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Privileges</label>
            <select className="select" name="privileges" defaultValue="ALL PRIVILEGES">
              <option>ALL PRIVILEGES</option>
              <option>SELECT</option>
              <option>SELECT, INSERT, UPDATE, DELETE</option>
              <option>SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, ALTER, INDEX</option>
            </select>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function Kpi({ label, value }) {
  return (
    <div className="card card-pad">
      <div className="kpi-title">{label}</div>
      <div className="kpi-value mt-1">{value}</div>
    </div>
  );
}
