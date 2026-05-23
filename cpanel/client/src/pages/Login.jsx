import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Loader2, Eye, EyeOff, User, Lock } from 'lucide-react';
import CPanelLogo from '../components/CPanelLogo.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function Login() {
  const { user, login, loading } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [username, setUsername] = useState('demo');
  const [password, setPassword] = useState('cpanel123');
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (user) nav('/'); }, [user, nav]);
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  const submit = async e => {
    e.preventDefault();
    setBusy(true);
    try {
      const u = await login(username.trim(), password);
      toast.success(`Welcome, ${u.name}`);
      nav('/');
    } catch (err) {
      toast.error(err.message || 'Login failed');
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-ink-50 dark:bg-ink-950">
      {/* Brand panel */}
      <div className="hidden lg:flex flex-col justify-between p-10 bg-gradient-to-br from-nav-700 via-nav-800 to-nav-950 text-white relative overflow-hidden">
        <div className="absolute -top-40 -right-32 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-72 w-72 rounded-full bg-brand-700/30 blur-3xl" />
        <div className="relative">
          <CPanelLogo className="text-brand-200" wordmark={false} />
          <div className="mt-3 flex items-center gap-2">
            <span className="text-3xl font-extrabold tracking-tight">cPanel</span>
            <span className="badge-blue !bg-white/10 !text-white !ring-white/20">v124</span>
          </div>
          <div className="text-xs font-semibold tracking-[0.3em] text-white/70 mt-1">CONTROL PANEL</div>
        </div>
        <div className="relative space-y-4 max-w-lg">
          <h1 className="text-3xl font-extrabold leading-tight">
            Manage your hosting from one beautiful place.
          </h1>
          <p className="text-white/80 text-base">
            Files, databases, domains, email, DNS, FTP, cron, SSL, statistics
            and one-click app installs — all in a familiar tile-grid layout.
          </p>
          <ul className="grid grid-cols-2 gap-2 text-sm pt-2">
            {[
              'File Manager', 'MySQL Databases', 'Email Accounts', 'DNS Zone Editor',
              'SSL / Let\u2019s Encrypt', 'One-click Installer', 'FTP / SFTP', 'Cron Jobs',
              'Resource Statistics', 'Backups & Restore'
            ].map(f => (
              <li key={f} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />{f}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative text-xs text-white/60">
          server01.example.com · 192.0.2.10 · AlmaLinux 9 · Apache 2.4 · MySQL 8.0 · PHP 8.3
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-md card card-pad space-y-5 animate-fade-in">
          <div className="lg:hidden flex items-center justify-center gap-3 mb-2 text-nav-800 dark:text-brand-200">
            <CPanelLogo />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-ink-900 dark:text-white">Sign in</h2>
            <p className="text-sm text-ink-500 dark:text-ink-400 mt-1">Use your account credentials to access the control panel.</p>
          </div>

          <div>
            <label className="label">Username or email</label>
            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input className="input pl-9" type="text" autoComplete="username"
                     value={username} onChange={e => setUsername(e.target.value)} required />
            </div>
          </div>

          <div>
            <label className="label">Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input className="input pl-9 pr-10" type={showPwd ? 'text' : 'password'} autoComplete="current-password"
                     value={password} onChange={e => setPassword(e.target.value)} required />
              <button type="button" onClick={() => setShowPwd(s => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-ink-500 hover:text-ink-800 dark:hover:text-ink-200">
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={busy} className="btn-primary w-full !py-2.5">
            {busy ? <Loader2 className="animate-spin" size={18} /> : 'Sign in'}
          </button>

          <div className="rounded-lg bg-ink-50 dark:bg-ink-800/60 border border-ink-100 dark:border-ink-700 p-3 text-xs text-ink-600 dark:text-ink-300 space-y-0.5">
            <div className="font-semibold mb-1 text-ink-800 dark:text-ink-100">Demo accounts</div>
            <div>User: <code className="font-mono">demo</code> / <code className="font-mono">cpanel123</code></div>
            <div>Admin: <code className="font-mono">admin</code> / <code className="font-mono">admin123</code></div>
          </div>
        </form>
      </div>
    </div>
  );
}
