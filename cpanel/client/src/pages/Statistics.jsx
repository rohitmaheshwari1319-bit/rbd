import React, { useEffect, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, ResponsiveContainer,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';
import { BarChart3, Activity, Users, HardDrive, Cpu, MemoryStick, RefreshCw } from 'lucide-react';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { mb, num, pct } from '../lib/format.js';

export default function Statistics() {
  const toast = useToast();
  const [days, setDays] = useState(30);
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async (d = days) => {
    setLoading(true);
    try { setSeries(await api.get(`/stats/series?days=${d}`)); }
    catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(days); /* eslint-disable-next-line */ }, [days]);

  const tot = series.reduce((acc, r) => ({
    bw: acc.bw + (r.bandwidth_mb || 0),
    visitors: acc.visitors + (r.visitors || 0),
    pageviews: acc.pageviews + (r.pageviews || 0)
  }), { bw: 0, visitors: 0, pageviews: 0 });
  const avg = (k) => series.length ? (series.reduce((s, r) => s + (r[k] || 0), 0) / series.length) : 0;

  return (
    <div className="space-y-4">
      <div className="card card-pad flex flex-wrap items-center gap-3">
        <BarChart3 className="text-brand-600" />
        <div>
          <div className="font-bold">Resource Statistics</div>
          <div className="text-sm text-ink-500 dark:text-ink-400">Bandwidth, visitors, disk usage and server load over time.</div>
        </div>
        <div className="ml-auto flex gap-1">
          {[7, 14, 30, 60, 90].map(d => (
            <button key={d} onClick={() => setDays(d)}
                    className={`px-3 py-1.5 text-sm rounded-lg font-semibold ${days === d ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-200' : 'btn-ghost'}`}>
              {d}d
            </button>
          ))}
          <button className="btn-ghost" onClick={() => load(days)}><RefreshCw size={16} /></button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={Activity} label="Bandwidth (period)" value={mb(tot.bw)} sub={`avg ${mb(avg('bandwidth_mb'))}/day`} />
        <Kpi icon={Users}    label="Total visitors"     value={num(tot.visitors)} sub={`avg ${num(avg('visitors').toFixed(0))}/day`} />
        <Kpi icon={Activity} label="Total pageviews"    value={num(tot.pageviews)} sub={`${(tot.visitors ? tot.pageviews / tot.visitors : 0).toFixed(1)} per visitor`} />
        <Kpi icon={HardDrive} label="Disk used (latest)" value={mb(series[series.length - 1]?.disk_used_mb || 0)} sub={loading ? 'updating…' : 'live'} />
      </div>

      <div className="card card-pad">
        <h3 className="font-bold mb-3 flex items-center gap-2"><Activity size={16} /> Bandwidth & visitors</h3>
        <div className="h-72">
          <ResponsiveContainer>
            <AreaChart data={series}>
              <defs>
                <linearGradient id="bw" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.5} /><stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="vs" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity={0.5} /><stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="l" tick={{ fontSize: 11 }} tickFormatter={v => `${v}MB`} />
              <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area yAxisId="l" type="monotone" dataKey="bandwidth_mb" name="Bandwidth (MB)" stroke="#3B82F6" fill="url(#bw)" strokeWidth={2.5} />
              <Area yAxisId="r" type="monotone" dataKey="visitors" name="Visitors" stroke="#10B981" fill="url(#vs)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card card-pad">
          <h3 className="font-bold mb-3 flex items-center gap-2"><HardDrive size={16} /> Disk usage trend</h3>
          <div className="h-56">
            <ResponsiveContainer>
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1024).toFixed(1)}GB`} />
                <Tooltip formatter={(v, n) => [mb(v), n]} />
                <Line type="monotone" dataKey="disk_used_mb" stroke="#3B82F6" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card card-pad">
          <h3 className="font-bold mb-3 flex items-center gap-2"><Cpu size={16} /> CPU & memory</h3>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={pct} domain={[0, 100]} />
                <Tooltip formatter={v => pct(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="cpu_pct" name="CPU %" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="memory_pct" name="Memory %" fill="#F59E0B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub }) {
  return (
    <div className="card card-pad">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="kpi-title">{label}</div>
          <div className="kpi-value mt-1">{value}</div>
          {sub && <div className="text-xs text-ink-500 dark:text-ink-400 mt-0.5">{sub}</div>}
        </div>
        <div className="h-10 w-10 rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300 grid place-items-center">
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}
