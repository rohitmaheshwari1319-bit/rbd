import React, { useEffect, useState } from 'react';
import {
  Package, Warehouse as WHIcon, IndianRupee, ShoppingCart, AlertTriangle,
  TrendingUp, Users, Sparkles, ArrowUpRight
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { inr, num, date } from '../lib/format.js';
import { PageLoader } from '../components/Spinner.jsx';
import { useToast } from '../context/ToastContext.jsx';

const PIE_COLORS = ['#E11D2E', '#F87171', '#FB923C', '#FBBF24', '#34D399', '#60A5FA', '#A78BFA', '#F472B6'];

function KPI({ icon: Icon, label, value, sub, accent = 'text-rbd-600 bg-rbd-50 dark:text-rbd-300 dark:bg-rbd-900/30' }) {
  return (
    <div className="card card-pad">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="kpi-title">{label}</div>
          <div className="kpi-value mt-1">{value}</div>
          {sub && <div className="text-xs text-ink-500 dark:text-ink-400 mt-1">{sub}</div>}
        </div>
        <div className={`h-11 w-11 rounded-xl grid place-items-center ${accent}`}>
          <Icon size={22} />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    Promise.all([api.get('/dashboard/summary'), api.get('/ai/insights')])
      .then(([d, ins]) => { setData(d); setInsights(ins); })
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [toast]);

  if (loading || !data) return <PageLoader label="Crunching the numbers…" />;

  const trend = data.trend.map(t => ({ ...t, label: date(t.day).split(' ').slice(0, 2).join(' ') }));
  const monthGoal = 1500000; // sample target; can be moved to settings
  const goalPct = Math.min(100, Math.round((data.sales_month.total / monthGoal) * 100));

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI icon={IndianRupee} label="Stock Value" value={inr(data.stock_value)}
             sub={`${num(data.units)} units across ${data.warehouses} warehouses`} />
        <KPI icon={ShoppingCart} label="Sales (this month)" value={inr(data.sales_month.total)}
             sub={`${data.sales_month.count} invoices · today ${inr(data.sales_today.total)}`}
             accent="text-emerald-600 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-900/30" />
        <KPI icon={AlertTriangle} label="Low Stock Alerts" value={data.low_stock}
             sub={data.low_stock ? 'Open AI Reorder Advisor' : 'All products well-stocked'}
             accent="text-amber-600 bg-amber-50 dark:text-amber-300 dark:bg-amber-900/30" />
        <KPI icon={IndianRupee} label="Pending Receivables" value={inr(data.pending_payments)}
             sub="Across all open invoices"
             accent="text-rose-600 bg-rose-50 dark:text-rose-300 dark:bg-rose-900/30" />
      </div>

      {/* AI insights */}
      {insights.length > 0 && (
        <div className="card card-pad">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 font-bold">
              <Sparkles size={18} className="text-rbd-600" /> AI Business Insights
            </div>
            <Link to="/ai" className="text-sm text-rbd-600 font-semibold flex items-center gap-1">
              Open AI tools <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {insights.map((i, idx) => (
              <div key={idx} className={`rounded-xl p-3.5 border text-sm
                ${i.severity === 'warning' ? 'border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-900' :
                  i.severity === 'success' ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-900' :
                                              'border-ink-200 bg-ink-50 dark:bg-ink-800/50 dark:border-ink-700'}`}>
                <div className="font-semibold text-ink-900 dark:text-ink-50">{i.title}</div>
                <div className="text-ink-600 dark:text-ink-300 mt-0.5">{i.body}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sales trend + goal */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card card-pad lg:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="font-bold">Daily sales — last 14 days</div>
              <div className="text-xs text-ink-500 dark:text-ink-400">Revenue trend incl. GST</div>
            </div>
            <div className="badge-red"><TrendingUp size={12} /> live</div>
          </div>
          <div className="h-64 -ml-4">
            <ResponsiveContainer>
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#E11D2E" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#E11D2E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={v => inr(v)}
                  contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb' }} />
                <Area type="monotone" dataKey="total" stroke="#E11D2E" fill="url(#g1)" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card card-pad space-y-3">
          <div>
            <div className="font-bold">Monthly target</div>
            <div className="text-xs text-ink-500 dark:text-ink-400">Demo target: {inr(monthGoal)}</div>
          </div>
          <div className="text-3xl font-extrabold">{goalPct}%</div>
          <div className="h-3 rounded-full bg-ink-100 dark:bg-ink-800 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-rbd-500 to-rbd-700 transition-all"
                 style={{ width: `${goalPct}%` }} />
          </div>
          <div className="text-xs text-ink-500 dark:text-ink-400">
            {inr(data.sales_month.total)} of {inr(monthGoal)}
          </div>
          <hr className="border-ink-100 dark:border-ink-800" />
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-ink-500 dark:text-ink-400">Customers</div>
              <div className="font-bold flex items-center gap-1.5"><Users size={14} />{data.customers}</div>
            </div>
            <div>
              <div className="text-ink-500 dark:text-ink-400">Products</div>
              <div className="font-bold flex items-center gap-1.5"><Package size={14} />{data.products}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Warehouses + Top products + Categories */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card card-pad lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div className="font-bold">Warehouse overview</div>
            <Link to="/warehouses" className="text-sm text-rbd-600 font-semibold">Manage →</Link>
          </div>
          <div className="overflow-x-auto -mx-2">
            <table className="table">
              <thead>
                <tr><th>Warehouse</th><th>Code</th><th className="text-right">Units</th><th className="text-right">Value</th></tr>
              </thead>
              <tbody>
                {data.by_warehouse.map(w => (
                  <tr key={w.id}>
                    <td className="font-semibold">{w.name}</td>
                    <td><span className="badge-slate">{w.code}</span></td>
                    <td className="text-right">{num(w.units)}</td>
                    <td className="text-right font-semibold">{inr(w.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card card-pad">
          <div className="font-bold mb-2">Inventory by category</div>
          <div className="h-56">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={data.by_category.filter(c => c.products > 0)}
                     dataKey="products" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={3}>
                  {data.by_category.filter(c => c.products > 0).map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card card-pad">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="font-bold">Top selling products — last 30 days</div>
            <div className="text-xs text-ink-500 dark:text-ink-400">By units sold and revenue</div>
          </div>
          <Link to="/ai" className="text-sm text-rbd-600 font-semibold">Open AI movers →</Link>
        </div>
        <div className="h-72 -ml-4">
          <ResponsiveContainer>
            <BarChart data={data.top_products} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v, k) => k === 'revenue' ? inr(v) : num(v)} />
              <Bar dataKey="qty" fill="#E11D2E" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
