import React, { useEffect, useMemo, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import {
  Search, X, AlertTriangle, Database, Globe, Mail, ShieldCheck, ScrollText,
  HardDrive, FolderOpen, FileArchive, Server, Lock, BarChart3, Eye, Activity,
  Files, Image, FileWarning, MailPlus, ListFilter, MailCheck, Inbox, Forward,
  Plug, Layers, KeyRound, Wifi, ShieldAlert, Fingerprint, Cog, Box, Code2,
  Zap, Webhook, FileCog, Languages, Contact, RotateCcw, UserCog, FileType2
} from 'lucide-react';
import ModuleTile from '../components/ModuleTile.jsx';
import { mb, dt, relativeTime } from '../lib/format.js';
import { api } from '../api/client.js';

// === Tile catalog ===
// Each entry mirrors a real cPanel module name. Tiles route to the closest
// implemented page so navigation always works. `keywords` powers live search.
const CATALOG = [
  // ----- FILES -----
  ['Files', [
    { label: 'File Manager',     icon: FolderOpen,  to: '/files',  keywords: 'browse upload edit text editor' },
    { label: 'Backup',           icon: FileArchive, to: '/backup', keywords: 'backup restore tar' },
    { label: 'Backup Wizard',    icon: FileCog,     to: '/backup', keywords: 'backup wizard' },
    { label: 'Disk Usage',       icon: HardDrive,   to: '/files',  keywords: 'disk size storage' },
    { label: 'FTP Accounts',     icon: Server,      to: '/ftp',    keywords: 'ftp sftp transfer' },
    { label: 'Web Disk',         icon: Server,      to: '/ftp',    keywords: 'webdav web disk' },
    { label: 'Images',           icon: Image,       to: '/files',  keywords: 'image jpg png' },
    { label: 'Anonymous FTP',    icon: Server,      to: '/ftp',    keywords: 'public ftp anonymous' }
  ]],
  // ----- DATABASES -----
  ['Databases', [
    { label: 'MySQL Databases',  icon: Database, to: '/databases', keywords: 'mysql mariadb sql' },
    { label: 'MySQL Users',      icon: UserCog,  to: '/databases', keywords: 'mysql users grants' },
    { label: 'phpMyAdmin',       icon: Database, to: '/databases', keywords: 'phpmyadmin pma' },
    { label: 'Remote MySQL',     icon: Wifi,     to: '/databases', keywords: 'remote sql access' },
    { label: 'PostgreSQL',       icon: Database, to: '/databases', keywords: 'postgres pgsql' }
  ]],
  // ----- DOMAINS -----
  ['Domains', [
    { label: 'Domains',          icon: Globe,    to: '/domains', keywords: 'site primary main' },
    { label: 'Subdomains',       icon: Layers,   to: '/domains', keywords: 'subdomain' },
    { label: 'Addon Domains',    icon: Plug,     to: '/domains', keywords: 'addon domain' },
    { label: 'Parked Domains',   icon: Box,      to: '/domains', keywords: 'parked alias' },
    { label: 'Aliases',          icon: Forward,  to: '/domains', keywords: 'alias parked' },
    { label: 'Redirects',        icon: Forward,  to: '/domains', keywords: 'redirect 301 302' },
    { label: 'DNS Zone Editor',  icon: ScrollText, to: '/dns',   keywords: 'dns zone records ns mx txt a aaaa' },
    { label: 'Track DNS',        icon: Webhook,  to: '/dns',     keywords: 'dns tracking lookup' }
  ]],
  // ----- EMAIL -----
  ['Email', [
    { label: 'Email Accounts',   icon: Mail,       to: '/email', keywords: 'mailbox smtp imap pop' },
    { label: 'Forwarders',       icon: Forward,    to: '/email', keywords: 'forwarder forward alias' },
    { label: 'Default Address',  icon: Inbox,      to: '/email', keywords: 'catch-all default address' },
    { label: 'Mailing Lists',    icon: MailPlus,   to: '/email', keywords: 'mailing list mailman' },
    { label: 'Spam Filters',     icon: ListFilter, to: '/email', keywords: 'spam apache spamassassin' },
    { label: 'Auto Responders',  icon: MailCheck,  to: '/email', keywords: 'auto responder vacation' },
    { label: 'Email Routing',    icon: Webhook,    to: '/email', keywords: 'mx routing remote local' }
  ]],
  // ----- METRICS -----
  ['Metrics', [
    { label: 'Visitors',         icon: Eye,       to: '/stats', keywords: 'visitors visitor logs' },
    { label: 'Bandwidth',        icon: Activity,  to: '/stats', keywords: 'bandwidth traffic data' },
    { label: 'Errors',           icon: FileWarning, to: '/stats', keywords: 'errors error log 500' },
    { label: 'Awstats',          icon: BarChart3, to: '/stats', keywords: 'awstats analytics' },
    { label: 'Webalizer',        icon: BarChart3, to: '/stats', keywords: 'webalizer analytics' },
    { label: 'Raw Access',       icon: Files,     to: '/stats', keywords: 'raw access logs' },
    { label: 'CPU & Concurrent Connection Usage', icon: Activity, to: '/stats', keywords: 'cpu concurrent ram memory' }
  ]],
  // ----- SECURITY -----
  ['Security', [
    { label: 'SSL / TLS Status', icon: ShieldCheck, to: '/ssl',         keywords: 'ssl tls https certificate letsencrypt' },
    { label: 'SSL / TLS',        icon: Lock,        to: '/ssl',         keywords: 'ssl tls install certificate' },
    { label: 'IP Blocker',       icon: ShieldAlert, to: '/preferences', keywords: 'ip blocker firewall block' },
    { label: 'Hotlink Protection', icon: Lock,      to: '/preferences', keywords: 'hotlink protection' },
    { label: 'Leech Protection', icon: Lock,        to: '/preferences', keywords: 'leech protection' },
    { label: 'Two-Factor Auth',  icon: Fingerprint, to: '/preferences', keywords: 'two factor authentication 2fa otp' },
    { label: 'SSH Access',       icon: KeyRound,    to: '/preferences', keywords: 'ssh shell access keys' }
  ]],
  // ----- SOFTWARE -----
  ['Software', [
    { label: 'Site Software',    icon: Cog,    to: '/software', keywords: 'softaculous installer wordpress' },
    { label: 'Select PHP Version', icon: Code2, to: '/software', keywords: 'php version selector' },
    { label: 'MultiPHP Manager', icon: Code2,  to: '/software', keywords: 'multi php manager' },
    { label: 'Optimize Website', icon: Zap,    to: '/software', keywords: 'optimize website cache gzip' },
    { label: 'WordPress',        icon: Box,    to: '/software', keywords: 'wordpress wp blog cms' }
  ]],
  // ----- ADVANCED -----
  ['Advanced', [
    { label: 'Cron Jobs',        icon: ScrollText, to: '/cron',  keywords: 'cron job schedule task' },
    { label: 'Indexes',          icon: Files,      to: '/files', keywords: 'indexes directory listing' },
    { label: 'Error Pages',      icon: FileWarning, to: '/files', keywords: '404 500 error pages' },
    { label: 'Apache Handlers',  icon: Cog,        to: '/files', keywords: 'apache handlers' },
    { label: 'MIME Types',       icon: FileType2,  to: '/files', keywords: 'mime types' },
    { label: 'Track DNS',        icon: Webhook,    to: '/dns',   keywords: 'track dns' }
  ]],
  // ----- PREFERENCES -----
  ['Preferences', [
    { label: 'Change Password',     icon: KeyRound, to: '/preferences', keywords: 'password change security' },
    { label: 'Update Contact Info', icon: Contact,  to: '/preferences', keywords: 'contact email update info' },
    { label: 'Change Language',     icon: Languages,to: '/preferences', keywords: 'language locale i18n' },
    { label: 'Reset Page Settings', icon: RotateCcw,to: '/preferences', keywords: 'reset page settings' },
    { label: 'Account Preferences', icon: UserCog,  to: '/preferences', keywords: 'account preferences profile' }
  ]]
];

const SECTION_META = {
  Files:       { icon: FolderOpen, accent: 'from-sky-500 to-brand-700' },
  Databases:   { icon: Database,   accent: 'from-emerald-500 to-emerald-700' },
  Domains:     { icon: Globe,      accent: 'from-indigo-500 to-violet-700' },
  Email:       { icon: Mail,       accent: 'from-pink-500 to-rose-700' },
  Metrics:     { icon: BarChart3,  accent: 'from-amber-500 to-orange-700' },
  Security:    { icon: ShieldCheck,accent: 'from-rose-500 to-rose-700' },
  Software:    { icon: Cog,        accent: 'from-cyan-500 to-cyan-700' },
  Advanced:    { icon: Server,     accent: 'from-slate-500 to-slate-700' },
  Preferences: { icon: UserCog,    accent: 'from-fuchsia-500 to-fuchsia-700' }
};

export default function Dashboard() {
  const { summary } = useOutletContext() || {};
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const [activity, setActivity] = useState([]);

  useEffect(() => {
    api.get('/stats/activity').then(setActivity).catch(() => {});
  }, []);

  // Keep ?q= and the local search input in sync
  useEffect(() => { setQ(params.get('q') || ''); }, [params]);
  useEffect(() => {
    const id = setTimeout(() => {
      const p = new URLSearchParams(params);
      if (q) p.set('q', q); else p.delete('q');
      setParams(p, { replace: true });
    }, 100);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return CATALOG;
    return CATALOG
      .map(([section, items]) => [
        section,
        items.filter(i =>
          i.label.toLowerCase().includes(term) ||
          (i.keywords || '').toLowerCase().includes(term) ||
          section.toLowerCase().includes(term)
        )
      ])
      .filter(([, items]) => items.length > 0);
  }, [q]);

  const totalMatches = filtered.reduce((s, [, items]) => s + items.length, 0);

  return (
    <div className="space-y-6">
      <Hero summary={summary} />

      {/* SSL near-expiry warning if any */}
      <SslWarnings />

      {/* Local module search */}
      <div className="card card-pad flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search modules — file manager, dns, php, ssl, cron…"
            className="input pl-9 pr-9"
          />
          {q && (
            <button onClick={() => setQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-ink-500 hover:text-ink-800 dark:hover:text-ink-200">
              <X size={16} />
            </button>
          )}
        </div>
        <div className="text-xs text-ink-500 dark:text-ink-400">
          {q ? <>{totalMatches} match{totalMatches !== 1 ? 'es' : ''}</> :
               <>{CATALOG.reduce((s, [, i]) => s + i.length, 0)} tools across {CATALOG.length} categories</>}
        </div>
      </div>

      {/* The iconic tile grid */}
      <div className="space-y-6">
        {filtered.map(([section, items]) => {
          const meta = SECTION_META[section] || {};
          const Icon = meta.icon;
          return (
            <section key={section} className="card overflow-hidden">
              <header className={`flex items-center gap-3 px-5 py-3 text-white bg-gradient-to-r ${meta.accent}`}>
                {Icon && <Icon size={18} />}
                <h2 className="font-bold tracking-tight">{section.toUpperCase()}</h2>
                <span className="ml-auto text-xs font-semibold opacity-80">{items.length}</span>
              </header>
              <div className="p-3 sm:p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
                {items.map(it => (
                  <ModuleTile key={it.label} icon={it.icon} label={it.label} to={it.to} />
                ))}
              </div>
            </section>
          );
        })}

        {filtered.length === 0 && (
          <div className="card card-pad text-center text-ink-500 dark:text-ink-400 py-16">
            <Search size={32} className="mx-auto text-ink-300" />
            <div className="mt-3 font-semibold">No tools match &ldquo;{q}&rdquo;</div>
            <button onClick={() => setQ('')} className="btn-soft mt-4">Clear search</button>
          </div>
        )}
      </div>

      {/* Recent activity */}
      <RecentActivity activity={activity} />
    </div>
  );
}

function Hero({ summary }) {
  const u = summary?.user;
  const counts = summary?.counts;
  const usage = summary?.usage;
  return (
    <section className="rounded-2xl bg-gradient-to-br from-nav-700 via-nav-800 to-nav-950 text-white p-5 sm:p-6 shadow-card relative overflow-hidden">
      <div className="absolute -top-20 -right-12 h-64 w-64 rounded-full bg-brand-500/20 blur-3xl" />
      <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        <div>
          <div className="text-[11px] font-semibold tracking-[0.3em] text-white/60">DASHBOARD</div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight">
            Welcome back{u?.name ? `, ${u.name.split(' ')[0]}` : ''}.
          </h1>
          <p className="text-sm text-white/70 mt-1">
            {summary?.last_login
              ? <>Last sign-in {relativeTime(summary.last_login)}</>
              : <>This is your first sign-in.</>}
            {' · '}
            <span className="font-mono">{summary?.server?.hostname || 'server01.example.com'}</span>
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 w-full md:w-auto">
          <Kpi label="Domains"     value={counts?.domains ?? 0} />
          <Kpi label="Databases"   value={counts?.databases ?? 0} />
          <Kpi label="Email accts" value={counts?.emails ?? 0} />
          <Kpi label="Disk used"   value={usage ? mb(usage.disk_used_mb) : '—'} />
        </div>
      </div>
    </section>
  );
}

function Kpi({ label, value }) {
  return (
    <div className="rounded-xl bg-white/10 backdrop-blur px-4 py-3 ring-1 ring-white/10">
      <div className="text-[10px] uppercase tracking-wider text-white/60">{label}</div>
      <div className="text-xl font-extrabold mt-0.5">{value}</div>
    </div>
  );
}

function SslWarnings() {
  const [near, setNear] = useState([]);
  useEffect(() => {
    api.get('/ssl').then(rows => {
      setNear(rows.filter(r => r.days_remaining !== null && r.days_remaining <= 30));
    }).catch(() => {});
  }, []);
  if (near.length === 0) return null;
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-900 p-4 flex items-start gap-3">
      <AlertTriangle className="text-amber-600 mt-0.5 shrink-0" size={20} />
      <div className="text-sm flex-1">
        <div className="font-bold text-amber-900 dark:text-amber-100">
          {near.length} certificate{near.length > 1 ? 's' : ''} expire within 30 days
        </div>
        <ul className="mt-1 space-y-0.5 text-amber-900/80 dark:text-amber-100/80">
          {near.slice(0, 3).map(c => (
            <li key={c.id} className="font-mono text-xs">
              {c.domain} — {c.days_remaining} day{c.days_remaining !== 1 ? 's' : ''} left
              {c.auto_renew ? <span className="ml-2 badge-blue">auto-renew on</span> : null}
            </li>
          ))}
        </ul>
        <a href="/ssl" className="text-amber-800 dark:text-amber-200 font-semibold text-xs mt-1 inline-block hover:underline">
          Manage SSL/TLS →
        </a>
      </div>
    </div>
  );
}

function RecentActivity({ activity }) {
  if (!activity?.length) return null;
  return (
    <section className="card">
      <header className="px-5 py-3 border-b border-ink-100 dark:border-ink-800 flex items-center justify-between">
        <h2 className="font-bold flex items-center gap-2"><Activity size={16} className="text-brand-600" /> Recent activity</h2>
        <span className="text-xs text-ink-500">last {activity.length} events</span>
      </header>
      <ul className="divide-y divide-ink-100 dark:divide-ink-800">
        {activity.slice(0, 8).map(a => (
          <li key={a.id} className="px-5 py-2.5 text-sm flex items-center gap-3">
            <span className="badge-slate text-[10px] uppercase">{a.entity || 'event'}</span>
            <span className="font-medium">{a.username || 'system'}</span>
            <span className="text-ink-500 dark:text-ink-400">{a.action}</span>
            {a.detail && <span className="text-ink-500 dark:text-ink-400 font-mono text-xs truncate max-w-md">{a.detail}</span>}
            <span className="ml-auto text-xs text-ink-500 dark:text-ink-400" title={dt(a.created_at)}>
              {relativeTime(a.created_at)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
