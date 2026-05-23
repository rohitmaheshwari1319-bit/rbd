import React, { useEffect, useState } from 'react';
import { Bell, CheckCheck, RefreshCw, Trash2, Sparkles } from 'lucide-react';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { dt } from '../lib/format.js';

export default function Notifications() {
  const toast = useToast();
  const { can } = useAuth();
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try { setItems(await api.get('/notifications')); } catch (e) { toast.error(e.message); }
  };
  useEffect(() => { load(); }, []);

  const markAll = async () => {
    setBusy(true);
    try { await api.post('/notifications/read-all'); load(); }
    catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const rescan = async () => {
    setBusy(true);
    try {
      const r = await api.post('/notifications/scan');
      toast.success(`AI scan generated ${r.created} alerts`);
      load();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const tone = s =>
    s === 'warning' ? 'border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-900 text-amber-900 dark:text-amber-100' :
    s === 'success' ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-900' :
    'border-ink-200 bg-white dark:bg-ink-900 dark:border-ink-700';

  return (
    <div className="space-y-4">
      <div className="card card-pad flex flex-wrap items-center gap-3">
        <Bell className="text-rbd-600" />
        <div>
          <div className="font-bold">Notifications</div>
          <div className="text-sm text-ink-500 dark:text-ink-400">Low-stock, payment and operational alerts.</div>
        </div>
        <div className="ml-auto flex gap-2">
          {can('admin', 'manager') && (
            <button className="btn-soft" disabled={busy} onClick={rescan}><Sparkles size={14} /> AI scan</button>
          )}
          <button className="btn-soft" onClick={markAll} disabled={busy}><CheckCheck size={14} /> Mark all read</button>
          <button className="btn-soft" onClick={load}><RefreshCw size={14} /> Refresh</button>
        </div>
      </div>

      {items.length === 0 && (
        <div className="card card-pad"><EmptyState icon={Bell} title="No notifications" description="You're all caught up." /></div>
      )}

      <div className="space-y-2">
        {items.map(n => (
          <div key={n.id} className={`rounded-xl border px-4 py-3 ${tone(n.severity)} ${n.read ? 'opacity-70' : ''}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-bold flex items-center gap-2">
                  {!n.read && <span className="h-2 w-2 rounded-full bg-rbd-600 animate-pulse-soft" />}
                  {n.title}
                </div>
                {n.body && <div className="text-sm mt-0.5">{n.body}</div>}
                <div className="text-xs text-ink-500 dark:text-ink-400 mt-1">{dt(n.created_at)} · {n.type}</div>
              </div>
              <div className="flex items-center gap-1">
                {!n.read && (
                  <button className="btn-ghost !p-1.5" onClick={async () => { await api.post(`/notifications/${n.id}/read`); load(); }}>
                    <CheckCheck size={14} />
                  </button>
                )}
                {can('admin', 'manager') && (
                  <button className="btn-ghost !p-1.5 text-rbd-600" onClick={async () => { await api.delete(`/notifications/${n.id}`); load(); }}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
