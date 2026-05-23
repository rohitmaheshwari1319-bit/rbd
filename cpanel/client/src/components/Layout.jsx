import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Search, LogOut, Sun, Moon, ChevronDown, Server, HardDrive,
  ShieldCheck, Cpu, MemoryStick, Network, Globe, Mail, Database, ScrollText,
  Menu, X
} from 'lucide-react';
import CPanelLogo from './CPanelLogo.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { api } from '../api/client.js';
import StatBar from './StatBar.jsx';
import { mb, relativeTime } from '../lib/format.js';

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const nav = useNavigate();
  const [summary, setSummary] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sideOpen, setSideOpen] = useState(false);

  useEffect(() => {
    const load = () => api.get('/stats/summary').then(setSummary).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [location.pathname]);

  const onSearch = (e) => {
    e.preventDefault();
    const q = new FormData(e.target).get('q');
    if (q) nav(`/?q=${encodeURIComponent(q)}`);
  };

  return (
    <div className="min-h-screen bg-ink-50 dark:bg-ink-950 text-ink-900 dark:text-ink-100 flex flex-col">
      {/* === Top navy header === */}
      <header className="sticky top-0 z-30 bg-nav-900 text-white shadow-card">
        <div className="max-w-[1500px] mx-auto px-3 sm:px-4 lg:px-6">
          <div className="flex items-center gap-3 h-14">
            <button className="lg:hidden text-white/80 hover:text-white" onClick={() => setSideOpen(s => !s)}>
              {sideOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <NavLink to="/" className="flex items-center text-white shrink-0">
              <CPanelLogo accent="#60A5FA" />
            </NavLink>

            {/* Global search */}
            <form onSubmit={onSearch} className="ml-2 hidden sm:flex flex-1 max-w-xl relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60" />
              <input
                name="q"
                placeholder="Search tools, files, domains, databases…"
                className="w-full bg-white/10 hover:bg-white/15 focus:bg-white/15 placeholder:text-white/50 text-white
                           rounded-lg border border-white/10 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/40 transition"
              />
            </form>

            <div className="ml-auto flex items-center gap-1">
              <button onClick={toggle} className="p-2 rounded-lg hover:bg-white/10 transition" aria-label="Toggle theme">
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <div className="relative">
                <button onClick={() => setMenuOpen(s => !s)}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 transition">
                  <span className="h-7 w-7 rounded-full bg-gradient-to-br from-brand-400 to-brand-700 grid place-items-center text-xs font-bold">
                    {user?.username?.[0]?.toUpperCase()}
                  </span>
                  <span className="hidden md:block text-left leading-tight">
                    <div className="text-sm font-semibold">{user?.username}</div>
                    <div className="text-[11px] text-white/60">{user?.package}</div>
                  </span>
                  <ChevronDown size={14} className="text-white/60" />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-56 card !bg-white !border-ink-100 dark:!bg-ink-900 dark:!border-ink-800 text-ink-800 dark:text-ink-100 overflow-hidden animate-fade-in">
                    <div className="px-4 py-3 border-b border-ink-100 dark:border-ink-800">
                      <div className="font-semibold">{user?.name}</div>
                      <div className="text-xs text-ink-500">{user?.email}</div>
                    </div>
                    <NavLink to="/preferences" onClick={() => setMenuOpen(false)}
                             className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-ink-50 dark:hover:bg-ink-800">
                      Preferences
                    </NavLink>
                    <button onClick={() => { logout(); nav('/login'); }}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-ink-800">
                      <LogOut size={14} /> Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mobile search */}
          <div className="sm:hidden pb-2">
            <form onSubmit={onSearch} className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60" />
              <input
                name="q"
                placeholder="Search…"
                className="w-full bg-white/10 placeholder:text-white/50 text-white rounded-lg border border-white/10 pl-9 pr-3 py-2 text-sm"
              />
            </form>
          </div>
        </div>
      </header>

      {/* === Body: main + right sidebar === */}
      <div className="flex-1 max-w-[1500px] mx-auto w-full px-3 sm:px-4 lg:px-6 py-6 grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
        {/* Main */}
        <main className="min-w-0 animate-fade-in">
          <Outlet context={{ summary }} />
        </main>

        {/* Right info sidebar (desktop) + slide-over (mobile) */}
        <aside className={`fixed inset-y-0 right-0 z-40 w-[320px] bg-ink-50 dark:bg-ink-950 lg:bg-transparent
                            border-l border-ink-100 dark:border-ink-800 lg:border-0
                            transform transition-transform overflow-y-auto
                            ${sideOpen ? 'translate-x-0' : 'translate-x-full'} lg:static lg:translate-x-0 lg:overflow-visible`}>
          <div className="lg:sticky lg:top-20 p-4 lg:p-0 space-y-4">
            <InfoSidebar summary={summary} onClose={() => setSideOpen(false)} />
          </div>
        </aside>
        {sideOpen && <div onClick={() => setSideOpen(false)} className="fixed inset-0 z-30 bg-black/40 lg:hidden" />}
      </div>

      <footer className="border-t border-ink-100 dark:border-ink-800 py-4 px-6 text-xs text-ink-500 dark:text-ink-400 flex flex-wrap items-center justify-between gap-2">
        <div>cPanel-style Hosting Control Panel · {summary?.server?.os || 'AlmaLinux 9'}</div>
        <div className="font-mono">{summary?.server?.hostname} · {summary?.server?.ip}</div>
      </footer>
    </div>
  );
}

function InfoSidebar({ summary, onClose }) {
  if (!summary) return (
    <div className="card card-pad text-sm text-ink-500">Loading account info…</div>
  );
  const u = summary.usage;
  return (
    <>
      {/* Account */}
      <div className="card card-pad">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-wider font-bold text-ink-500 dark:text-ink-400">General Information</div>
          <button onClick={onClose} className="lg:hidden btn-ghost !p-1"><X size={14} /></button>
        </div>
        <dl className="mt-2 text-sm space-y-1.5">
          <Row k="Username">{summary.user?.username}</Row>
          <Row k="Domains">
            <a href="/domains" className="text-brand-600 hover:underline">{summary.counts?.domains} active</a>
          </Row>
          <Row k="Plan / package"><span className="badge-blue">{summary.user?.package}</span></Row>
          <Row k="Server">{summary.server?.hostname}</Row>
          <Row k="Server IP" mono>{summary.server?.ip}</Row>
          <Row k="OS">{summary.server?.os}</Row>
          <Row k="Apache">{summary.server?.apache}</Row>
          <Row k="MySQL">{summary.server?.mysql}</Row>
          <Row k="PHP">{summary.server?.php}</Row>
          <Row k="Last login">{summary.last_login ? relativeTime(summary.last_login) : '—'}</Row>
        </dl>
      </div>

      {/* Quotas */}
      <div className="card card-pad space-y-4">
        <div className="text-xs uppercase tracking-wider font-bold text-ink-500 dark:text-ink-400">Statistics</div>
        <StatBar icon={HardDrive} label="Disk usage"
                 used={u.disk_used_mb} total={u.disk_quota_mb} format={mb} />
        <StatBar icon={Network} label="Bandwidth (30d)"
                 used={u.bandwidth_mb_30d} total={u.bw_quota_gb * 1024} format={mb} />
        <StatBar icon={Cpu} label="CPU usage" used={u.cpu_pct} total={100} format={v => `${v.toFixed(1)}%`} />
        <StatBar icon={MemoryStick} label="Memory" used={u.memory_pct} total={100} format={v => `${v.toFixed(1)}%`} />
      </div>

      {/* Counts */}
      <div className="card card-pad">
        <div className="text-xs uppercase tracking-wider font-bold text-ink-500 dark:text-ink-400 mb-3">Resource Counts</div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Count icon={Globe} label="Domains" value={summary.counts.domains} to="/domains" />
          <Count icon={Mail} label="Email" value={summary.counts.emails} to="/email" />
          <Count icon={Database} label="Databases" value={summary.counts.databases} to="/databases" />
          <Count icon={ShieldCheck} label="SSL certs" value={summary.counts.ssl} to="/ssl" />
          <Count icon={ScrollText} label="Cron jobs" value={summary.counts.cron} to="/cron" />
          <Count icon={Server} label="FTP" value={summary.counts.ftp} to="/ftp" />
        </div>
      </div>
    </>
  );
}

function Row({ k, children, mono }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink-500 dark:text-ink-400 shrink-0">{k}</dt>
      <dd className={`text-right font-medium text-ink-800 dark:text-ink-100 ${mono ? 'font-mono text-xs' : ''} truncate`}>
        {children}
      </dd>
    </div>
  );
}
function Count({ icon: Icon, label, value, to }) {
  return (
    <a href={to} className="rounded-lg border border-ink-100 dark:border-ink-800 p-2.5 hover:bg-ink-50 dark:hover:bg-ink-800/40 transition flex items-center gap-2">
      <Icon size={16} className="text-brand-600" />
      <div className="leading-tight">
        <div className="font-bold">{value}</div>
        <div className="text-[10px] uppercase tracking-wider text-ink-500">{label}</div>
      </div>
    </a>
  );
}
