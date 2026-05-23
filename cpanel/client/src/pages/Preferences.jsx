import React, { useEffect, useState } from 'react';
import { Save, Key, Contact, Languages, UserCog, ShieldCheck } from 'lucide-react';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Preferences() {
  const toast = useToast();
  const { user, refresh } = useAuth();
  const [profile, setProfile] = useState({ name: '', email: '' });
  const [pwd, setPwd] = useState({ currentPassword: '', newPassword: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) setProfile({ name: user.name || '', email: user.email || '' });
  }, [user]);

  const saveProfile = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      await api.put('/account/profile', profile);
      toast.success('Profile saved'); refresh();
    } catch (err) { toast.error(err.message); }
    finally { setBusy(false); }
  };

  const changePwd = async (e) => {
    e.preventDefault();
    if (pwd.newPassword.length < 6) return toast.error('New password must be at least 6 chars');
    setBusy(true);
    try {
      await api.post('/auth/change-password', pwd);
      toast.success('Password updated');
      setPwd({ currentPassword: '', newPassword: '' });
    } catch (err) { toast.error(err.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="card card-pad flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-brand-400 to-brand-700 grid place-items-center text-white text-lg font-bold">
          {user?.username?.[0]?.toUpperCase()}
        </div>
        <div>
          <div className="font-bold text-lg">{user?.name}</div>
          <div className="text-sm text-ink-500">{user?.username} · {user?.email || '—'}</div>
          <div className="mt-1"><span className="badge-blue">{user?.package}</span></div>
        </div>
      </div>

      <form onSubmit={saveProfile} className="card card-pad space-y-4">
        <h3 className="font-bold flex items-center gap-2"><Contact className="text-brand-600" size={16} /> Update contact info</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><label className="label">Full name</label>
            <input className="input" value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} />
          </div>
          <div><label className="label">Email</label>
            <input className="input" type="email" value={profile.email}
                   onChange={e => setProfile({ ...profile, email: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end">
          <button className="btn-primary" disabled={busy}><Save size={16} /> Save profile</button>
        </div>
      </form>

      <form onSubmit={changePwd} className="card card-pad space-y-4">
        <h3 className="font-bold flex items-center gap-2"><Key className="text-brand-600" size={16} /> Change password</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><label className="label">Current password</label>
            <input className="input" type="password" required
                   value={pwd.currentPassword} onChange={e => setPwd({ ...pwd, currentPassword: e.target.value })} />
          </div>
          <div><label className="label">New password (min 6)</label>
            <input className="input" type="password" required minLength={6}
                   value={pwd.newPassword} onChange={e => setPwd({ ...pwd, newPassword: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end">
          <button className="btn-primary" disabled={busy}><Save size={16} /> Update password</button>
        </div>
      </form>

      <div className="card card-pad space-y-2">
        <h3 className="font-bold flex items-center gap-2"><UserCog className="text-brand-600" size={16} /> Account preferences</h3>
        <Pref icon={Languages}    label="Language"               value="English (US)" />
        <Pref icon={ShieldCheck}  label="Two-factor authentication" value={<span className="badge-amber">Not enabled</span>} />
        <Pref icon={UserCog}      label="Style / appearance"     value="Jupiter (default)" />
      </div>
    </div>
  );
}

function Pref({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 py-2 border-t first:border-t-0 border-ink-100 dark:border-ink-800">
      <Icon size={16} className="text-ink-500 shrink-0" />
      <div className="flex-1 text-sm font-medium">{label}</div>
      <div className="text-sm text-ink-700 dark:text-ink-200">{value}</div>
    </div>
  );
}
