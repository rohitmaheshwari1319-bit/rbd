import React, { useEffect, useMemo, useState } from 'react';
import { Search, Cog, Box, Trash2 } from 'lucide-react';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import Modal from '../components/Modal.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { date } from '../lib/format.js';

export default function Software() {
  const toast = useToast();
  const [catalog, setCatalog] = useState([]);
  const [installed, setInstalled] = useState([]);
  const [domains, setDomains] = useState([]);
  const [q, setQ] = useState('');
  const [installing, setInstalling] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [c, i, d] = await Promise.all([
        api.get('/software/catalog'),
        api.get('/software/installed'),
        api.get('/domains')
      ]);
      setCatalog(c); setInstalled(i); setDomains(d);
    } catch (e) { toast.error(e.message); }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return catalog;
    return catalog.filter(c =>
      c.name.toLowerCase().includes(s) ||
      c.category.toLowerCase().includes(s) ||
      (c.description || '').toLowerCase().includes(s)
    );
  }, [q, catalog]);

  const grouped = useMemo(() => {
    const g = {};
    for (const c of filtered) (g[c.category] = g[c.category] || []).push(c);
    return g;
  }, [filtered]);

  const install = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const fd = new FormData(e.target);
      await api.post('/software/install', {
        slug: installing.slug,
        domain: fd.get('domain'),
        install_path: fd.get('install_path') || '/'
      });
      toast.success(`${installing.name} installed`);
      setInstalling(null); load();
    } catch (err) { toast.error(err.message); }
    finally { setBusy(false); }
  };

  const uninstall = async (i) => {
    if (!confirm(`Uninstall ${i.name} from ${i.domain}${i.install_path}?`)) return;
    try { await api.delete(`/software/installed/${i.id}`); toast.success('Uninstalled'); load(); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="card card-pad flex flex-wrap items-center gap-3">
        <Cog className="text-brand-600" />
        <div>
          <div className="font-bold">Site Software</div>
          <div className="text-sm text-ink-500 dark:text-ink-400">One-click installs of popular open-source applications.</div>
        </div>
        <div className="relative ml-auto w-full sm:w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input className="input pl-9" placeholder="Search apps…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
      </div>

      {/* Installed apps */}
      <div className="card">
        <div className="p-4 border-b border-ink-100 dark:border-ink-800 font-bold flex items-center gap-2">
          <Box size={16} className="text-brand-600" /> Installed applications ({installed.length})
        </div>
        {installed.length === 0
          ? <EmptyState title="No applications installed yet" description="Pick an app from the catalog below." />
          : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Application</th><th>Version</th><th>Domain</th><th>Path</th><th>Installed</th><th></th></tr></thead>
                <tbody>
                  {installed.map(i => (
                    <tr key={i.id}>
                      <td className="font-semibold">{i.name}</td>
                      <td className="font-mono text-xs">{i.version}</td>
                      <td className="font-mono text-xs">{i.domain}</td>
                      <td className="font-mono text-xs">{i.install_path}</td>
                      <td className="text-xs text-ink-500">{date(i.installed_at)}</td>
                      <td className="text-right">
                        <button className="btn-ghost !p-1.5 text-rose-600" onClick={() => uninstall(i)}><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {/* Catalog */}
      <div className="space-y-4">
        {Object.entries(grouped).length === 0 && (
          <div className="card card-pad text-center text-ink-500">No applications match &ldquo;{q}&rdquo;.</div>
        )}
        {Object.entries(grouped).map(([category, items]) => (
          <section key={category} className="card">
            <div className="px-5 py-3 border-b border-ink-100 dark:border-ink-800 font-bold">{category}</div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
              {items.map(c => (
                <div key={c.slug} className="rounded-xl border border-ink-100 dark:border-ink-800 p-4 hover:border-brand-200 dark:hover:border-brand-700 transition">
                  <div className="flex items-start gap-3">
                    <div className="text-3xl leading-none">{c.icon}</div>
                    <div className="flex-1">
                      <div className="font-bold">{c.name}</div>
                      <div className="text-xs text-ink-500 dark:text-ink-400">v{c.version}</div>
                    </div>
                  </div>
                  <p className="text-xs text-ink-600 dark:text-ink-300 mt-2 leading-snug">{c.description}</p>
                  <button className="btn-primary w-full mt-3 !py-1.5" onClick={() => setInstalling(c)}>Install</button>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <Modal open={!!installing} onClose={() => setInstalling(null)} title={installing && `Install ${installing.name}`}
        footer={<>
          <button className="btn-soft" onClick={() => setInstalling(null)}>Cancel</button>
          <button form="inst-form" type="submit" disabled={busy} className="btn-primary">{busy ? 'Installing…' : 'Install'}</button>
        </>}>
        {installing && (
          <form id="inst-form" onSubmit={install} className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2 flex items-center gap-3">
              <span className="text-3xl">{installing.icon}</span>
              <div>
                <div className="font-bold">{installing.name} <span className="text-xs text-ink-500 font-mono ml-1">v{installing.version}</span></div>
                <div className="text-xs text-ink-500">{installing.description}</div>
              </div>
            </div>
            <div><label className="label">Domain</label>
              <select className="select" name="domain" required>
                <option value="">Select domain…</option>
                {domains.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
            </div>
            <div><label className="label">Install path</label>
              <input className="input font-mono" name="install_path" defaultValue="/" placeholder="/" />
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
