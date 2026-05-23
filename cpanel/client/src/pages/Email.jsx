import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Mail, Forward, Pencil } from 'lucide-react';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import Modal from '../components/Modal.jsx';
import EmptyState from '../components/EmptyState.jsx';

export default function Email() {
  const toast = useToast();
  const [accounts, setAccounts] = useState([]);
  const [forwarders, setForwarders] = useState([]);
  const [domains, setDomains] = useState([]);
  const [tab, setTab] = useState('accounts');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [creatingFwd, setCreatingFwd] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [a, f, d] = await Promise.all([
        api.get('/email'),
        api.get('/email/forwarders'),
        api.get('/domains')
      ]);
      setAccounts(a); setForwarders(f); setDomains(d);
    } catch (e) { toast.error(e.message); }
  };
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const fd = new FormData(e.target);
      await api.post('/email', {
        local: fd.get('local'),
        domain: fd.get('domain'),
        password: fd.get('password'),
        quota_mb: Number(fd.get('quota_mb')) || 1000
      });
      toast.success('Email account created'); setCreating(false); load();
    } catch (err) { toast.error(err.message); }
    finally { setBusy(false); }
  };

  const remove = async (a) => {
    if (!confirm(`Delete ${a.address}?`)) return;
    try { await api.delete(`/email/${a.id}`); toast.success('Removed'); load(); }
    catch (e) { toast.error(e.message); }
  };

  const update = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const fd = new FormData(e.target);
      const body = { quota_mb: Number(fd.get('quota_mb')) };
      const pwd = fd.get('password');
      if (pwd) body.password = pwd;
      await api.patch(`/email/${editing.id}`, body);
      toast.success('Updated'); setEditing(null); load();
    } catch (err) { toast.error(err.message); }
    finally { setBusy(false); }
  };

  const createFwd = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const fd = new FormData(e.target);
      await api.post('/email/forwarders', {
        address: fd.get('address'),
        forward_to: fd.get('forward_to')
      });
      toast.success('Forwarder created'); setCreatingFwd(false); load();
    } catch (err) { toast.error(err.message); }
    finally { setBusy(false); }
  };

  const removeFwd = async (f) => {
    if (!confirm(`Remove forwarder ${f.address}?`)) return;
    try { await api.delete(`/email/forwarders/${f.id}`); toast.success('Removed'); load(); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-center gap-1 p-2 border-b border-ink-100 dark:border-ink-800">
          {[['accounts', 'Email Accounts'], ['forwarders', 'Forwarders']].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
                    className={`px-4 py-2 text-sm font-semibold rounded-lg ${tab === k
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-200'
                      : 'text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800'}`}>{l}</button>
          ))}
          <div className="ml-auto pr-2">
            {tab === 'accounts'
              ? <button className="btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> Create account</button>
              : <button className="btn-primary" onClick={() => setCreatingFwd(true)}><Plus size={16} /> Add forwarder</button>}
          </div>
        </div>

        {tab === 'accounts' && (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Email</th><th>Quota</th><th>Used</th><th></th></tr></thead>
              <tbody>
                {accounts.length === 0 && <tr><td colSpan={4}><EmptyState icon={Mail} title="No email accounts" description="Create one to start receiving mail." /></td></tr>}
                {accounts.map(a => {
                  const pct = a.quota_mb > 0 ? Math.min(100, (a.used_mb / a.quota_mb) * 100) : 0;
                  const tone = pct >= 90 ? 'danger' : pct >= 75 ? 'warn' : '';
                  return (
                    <tr key={a.id}>
                      <td className="font-mono font-semibold">{a.address}</td>
                      <td>{a.quota_mb} MB</td>
                      <td className="min-w-[180px]">
                        <div className="flex items-center justify-between mb-1 text-xs">
                          <span className="font-mono">{a.used_mb} MB</span>
                          <span className="text-ink-500">{pct.toFixed(0)}%</span>
                        </div>
                        <div className="quota-bar"><div className={`quota-fill ${tone}`} style={{ width: `${pct}%` }} /></div>
                      </td>
                      <td className="text-right whitespace-nowrap">
                        <button className="btn-ghost !p-1.5" onClick={() => setEditing(a)}><Pencil size={14} /></button>
                        <button className="btn-ghost !p-1.5 text-rose-600" onClick={() => remove(a)}><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'forwarders' && (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Address</th><th>Forward to</th><th></th></tr></thead>
              <tbody>
                {forwarders.length === 0 && <tr><td colSpan={3}><EmptyState icon={Forward} title="No forwarders" description="Forward incoming mail to other addresses." /></td></tr>}
                {forwarders.map(f => (
                  <tr key={f.id}>
                    <td className="font-mono font-semibold">{f.address}</td>
                    <td className="font-mono text-sm">{f.forward_to}</td>
                    <td className="text-right">
                      <button className="btn-ghost !p-1.5 text-rose-600" onClick={() => removeFwd(f)}><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={creating} onClose={() => setCreating(false)} title="Create email account"
        footer={<>
          <button className="btn-soft" onClick={() => setCreating(false)}>Cancel</button>
          <button form="mail-form" type="submit" disabled={busy} className="btn-primary">{busy ? 'Creating…' : 'Create'}</button>
        </>}>
        <form id="mail-form" onSubmit={create} className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2 grid grid-cols-[1fr_auto_2fr] gap-2 items-end">
            <div><label className="label">Mailbox name</label><input className="input font-mono" name="local" required pattern="[A-Za-z0-9._+-]+" /></div>
            <div className="text-ink-500 pb-2 font-mono">@</div>
            <div><label className="label">Domain</label>
              <select className="select" name="domain" required>
                {domains.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
            </div>
          </div>
          <div><label className="label">Password (8+ chars)</label><input className="input font-mono" type="password" name="password" required minLength={8} /></div>
          <div><label className="label">Quota (MB)</label><input className="input" name="quota_mb" type="number" defaultValue={1000} min={50} /></div>
        </form>
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.address}
        footer={<>
          <button className="btn-soft" onClick={() => setEditing(null)}>Cancel</button>
          <button form="edit-mail" type="submit" disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Save'}</button>
        </>}>
        {editing && (
          <form id="edit-mail" onSubmit={update} className="grid sm:grid-cols-2 gap-3">
            <div><label className="label">Quota (MB)</label><input className="input" name="quota_mb" type="number" defaultValue={editing.quota_mb} min={50} /></div>
            <div><label className="label">Reset password (optional)</label><input className="input font-mono" name="password" type="password" minLength={8} placeholder="Leave blank to keep current" /></div>
          </form>
        )}
      </Modal>

      <Modal open={creatingFwd} onClose={() => setCreatingFwd(false)} title="New forwarder"
        footer={<>
          <button className="btn-soft" onClick={() => setCreatingFwd(false)}>Cancel</button>
          <button form="fwd-form" type="submit" disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Save'}</button>
        </>}>
        <form id="fwd-form" onSubmit={createFwd} className="space-y-3">
          <div><label className="label">Address (incoming)</label><input className="input font-mono" name="address" required placeholder="team@example.com" /></div>
          <div><label className="label">Forward to (comma-separated)</label><input className="input font-mono" name="forward_to" required placeholder="alice@example.com, bob@example.com" /></div>
        </form>
      </Modal>
    </div>
  );
}
