import React, { useEffect, useState } from 'react';
import { Plus, Trash2, ScrollText, Pencil } from 'lucide-react';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import Modal from '../components/Modal.jsx';
import EmptyState from '../components/EmptyState.jsx';

const PRESETS = [
  { label: 'Every minute',     v: { minute: '*',    hour: '*',   day: '*', month: '*', weekday: '*' } },
  { label: 'Every 5 minutes',  v: { minute: '*/5',  hour: '*',   day: '*', month: '*', weekday: '*' } },
  { label: 'Every 15 minutes', v: { minute: '*/15', hour: '*',   day: '*', month: '*', weekday: '*' } },
  { label: 'Every hour',       v: { minute: '0',    hour: '*',   day: '*', month: '*', weekday: '*' } },
  { label: 'Every 6 hours',    v: { minute: '0',    hour: '*/6', day: '*', month: '*', weekday: '*' } },
  { label: 'Once a day (2am)', v: { minute: '0',    hour: '2',   day: '*', month: '*', weekday: '*' } },
  { label: 'Weekly (Sun 3am)', v: { minute: '0',    hour: '3',   day: '*', month: '*', weekday: '0' } },
  { label: 'Monthly (1st 4am)',v: { minute: '0',    hour: '4',   day: '1', month: '*', weekday: '*' } }
];

export default function Cron() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [editor, setEditor] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try { setItems(await api.get('/cron')); } catch (e) { toast.error(e.message); }
  };
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const fd = new FormData(e.target);
      const body = {
        minute: fd.get('minute'),
        hour: fd.get('hour'),
        day: fd.get('day'),
        month: fd.get('month'),
        weekday: fd.get('weekday'),
        command: fd.get('command'),
        enabled: fd.get('enabled') === 'on' ? 1 : 0
      };
      if (editor?.id) await api.patch(`/cron/${editor.id}`, body);
      else await api.post('/cron', body);
      toast.success('Saved'); setEditor(null); load();
    } catch (err) { toast.error(err.message); }
    finally { setBusy(false); }
  };

  const remove = async (c) => {
    if (!confirm('Delete cron job?')) return;
    try { await api.delete(`/cron/${c.id}`); toast.success('Removed'); load(); }
    catch (e) { toast.error(e.message); }
  };

  const toggle = async (c) => {
    try {
      await api.patch(`/cron/${c.id}`, { enabled: !c.enabled });
      load();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-center justify-between p-4 border-b border-ink-100 dark:border-ink-800">
          <h2 className="font-bold flex items-center gap-2"><ScrollText size={16} className="text-brand-600" /> Cron Jobs</h2>
          <button className="btn-primary" onClick={() => setEditor({ minute: '0', hour: '*', day: '*', month: '*', weekday: '*', enabled: 1 })}>
            <Plus size={16} /> New cron job
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Schedule</th><th>Command</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan={4}><EmptyState icon={ScrollText} title="No cron jobs" /></td></tr>}
              {items.map(c => (
                <tr key={c.id}>
                  <td className="font-mono text-xs whitespace-nowrap">
                    {c.minute} {c.hour} {c.day} {c.month} {c.weekday}
                  </td>
                  <td className="font-mono text-xs break-all max-w-md">{c.command}</td>
                  <td>
                    <button onClick={() => toggle(c)}
                            className={c.enabled ? 'badge-green hover:bg-emerald-100' : 'badge-slate hover:bg-ink-200'}>
                      {c.enabled ? 'enabled' : 'disabled'}
                    </button>
                  </td>
                  <td className="text-right whitespace-nowrap">
                    <button className="btn-ghost !p-1.5" onClick={() => setEditor(c)}><Pencil size={14} /></button>
                    <button className="btn-ghost !p-1.5 text-rose-600" onClick={() => remove(c)}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!editor} onClose={() => setEditor(null)} title={editor?.id ? 'Edit cron job' : 'New cron job'}
        size="lg"
        footer={<>
          <button className="btn-soft" onClick={() => setEditor(null)}>Cancel</button>
          <button form="cron-form" type="submit" disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Save'}</button>
        </>}>
        {editor && (
          <form id="cron-form" onSubmit={save} className="space-y-4">
            <div>
              <label className="label">Common settings</label>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map(p => (
                  <button type="button" key={p.label} className="badge-slate hover:bg-ink-200 cursor-pointer"
                    onClick={() => setEditor(prev => ({ ...prev, ...p.v }))}>{p.label}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {[['minute', '*/5'], ['hour', '*'], ['day', '*'], ['month', '*'], ['weekday', '*']].map(([k, eg]) => (
                <div key={k}>
                  <label className="label !text-[10px] capitalize">{k}</label>
                  <input className="input font-mono text-center !px-2" name={k}
                         defaultValue={editor[k] ?? '*'} placeholder={eg} />
                </div>
              ))}
            </div>
            <div>
              <label className="label">Command *</label>
              <textarea className="textarea font-mono" name="command" rows={3} required defaultValue={editor.command || ''}
                        placeholder="/usr/bin/php /home/demo/public_html/script.php" />
            </div>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" name="enabled" defaultChecked={!!editor.enabled} /> Enabled
            </label>
          </form>
        )}
      </Modal>
    </div>
  );
}
