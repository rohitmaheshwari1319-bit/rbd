import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { ScanLine, Plus, Minus, Camera, Check, X, KeyboardIcon } from 'lucide-react';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { inr } from '../lib/format.js';

const READER_ID = 'rbd-scanner';

export default function Scanner() {
  const toast = useToast();
  const [warehouses, setWarehouses] = useState([]);
  const [warehouse_id, setWarehouseId] = useState('');
  const [action, setAction] = useState('in');
  const [batch, setBatch] = useState(true);
  const [active, setActive] = useState(false);
  const [history, setHistory] = useState([]);
  const [manual, setManual] = useState('');
  const scannerRef = useRef(null);

  useEffect(() => {
    api.get('/warehouses').then(w => { setWarehouses(w); if (w[0]) setWarehouseId(w[0].id); })
      .catch(e => toast.error(e.message));
    return () => { stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stop = async () => {
    try { if (scannerRef.current) { await scannerRef.current.stop(); scannerRef.current.clear(); } }
    catch { /* ignore */ }
    scannerRef.current = null;
    setActive(false);
  };

  const handleCode = async (code) => {
    if (!warehouse_id) { toast.error('Select a warehouse first'); return; }
    try {
      const r = await api.post('/stock/scan', { code, warehouse_id: Number(warehouse_id), action, quantity: 1 });
      setHistory(h => [{ at: new Date(), product: r.product, code, action, qty: r.quantity, status: 'ok' }, ...h].slice(0, 50));
      toast.success(`${action === 'in' ? '+1 in' : '-1 out'}: ${r.product.name}`);
    } catch (e) {
      setHistory(h => [{ at: new Date(), code, action, status: 'error', error: e.message }, ...h].slice(0, 50));
      toast.error(e.message);
    }
  };

  const start = async () => {
    if (!warehouse_id) { toast.error('Select a warehouse first'); return; }
    try {
      const inst = new Html5Qrcode(READER_ID, { verbose: false });
      scannerRef.current = inst;
      await inst.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 260, height: 160 } },
        async (decoded) => {
          await handleCode(decoded);
          if (!batch) await stop();
        },
        () => { /* ignore frame errors */ }
      );
      setActive(true);
    } catch (e) {
      toast.error('Camera blocked or unavailable. Use manual entry.');
    }
  };

  const submitManual = (e) => {
    e?.preventDefault?.();
    const code = manual.trim();
    if (!code) return;
    handleCode(code);
    setManual('');
  };

  return (
    <div className="space-y-4">
      <div className="card card-pad flex flex-wrap items-center gap-3">
        <ScanLine className="text-rbd-600" />
        <div>
          <div className="font-bold">Barcode / QR scanner</div>
          <div className="text-sm text-ink-500 dark:text-ink-400">Update stock instantly via camera or USB scanner.</div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select className="select max-w-[220px]" value={warehouse_id} onChange={e => setWarehouseId(e.target.value)}>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <div className="inline-flex rounded-lg border border-ink-200 dark:border-ink-700 overflow-hidden">
            <button className={`px-3 py-1.5 text-sm font-semibold inline-flex items-center gap-1 ${action === 'in' ? 'bg-rbd-600 text-white' : 'bg-white dark:bg-ink-900 text-ink-700 dark:text-ink-200'}`}
                    onClick={() => setAction('in')}><Plus size={14} /> In</button>
            <button className={`px-3 py-1.5 text-sm font-semibold inline-flex items-center gap-1 ${action === 'out' ? 'bg-rbd-600 text-white' : 'bg-white dark:bg-ink-900 text-ink-700 dark:text-ink-200'}`}
                    onClick={() => setAction('out')}><Minus size={14} /> Out</button>
          </div>
          <label className="flex items-center gap-1.5 text-sm font-medium px-2">
            <input type="checkbox" checked={batch} onChange={e => setBatch(e.target.checked)} /> Batch mode
          </label>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card card-pad lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div className="font-bold">Camera</div>
            {active
              ? <button className="btn-soft" onClick={stop}><X size={14} /> Stop</button>
              : <button className="btn-primary" onClick={start}><Camera size={14} /> Start camera</button>}
          </div>
          <div id={READER_ID} className="aspect-video w-full max-w-md mx-auto bg-ink-100 dark:bg-ink-800 rounded-xl overflow-hidden grid place-items-center">
            {!active && <div className="text-ink-500 dark:text-ink-400 text-sm flex flex-col items-center"><Camera size={28} /><span className="mt-2">Camera idle</span></div>}
          </div>

          <form onSubmit={submitManual} className="mt-4 flex gap-2">
            <div className="relative flex-1">
              <KeyboardIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input className="input pl-9" placeholder="Or type/paste barcode and press Enter…"
                     autoFocus value={manual} onChange={e => setManual(e.target.value)} />
            </div>
            <button className="btn-primary" type="submit">Submit</button>
          </form>
          <p className="text-xs text-ink-500 dark:text-ink-400 mt-2">
            Tip: most USB barcode scanners act like keyboards. Focus this field and scan to update stock instantly.
          </p>
        </div>

        <div className="card card-pad">
          <div className="font-bold mb-2">Recent scans</div>
          {history.length === 0 ? (
            <div className="text-sm text-ink-500 dark:text-ink-400 py-8 text-center">Nothing scanned yet.</div>
          ) : (
            <ul className="space-y-2 max-h-[420px] overflow-y-auto">
              {history.map((h, i) => (
                <li key={i} className={`rounded-lg border px-3 py-2 text-sm ${h.status === 'ok'
                  ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-900'
                  : 'border-rbd-200 bg-rbd-50 dark:bg-rbd-900/20 dark:border-rbd-900'}`}>
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-xs">{h.code}</div>
                    <span className={`badge-${h.action === 'in' ? 'green' : 'red'}`}>{h.action}</span>
                  </div>
                  {h.status === 'ok' ? (
                    <>
                      <div className="font-semibold">{h.product.name}</div>
                      <div className="text-xs text-ink-500 dark:text-ink-400">Stock now: {h.qty} · {inr(h.product.selling_price)}</div>
                    </>
                  ) : <div className="text-xs text-rbd-700 dark:text-rbd-300">{h.error}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
