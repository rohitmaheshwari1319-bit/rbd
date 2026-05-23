import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import Logo from '../components/Logo.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function Login() {
  const { user, login, loading } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [email, setEmail] = useState('admin@rbd.local');
  const [password, setPassword] = useState('admin123');
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (user) nav('/'); }, [user, nav]);

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  const submit = async e => {
    e.preventDefault();
    setBusy(true);
    try {
      const u = await login(email.trim(), password);
      toast.success(`Welcome back, ${u.name}`);
      nav('/');
    } catch (err) {
      toast.error(err.message || 'Login failed');
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-ink-50 dark:bg-ink-950 text-ink-900 dark:text-ink-100">
      {/* Brand panel */}
      <div className="hidden lg:flex flex-col justify-between p-10 bg-gradient-to-br from-rbd-700 via-rbd-600 to-rbd-800 text-white relative overflow-hidden">
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-72 w-72 rounded-full bg-black/20 blur-3xl" />
        <div className="relative">
          <Logo className="h-24 w-auto text-white" showTagline={false} />
          <div className="mt-3 text-sm font-bold tracking-[0.4em] opacity-90">TRUST OF INDIA</div>
        </div>
        <div className="relative space-y-4 max-w-lg">
          <h1 className="text-4xl font-extrabold leading-tight">
            AI-powered inventory automation, built for industrial scale.
          </h1>
          <p className="text-white/85 text-lg">
            Real-time stock, multi-warehouse operations, GST invoicing, demand
            forecasting and intelligent reorder advice — all in one place.
          </p>
          <ul className="grid grid-cols-2 gap-2 text-sm pt-2">
            {[
              'AI demand forecasting',
              'Multi-warehouse stock',
              'GST invoice PDF',
              'Camera barcode scanner',
              'Voice + chat assistant',
              'Live dashboard analytics'
            ].map(f => (
              <li key={f} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-white/90" />{f}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative text-xs text-white/70">© {new Date().getFullYear()} RBD Machine Tools</div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-md card card-pad space-y-5 animate-fade-in">
          <div className="lg:hidden flex items-center gap-3 mb-2">
            <Logo className="h-12 w-auto text-rbd-600" showTagline={false} />
            <div>
              <div className="font-extrabold tracking-wide">RBD Inventory</div>
              <div className="text-[11px] text-ink-500 dark:text-ink-400 font-semibold tracking-[0.2em]">TRUST OF INDIA</div>
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-extrabold">Welcome back</h2>
            <p className="text-sm text-ink-500 dark:text-ink-400 mt-1">Sign in to manage your inventory.</p>
          </div>

          <div>
            <label className="label">Email</label>
            <input className="input" type="email" autoComplete="username"
                   value={email} onChange={e => setEmail(e.target.value)} required />
          </div>

          <div>
            <label className="label">Password</label>
            <div className="relative">
              <input className="input pr-10" type={showPwd ? 'text' : 'password'} autoComplete="current-password"
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

          <div className="rounded-lg bg-ink-50 dark:bg-ink-800/60 border border-ink-100 dark:border-ink-700 p-3 text-xs text-ink-600 dark:text-ink-300">
            <div className="font-semibold mb-1">Demo accounts</div>
            <div>Admin: <code>admin@rbd.local</code> / <code>admin123</code></div>
            <div>Manager: <code>manager@rbd.local</code> / <code>manager123</code></div>
            <div>Staff: <code>staff@rbd.local</code> / <code>staff123</code></div>
          </div>
        </form>
      </div>
    </div>
  );
}
