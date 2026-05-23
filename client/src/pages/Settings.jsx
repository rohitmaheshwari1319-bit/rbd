import React, { useEffect, useState } from 'react';
import { Save, Building2, Key, Database } from 'lucide-react';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import Logo from '../components/Logo.jsx';

export default function Settings() {
  const toast = useToast();
  const { user } = useAuth();
  const [s, setS] = useState({});
  const [busy, setBusy] = useState(false);
  const [pwd, setPwd] = useState({ currentPassword: '', newPassword: '' });

  useEffect(() => { api.get('/settings').then(setS).catch(e => toast.error(e.message)); }, [toast]);

  const save = async () => {
    setBusy(true);
    try { await api.put('/settings', s); toast.success('Settings saved'); }
    catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const changePwd = async () => {
    if (!pwd.currentPassword || pwd.newPassword.length < 6) return toast.error('Password must be at least 6 chars');
    try {
      await api.post('/auth/change-password', pwd);
      toast.success('Password updated');
      setPwd({ currentPassword: '', newPassword: '' });
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="card card-pad flex items-center gap-4">
        <Logo className="h-14 w-auto text-rbd-600" showTagline={false} />
        <div>
          <div className="font-extrabold text-lg">{s.company_name || 'RBD Machine Tools'}</div>
          <div className="text-sm text-ink-500 dark:text-ink-400 tracking-[0.2em] font-semibold">{s.company_tagline}</div>
        </div>
      </div>

      <div className="card card-pad">
        <div className="flex items-center gap-2 mb-3"><Building2 className="text-rbd-600" /><h3 className="font-bold">Company information</h3></div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><label className="label">Company name</label><input className="input" value={s.company_name || ''} onChange={e => setS({ ...s, company_name: e.target.value })} /></div>
          <div><label className="label">Tagline</label><input className="input" value={s.company_tagline || ''} onChange={e => setS({ ...s, company_tagline: e.target.value })} /></div>
          <div><label className="label">GSTIN</label><input className="input" value={s.company_gstin || ''} onChange={e => setS({ ...s, company_gstin: e.target.value })} /></div>
          <div><label className="label">Phone</label><input className="input" value={s.company_phone || ''} onChange={e => setS({ ...s, company_phone: e.target.value })} /></div>
          <div className="sm:col-span-2"><label className="label">Email</label><input className="input" value={s.company_email || ''} onChange={e => setS({ ...s, company_email: e.target.value })} /></div>
          <div className="sm:col-span-2"><label className="label">Registered address</label><textarea className="textarea" rows={2} value={s.company_address || ''} onChange={e => setS({ ...s, company_address: e.target.value })} /></div>
          <div><label className="label">Currency</label><input className="input" value={s.currency || 'INR'} onChange={e => setS({ ...s, currency: e.target.value })} /></div>
          <div><label className="label">Monthly sales target (₹)</label><input className="input" type="number" value={s.sales_target_monthly || ''} onChange={e => setS({ ...s, sales_target_monthly: e.target.value })} /></div>
        </div>
        <div className="mt-4 flex justify-end">
          <button className="btn-primary" disabled={busy} onClick={save}><Save size={16} /> Save settings</button>
        </div>
      </div>

      <div className="card card-pad">
        <div className="flex items-center gap-2 mb-3"><Key className="text-rbd-600" /><h3 className="font-bold">Change my password</h3></div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><label className="label">Current password</label><input type="password" className="input" value={pwd.currentPassword} onChange={e => setPwd({ ...pwd, currentPassword: e.target.value })} /></div>
          <div><label className="label">New password (min 6 chars)</label><input type="password" className="input" value={pwd.newPassword} onChange={e => setPwd({ ...pwd, newPassword: e.target.value })} /></div>
        </div>
        <div className="mt-4 flex justify-end">
          <button className="btn-primary" onClick={changePwd}><Save size={16} /> Update password</button>
        </div>
      </div>

      <div className="card card-pad">
        <div className="flex items-center gap-2 mb-3"><Database className="text-rbd-600" /><h3 className="font-bold">Data & backup</h3></div>
        <p className="text-sm text-ink-500 dark:text-ink-400">
          Your data lives in a single SQLite file at <code className="font-mono">server/data/rbd.sqlite</code>.
          To back up, copy that file. To restore, replace it and restart the server.
          For larger deployments, swap <code className="font-mono">server/src/db.js</code> with a
          MySQL/PostgreSQL connector — every API route uses the same query helper, so the surface area is small.
        </p>
        <div className="mt-3 text-xs text-ink-500 dark:text-ink-400">
          Signed in as <b>{user?.name}</b> ({user?.email}) · role: <b className="capitalize">{user?.role}</b>
        </div>
      </div>
    </div>
  );
}
