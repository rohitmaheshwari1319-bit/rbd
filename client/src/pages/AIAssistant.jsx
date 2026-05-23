import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar
} from 'recharts';
import {
  Sparkles, TrendingUp, TrendingDown, Mic, MicOff, Send, RefreshCw, Bot,
  Package, AlertTriangle, Copy
} from 'lucide-react';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { inr, num } from '../lib/format.js';

function useSpeech(onText) {
  const Recog = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
  const ref = useRef(null);
  const [listening, setListening] = useState(false);
  const start = () => {
    if (!Recog) return;
    const r = new Recog();
    r.lang = 'en-IN';
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = e => onText?.(e.results[0][0].transcript);
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    ref.current = r;
    setListening(true);
    r.start();
  };
  const stop = () => { try { ref.current?.stop(); } catch { /* */ } };
  return { supported: !!Recog, listening, start, stop };
}

export default function AIAssistant() {
  const toast = useToast();
  const [section, setSection] = useState('chat');
  return (
    <div className="space-y-4">
      <div className="card card-pad flex items-center gap-3">
        <Sparkles className="text-rbd-600" />
        <div>
          <div className="font-bold">AI tools</div>
          <div className="text-sm text-ink-500 dark:text-ink-400">Forecasts, reorder advice, anomaly detection and chat.</div>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap gap-1 p-2 border-b border-ink-100 dark:border-ink-800">
          {[
            ['chat', 'Chat assistant'],
            ['forecast', 'Demand forecast'],
            ['reorder', 'Reorder advisor'],
            ['movers', 'Fast / slow movers'],
            ['duplicates', 'Duplicate detector']
          ].map(([k, l]) => (
            <button key={k} onClick={() => setSection(k)}
                    className={`px-4 py-2 text-sm font-semibold rounded-lg ${section === k
                      ? 'bg-rbd-50 text-rbd-700 dark:bg-rbd-900/30 dark:text-rbd-200'
                      : 'text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800'}`}>
              {l}
            </button>
          ))}
        </div>
        <div className="p-4">
          {section === 'chat' && <ChatTab />}
          {section === 'forecast' && <ForecastTab />}
          {section === 'reorder' && <ReorderTab />}
          {section === 'movers' && <MoversTab />}
          {section === 'duplicates' && <DuplicatesTab />}
        </div>
      </div>
    </div>
  );
}

// ---------- Chat ----------
function ChatTab() {
  const toast = useToast();
  const [messages, setMessages] = useState([
    { from: 'bot', text: "Hi! I'm RBD's AI inventory assistant. Ask me anything — try \"top selling products\" or \"low stock\"." }
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  const speech = useSpeech(t => { setInput(t); setTimeout(() => send(t), 50); });

  useEffect(() => { ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' }); }, [messages]);

  const send = async (override) => {
    const text = (override ?? input).trim();
    if (!text) return;
    setMessages(m => [...m, { from: 'me', text }]);
    setInput(''); setBusy(true);
    try {
      const r = await api.post('/ai/chat', { message: text });
      setMessages(m => [...m, { from: 'bot', text: r.reply }]);
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const SUGGEST = ["What are today's sales?", 'Show low stock', 'Top selling products', 'Pending payments', 'Stock of Tractor Oil Filter'];

  return (
    <div className="space-y-3">
      <div ref={ref} className="h-[440px] overflow-y-auto space-y-3 p-4 rounded-xl bg-ink-50 dark:bg-ink-800/40 border border-ink-100 dark:border-ink-800">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.from === 'me' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-line shadow-sm ${m.from === 'me'
              ? 'bg-rbd-600 text-white rounded-br-none'
              : 'bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 rounded-bl-none'}`}>
              {m.from === 'bot' && (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-rbd-600 dark:text-rbd-300 mb-1">
                  <Bot size={12} /> RBD AI
                </div>
              )}
              {m.text}
            </div>
          </div>
        ))}
        {busy && <div className="text-xs text-ink-500 animate-pulse-soft">RBD AI is thinking…</div>}
      </div>

      <div className="flex flex-wrap gap-2">
        {SUGGEST.map(s => (
          <button key={s} className="badge-slate hover:bg-ink-200 cursor-pointer" onClick={() => send(s)}>{s}</button>
        ))}
      </div>

      <form className="flex gap-2" onSubmit={e => { e.preventDefault(); send(); }}>
        <input className="input flex-1" placeholder="Ask RBD AI…" value={input} onChange={e => setInput(e.target.value)} />
        {speech.supported && (
          <button type="button" onClick={() => speech.listening ? speech.stop() : speech.start()}
                  className={`btn-soft ${speech.listening ? '!bg-rbd-100 !text-rbd-700 animate-pulse-soft' : ''}`}
                  title={speech.listening ? 'Listening… click to stop' : 'Voice search'}>
            {speech.listening ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
        )}
        <button type="submit" className="btn-primary"><Send size={16} /></button>
      </form>
    </div>
  );
}

// ---------- Forecast ----------
function ForecastTab() {
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [pid, setPid] = useState('');
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/products?limit=500').then(p => { setProducts(p); if (p[0]) setPid(p[0].id); })
      .catch(e => toast.error(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!pid) return;
    api.get(`/ai/forecast/${pid}`).then(setData).catch(e => toast.error(e.message));
  }, [pid, toast]);

  const series = useMemo(() => {
    if (!data) return [];
    return [
      ...data.history.map(h => ({ day: h.day, history: h.qty })),
      ...data.forecast.map(f => ({ day: f.day, forecast: f.qty }))
    ];
  }, [data]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select className="select max-w-md" value={pid} onChange={e => setPid(e.target.value)}>
          {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
        </select>
      </div>
      {data && (
        <>
          <div className="grid sm:grid-cols-4 gap-3">
            <Stat label="Daily average" v={num(data.daily_average)} />
            <Stat label="14-day demand" v={num(data.expected_14_day_demand)} />
            <Stat label="Stock now" v={num(data.stock_now)} />
            <Stat label="Days of cover" v={data.days_of_cover === 999 ? '∞' : data.days_of_cover} accent={data.days_of_cover < 7} />
          </div>
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="h" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#494E58" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#494E58" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="f" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#E11D2E" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#E11D2E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="history" stroke="#494E58" fill="url(#h)" strokeWidth={2} name="History" />
                <Area type="monotone" dataKey="forecast" stroke="#E11D2E" fill="url(#f)" strokeWidth={2.5} strokeDasharray="6 4" name="AI forecast" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="text-xs text-ink-500 dark:text-ink-400">
            Trend slope: <b>{data.trend_slope}</b> units/day —
            {data.trend_slope > 0 ? <span className="text-emerald-600"> demand rising</span>
              : data.trend_slope < 0 ? <span className="text-rbd-600"> demand softening</span>
              : <span> stable demand</span>}.
          </div>
        </>
      )}
    </div>
  );
}

// ---------- Reorder ----------
function ReorderTab() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [lead, setLead] = useState(7);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    try { setRows(await api.get(`/ai/reorder-suggestions?lead_days=${lead}`)); }
    catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [lead]); // eslint-disable-line

  const copy = () => {
    const text = rows.map(r => `${r.sku}\t${r.name}\t${r.suggested_qty}`).join('\n');
    navigator.clipboard.writeText(text); toast.success('Copied to clipboard');
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="label !mb-0">Lead time (days):</label>
        <input className="input !w-24" type="number" value={lead} onChange={e => setLead(Number(e.target.value) || 1)} />
        <button className="btn-soft" onClick={load}><RefreshCw size={14} /> Refresh</button>
        <button className="btn-soft ml-auto" onClick={copy}><Copy size={14} /> Copy purchase list</button>
      </div>
      <div className="overflow-x-auto -mx-2">
        <table className="table min-w-[700px]">
          <thead><tr><th>Product</th><th>SKU</th><th className="text-right">Stock now</th><th className="text-right">Daily avg</th><th className="text-right">Suggested qty</th><th>Reason</th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="!py-6 text-center text-ink-500">Computing…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={6} className="!py-12 text-center text-ink-500">All products are sufficiently stocked. ✨</td></tr>}
            {rows.map(r => (
              <tr key={r.product_id}>
                <td className="font-semibold">{r.name}</td>
                <td className="font-mono text-xs">{r.sku}</td>
                <td className="text-right">{r.stock_now}</td>
                <td className="text-right">{r.daily_average}</td>
                <td className="text-right"><span className="badge-red">{r.suggested_qty}</span></td>
                <td><span className="badge-slate text-xs">{r.reason.replace('_', ' ')}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- Movers ----------
function MoversTab() {
  const toast = useToast();
  const [data, setData] = useState(null);
  useEffect(() => { api.get('/ai/movers').then(setData).catch(e => toast.error(e.message)); }, [toast]);
  if (!data) return <div className="py-12 text-center text-ink-500">Loading…</div>;

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Block title="Fast movers (last 30 days)" icon={<TrendingUp className="text-emerald-600" size={18} />}
        rows={data.fast} accent="green" />
      <Block title="Slow movers" icon={<TrendingDown className="text-rbd-600" size={18} />}
        rows={data.slow} accent="red" />
      <div className="lg:col-span-2 h-72">
        <ResponsiveContainer>
          <BarChart data={data.fast.slice(0, 8)}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-15} textAnchor="end" height={70} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v, k) => k === 'revenue' ? inr(v) : num(v)} />
            <Bar dataKey="qty" fill="#E11D2E" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ---------- Duplicates ----------
function DuplicatesTab() {
  const toast = useToast();
  const [pairs, setPairs] = useState([]);
  useEffect(() => { api.get('/ai/duplicates').then(setPairs).catch(e => toast.error(e.message)); }, [toast]);
  return (
    <div>
      {pairs.length === 0
        ? <div className="py-12 text-center text-ink-500">No suspected duplicates found. ✨</div>
        : (
          <div className="space-y-2">
            {pairs.map((p, i) => (
              <div key={i} className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-900 p-3 flex items-center gap-3">
                <AlertTriangle className="text-amber-600" />
                <div className="grid sm:grid-cols-2 gap-2 flex-1">
                  <div><div className="font-semibold">{p.a.name}</div><div className="text-xs text-ink-500 font-mono">{p.a.sku}</div></div>
                  <div><div className="font-semibold">{p.b.name}</div><div className="text-xs text-ink-500 font-mono">{p.b.sku}</div></div>
                </div>
                <div className="badge-amber">{Math.round(p.similarity * 100)}% match</div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

// ---------- shared ----------
function Stat({ label, v, accent }) {
  return (
    <div className={`rounded-xl p-3 border ${accent ? 'border-rbd-200 bg-rbd-50 dark:bg-rbd-900/30 dark:border-rbd-900' : 'border-ink-100 bg-ink-50 dark:bg-ink-800/40 dark:border-ink-800'}`}>
      <div className="text-xs uppercase tracking-wide text-ink-500 dark:text-ink-400">{label}</div>
      <div className={`text-2xl font-extrabold mt-1 ${accent ? 'text-rbd-700 dark:text-rbd-200' : ''}`}>{v}</div>
    </div>
  );
}
function Block({ title, icon, rows, accent }) {
  return (
    <div className="rounded-xl border border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900">
      <div className="px-4 py-3 border-b border-ink-100 dark:border-ink-800 font-bold flex items-center gap-2">{icon} {title}</div>
      <ul>
        {rows.length === 0 && <li className="px-4 py-6 text-center text-ink-500">No data</li>}
        {rows.map((r, i) => (
          <li key={r.id} className="flex items-center justify-between px-4 py-2.5 border-t border-ink-100 dark:border-ink-800 text-sm">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`h-8 w-8 grid place-items-center rounded-lg ${accent === 'green' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-rbd-50 text-rbd-600 dark:bg-rbd-900/30 dark:text-rbd-300'}`}>
                <Package size={16} />
              </div>
              <div className="min-w-0">
                <div className="font-semibold truncate">{r.name}</div>
                <div className="text-xs text-ink-500">{r.sku}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-bold">{num(r.qty)} units</div>
              <div className="text-xs text-ink-500">{inr(r.revenue)}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
