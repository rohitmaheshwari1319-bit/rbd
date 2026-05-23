import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronRight, FolderPlus, FilePlus2, Folder, FileText, RefreshCw, Pencil,
  Trash2, Save, X, Home, FolderOpen, FileCode, Image as ImageIcon
} from 'lucide-react';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import Modal from '../components/Modal.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { bytes, dt } from '../lib/format.js';

const HOME = '/home/demo';

function iconFor(entry) {
  if (entry.type === 'dir') return Folder;
  const ext = entry.name.split('.').pop()?.toLowerCase();
  if (['html', 'htm', 'css', 'js', 'json', 'php', 'py', 'rb', 'sh', 'xml', 'yaml', 'yml'].includes(ext)) return FileCode;
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return ImageIcon;
  return FileText;
}

export default function FileManager() {
  const toast = useToast();
  const [path, setPath] = useState(HOME);
  const [data, setData] = useState({ entries: [] });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(null);   // {type:'file'|'dir'}
  const [renaming, setRenaming] = useState(null);
  const [editor, setEditor] = useState(null);       // {path, name, content, dirty}
  const [busy, setBusy] = useState(false);

  const load = async (p = path) => {
    setLoading(true);
    try {
      const r = await api.get(`/files/list?path=${encodeURIComponent(p)}`);
      setData(r); setPath(r.path);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(HOME); /* eslint-disable-next-line */ }, []);

  const goUp = () => {
    if (path === HOME) return;
    const parent = path.split('/').slice(0, -1).join('/') || '/';
    load(parent);
  };

  const open = (entry) => {
    if (entry.type === 'dir') return load(entry.path);
    api.get(`/files/read?path=${encodeURIComponent(entry.path)}`)
      .then(f => setEditor({ ...f, dirty: false }))
      .catch(e => toast.error(e.message));
  };

  const breadcrumbs = useMemo(() => {
    const parts = path.split('/').filter(Boolean);
    const acc = [];
    let cur = '';
    for (const p of parts) {
      cur += '/' + p;
      acc.push({ name: p, path: cur });
    }
    return acc;
  }, [path]);

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const fd = new FormData(e.target);
      await api.post('/files/create', {
        path,
        name: fd.get('name'),
        type: creating.type,
        content: fd.get('content') || ''
      });
      toast.success(`${creating.type === 'dir' ? 'Folder' : 'File'} created`);
      setCreating(null);
      load();
    } catch (err) { toast.error(err.message); }
    finally { setBusy(false); }
  };

  const remove = async (entry) => {
    if (!confirm(`Delete "${entry.name}"${entry.type === 'dir' ? ' and all contents' : ''}?`)) return;
    try { await api.delete(`/files/delete?path=${encodeURIComponent(entry.path)}`); toast.success('Deleted'); load(); }
    catch (e) { toast.error(e.message); }
  };

  const rename = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const newName = new FormData(e.target).get('newName');
      await api.post('/files/rename', { path: renaming.path, newName });
      toast.success('Renamed');
      setRenaming(null);
      load();
    } catch (err) { toast.error(err.message); }
    finally { setBusy(false); }
  };

  const save = async () => {
    setBusy(true);
    try {
      await api.put('/files/save', { path: editor.path, content: editor.content });
      toast.success('Saved');
      setEditor({ ...editor, dirty: false });
      load();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      {/* Breadcrumb + actions */}
      <div className="card card-pad">
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-ghost !p-2" onClick={() => load(HOME)} title="Home"><Home size={16} /></button>
          <button className="btn-ghost !p-2" onClick={goUp} disabled={path === HOME} title="Up one level">↑</button>
          <button className="btn-ghost !p-2" onClick={() => load(path)} title="Refresh"><RefreshCw size={16} /></button>

          <div className="ml-2 flex flex-wrap items-center gap-1 text-sm">
            <span className="text-ink-500 font-mono">/</span>
            {breadcrumbs.map((b, i) => (
              <React.Fragment key={b.path}>
                <button onClick={() => load(b.path)}
                        className={`px-1.5 py-0.5 rounded font-mono ${i === breadcrumbs.length - 1 ? 'font-semibold text-ink-900 dark:text-white' : 'text-brand-600 hover:underline'}`}>
                  {b.name}
                </button>
                {i < breadcrumbs.length - 1 && <ChevronRight size={12} className="text-ink-400" />}
              </React.Fragment>
            ))}
          </div>

          <div className="ml-auto flex flex-wrap gap-2">
            <button className="btn-soft" onClick={() => setCreating({ type: 'dir' })}><FolderPlus size={16} /> New folder</button>
            <button className="btn-primary" onClick={() => setCreating({ type: 'file' })}><FilePlus2 size={16} /> New file</button>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th><th>Size</th><th>Type</th><th>Owner</th><th>Perms</th><th>Modified</th><th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="!py-12 text-center text-ink-500">Loading…</td></tr>
            )}
            {!loading && data.entries.length === 0 && (
              <tr><td colSpan={7}><EmptyState icon={FolderOpen} title="Empty folder" description="Create a file or folder to get started." /></td></tr>
            )}
            {data.entries.map(e => {
              const Icon = iconFor(e);
              return (
                <tr key={e.id} className="cursor-pointer" onClick={() => open(e)} onDoubleClick={() => open(e)}>
                  <td className="font-medium">
                    <span className="inline-flex items-center gap-2">
                      <Icon size={16} className={e.type === 'dir' ? 'text-amber-500' : 'text-brand-600'} />
                      <span className="truncate max-w-[420px]">{e.name}</span>
                    </span>
                  </td>
                  <td>{e.type === 'dir' ? '—' : bytes(e.size)}</td>
                  <td><span className="badge-slate">{e.mime || (e.type === 'dir' ? 'folder' : 'file')}</span></td>
                  <td className="font-mono text-xs">{e.owner}</td>
                  <td className="font-mono text-xs">{e.perms}</td>
                  <td className="text-xs text-ink-500 dark:text-ink-400">{dt(e.modified_at)}</td>
                  <td className="text-right whitespace-nowrap" onClick={ev => ev.stopPropagation()}>
                    <button className="btn-ghost !p-1.5" onClick={() => setRenaming(e)} title="Rename"><Pencil size={14} /></button>
                    <button className="btn-ghost !p-1.5 text-rose-600" onClick={() => remove(e)} title="Delete"><Trash2 size={14} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Create modal */}
      <Modal open={!!creating} onClose={() => setCreating(null)}
        title={creating?.type === 'dir' ? 'New folder' : 'New file'}
        footer={
          <>
            <button className="btn-soft" onClick={() => setCreating(null)}>Cancel</button>
            <button form="create-form" type="submit" disabled={busy} className="btn-primary">{busy ? 'Creating…' : 'Create'}</button>
          </>
        }>
        {creating && (
          <form id="create-form" onSubmit={create} className="space-y-3">
            <div><label className="label">Location</label>
              <div className="font-mono text-xs px-3 py-2 rounded-lg bg-ink-50 dark:bg-ink-800/60 border border-ink-100 dark:border-ink-700">{path}</div>
            </div>
            <div><label className="label">Name *</label>
              <input className="input" name="name" required autoFocus
                     placeholder={creating.type === 'dir' ? 'my-folder' : 'index.html'} />
            </div>
            {creating.type === 'file' && (
              <div><label className="label">Initial content (optional)</label>
                <textarea className="textarea font-mono" name="content" rows={6} />
              </div>
            )}
          </form>
        )}
      </Modal>

      {/* Rename modal */}
      <Modal open={!!renaming} onClose={() => setRenaming(null)} title={`Rename ${renaming?.name}`}
        footer={
          <>
            <button className="btn-soft" onClick={() => setRenaming(null)}>Cancel</button>
            <button form="rename-form" type="submit" disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Rename'}</button>
          </>
        }>
        {renaming && (
          <form id="rename-form" onSubmit={rename}>
            <label className="label">New name</label>
            <input className="input" name="newName" defaultValue={renaming.name} required autoFocus />
          </form>
        )}
      </Modal>

      {/* Editor modal */}
      <Modal open={!!editor} onClose={() => setEditor(null)} title={editor ? `Edit — ${editor.name}` : ''} size="xl"
        footer={
          editor && (
            <>
              <span className="mr-auto text-xs text-ink-500">{editor.path} · {bytes(editor.content?.length || 0)} {editor.dirty ? '· unsaved' : ''}</span>
              <button className="btn-soft" onClick={() => setEditor(null)}><X size={14} /> Close</button>
              <button className="btn-primary" onClick={save} disabled={busy || !editor.dirty}><Save size={14} /> Save</button>
            </>
          )
        }>
        {editor && (
          <textarea
            className="code-editor"
            value={editor.content}
            onChange={e => setEditor({ ...editor, content: e.target.value, dirty: true })}
            spellCheck={false}
            onKeyDown={e => {
              if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save(); }
            }}
          />
        )}
      </Modal>
    </div>
  );
}
