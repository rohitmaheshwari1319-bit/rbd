import React, { useEffect, useState } from 'react';
import { ShieldCheck, RefreshCw, Trash2, Plus, AlertTriangle } from 'lucide-react';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import Modal from '../components/Modal.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { date } from '../lib/format.js';

export default function SSL() {
  const toast = useToast();
  const [certs, setCerts] = useState([]);
  const [domains, setDomains] = useState([]);
  const [provisioning, setProvisioning] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [c, d] = await Promise.all([api.get('/ssl'), api.get('/domains')]);
      setCerts(c); setDomains(d);
    } catch (e) { toast.error(e.message); }
  };
  useEffect(() => { load(); }, []);

  const provision = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      await api.post('/ssl/provision', {
        domain: new FormData(e.target).get('domain'),
        auto_renew: 1
      });
      toast.success('Certificate provisioned'); setProvisioning(false); load();
    } catch (err) { toast.error(err.message); }
    finally { setBusy(false); }
  };

  const renew = async (c) => {
    try { await api.post(`/ssl/${c.id}/renew`); toast.success('Renewed for 90 days'); load(); }
    catch (e) { toast.error(e.message); }
  };

  const revoke = async (c) => {
    if (!confirm(`Revoke certificate for ${c.domain}?`)) return;
    try { await api.delete(`/ssl/${c.id}`); toast.success('Revoked'); load(); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="card card-pad flex flex-wrap items-center gap-3">
        <ShieldCheck className="text-brand-600" />
        <div>
          <div className="font-bold">SSL/TLS Certificates</div>
          <div className="text-sm text-ink-500 dark:text-ink-400">Free Let&rsquo;s Encrypt certificates with auto-renewal.</div>
        </div>
        <button className="btn-primary ml-auto" onClick={() => setProvisioning(true)}><Plus size={16} /> Provision certificate</button>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>Domain</th><th>Issuer</th><th>Issued</th><th>Expires</th><th>Days left</th><th>Auto-renew</th><th></th></tr></thead>
            <tbody>
              {certs.length === 0 && <tr><td colSpan={7}><EmptyState icon={ShieldCheck} title="No certificates yet" description="Provision a free SSL certificate from Let's Encrypt." /></td></tr>}
              {certs.map(c => {
                const warn = c.days_remaining <= 30;
                const danger = c.days_remaining <= 14;
                return (
                  <tr key={c.id}>
                    <td className="font-mono font-semibold">{c.domain}</td>
                    <td className="text-xs">{c.issuer}</td>
                    <td className="text-xs">{date(c.issued_at)}</td>
                    <td className="text-xs">{date(c.expires_at)}</td>
                    <td>
                      <span className={danger ? 'badge-red' : warn ? 'badge-amber' : 'badge-green'}>
                        {danger && <AlertTriangle size={11} />} {c.days_remaining} days
                      </span>
                    </td>
                    <td>{c.auto_renew ? <span className="badge-blue">on</span> : <span className="badge-slate">off</span>}</td>
                    <td className="text-right whitespace-nowrap">
                      <button className="btn-ghost !p-1.5" onClick={() => renew(c)} title="Renew now"><RefreshCw size={14} /></button>
                      <button className="btn-ghost !p-1.5 text-rose-600" onClick={() => revoke(c)} title="Revoke"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={provisioning} onClose={() => setProvisioning(false)} title="Provision SSL certificate"
        footer={<>
          <button className="btn-soft" onClick={() => setProvisioning(false)}>Cancel</button>
          <button form="prov-form" type="submit" disabled={busy} className="btn-primary">{busy ? 'Provisioning…' : 'Provision'}</button>
        </>}>
        <form id="prov-form" onSubmit={provision} className="space-y-3">
          <div><label className="label">Domain</label>
            <select className="select" name="domain" required>
              <option value="">Choose domain…</option>
              {domains.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
          </div>
          <div className="rounded-lg bg-brand-50 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-900 p-3 text-xs">
            We&rsquo;ll request a free 90-day Let&rsquo;s Encrypt certificate covering <code>example.com</code> and
            <code> www.example.com</code>. Auto-renewal will run 30 days before expiry.
          </div>
        </form>
      </Modal>
    </div>
  );
}
