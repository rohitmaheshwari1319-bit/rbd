import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Download, FileText, RefreshCw, BarChart3 } from 'lucide-react';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { inr, num, date as dateFmt } from '../lib/format.js';

const TABS = [
  { key: 'inventory', label: 'Inventory' },
  { key: 'warehouse', label: 'Warehouse' },
  { key: 'sales',     label: 'Sales' },
  { key: 'purchases', label: 'Purchases' },
  { key: 'pl',        label: 'Profit & Loss' }
];

const COLS = {
  inventory: [
    { key: 'sku', h: 'SKU' }, { key: 'name', h: 'Name' }, { key: 'category', h: 'Category' },
    { key: 'unit', h: 'Unit' }, { key: 'purchase_price', h: 'Cost', align: 'right', fmt: inr },
    { key: 'selling_price', h: 'Price', align: 'right', fmt: inr },
    { key: 'gst_rate', h: 'GST', align: 'center', fmt: v => `${v}%` },
    { key: 'reorder_level', h: 'Reorder', align: 'right' },
    { key: 'stock_qty', h: 'Stock', align: 'right', fmt: num },
    { key: 'stock_value', h: 'Stock Value', align: 'right', fmt: inr }
  ],
  warehouse: [
    { key: 'code', h: 'Code' }, { key: 'name', h: 'Name' },
    { key: 'units', h: 'Units', align: 'right', fmt: num },
    { key: 'purchase_value', h: 'Stock Value (cost)', align: 'right', fmt: inr },
    { key: 'selling_value', h: 'Stock Value (MRP)', align: 'right', fmt: inr }
  ],
  sales: [
    { key: 'invoice_no', h: 'Invoice' },
    { key: 'created_at', h: 'Date', fmt: dateFmt },
    { key: 'customer', h: 'Customer' }, { key: 'warehouse', h: 'Warehouse' },
    { key: 'subtotal', h: 'Subtotal', align: 'right', fmt: inr },
    { key: 'tax', h: 'Tax', align: 'right', fmt: inr },
    { key: 'total', h: 'Total', align: 'right', fmt: inr },
    { key: 'paid', h: 'Paid', align: 'right', fmt: inr },
    { key: 'due', h: 'Due', align: 'right', fmt: inr }
  ],
  purchases: [
    { key: 'reference', h: 'Reference' },
    { key: 'created_at', h: 'Date', fmt: dateFmt },
    { key: 'supplier', h: 'Supplier' }, { key: 'warehouse', h: 'Warehouse' },
    { key: 'subtotal', h: 'Subtotal', align: 'right', fmt: inr },
    { key: 'tax', h: 'Tax', align: 'right', fmt: inr },
    { key: 'total', h: 'Total', align: 'right', fmt: inr },
    { key: 'paid', h: 'Paid', align: 'right', fmt: inr },
    { key: 'due', h: 'Due', align: 'right', fmt: inr }
  ]
};

export default function Reports() {
  const toast = useToast();
  const [tab, setTab] = useState('inventory');
  const [rows, setRows] = useState([]);
  const [pl, setPL] = useState(null);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      if (tab === 'pl') {
        const params = from && to ? `?from=${from}&to=${to}` : '';
        setPL(await api.get(`/reports/profit-loss${params}`));
      } else {
        const params = (tab === 'sales' || tab === 'purchases') && from && to ? `?from=${from}&to=${to}` : '';
        setRows(await api.get(`/reports/${tab}${params}`));
      }
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [tab]);

  const exportExcel = () => {
    const data = rows.map(r => {
      const out = {};
      for (const c of COLS[tab]) out[c.h] = r[c.key];
      return out;
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, tab);
    XLSX.writeFile(wb, `RBD-${tab}-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success('Excel downloaded');
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFillColor(225, 29, 46);
    doc.rect(0, 0, doc.internal.pageSize.getWidth(), 26, 'F');
    doc.setTextColor(255, 255, 255).setFont('helvetica', 'bold').setFontSize(14);
    doc.text(`RBD ${TABS.find(t => t.key === tab).label} Report`, 14, 17);
    doc.setFontSize(10).setFont('helvetica', 'normal');
    doc.text(new Date().toLocaleString('en-IN'), doc.internal.pageSize.getWidth() - 14, 17, { align: 'right' });
    autoTable(doc, {
      startY: 36,
      head: [COLS[tab].map(c => c.h)],
      body: rows.map(r => COLS[tab].map(c => c.fmt ? c.fmt(r[c.key]) : (r[c.key] ?? ''))),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [33, 36, 42], textColor: [255, 255, 255] },
      margin: { left: 14, right: 14 }
    });
    doc.save(`RBD-${tab}-report.pdf`);
    toast.success('PDF downloaded');
  };

  return (
    <div className="space-y-4">
      <div className="card card-pad flex flex-wrap items-center gap-2">
        <BarChart3 className="text-rbd-600" />
        <div>
          <div className="font-bold">Reports & exports</div>
          <div className="text-sm text-ink-500 dark:text-ink-400">PDF and Excel-ready operational reports.</div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {(tab === 'sales' || tab === 'purchases' || tab === 'pl') && (
            <>
              <input type="date" className="input !w-auto" value={from} onChange={e => setFrom(e.target.value)} />
              <span className="text-ink-500">→</span>
              <input type="date" className="input !w-auto" value={to} onChange={e => setTo(e.target.value)} />
              <button className="btn-soft" onClick={load}><RefreshCw size={14} /> Apply</button>
            </>
          )}
          {tab !== 'pl' && (
            <>
              <button className="btn-soft" onClick={exportExcel}><Download size={14} /> Excel</button>
              <button className="btn-soft" onClick={exportPDF}><FileText size={14} /> PDF</button>
            </>
          )}
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap gap-1 p-2 border-b border-ink-100 dark:border-ink-800">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
                    className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${tab === t.key
                      ? 'bg-rbd-50 text-rbd-700 dark:bg-rbd-900/30 dark:text-rbd-200'
                      : 'text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800'}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-4">
          {loading && <div className="py-12 text-center text-ink-500">Loading…</div>}
          {!loading && tab === 'pl' && pl && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <KPI label="Revenue" v={inr(pl.revenue)} />
              <KPI label="Tax collected" v={inr(pl.tax_collected)} />
              <KPI label="Discount given" v={inr(pl.discount)} />
              <KPI label="Cost of goods sold" v={inr(pl.cogs)} />
              <KPI label="Gross profit" v={inr(pl.gross_profit)} accent />
              <KPI label="Margin" v={`${pl.margin_pct}%`} accent />
              <KPI label="Purchases (period)" v={inr(pl.purchases_total)} />
            </div>
          )}
          {!loading && tab !== 'pl' && (
            <div className="overflow-x-auto -mx-2">
              <table className="table min-w-[800px]">
                <thead><tr>{COLS[tab].map(c => <th key={c.key} className={c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : ''}>{c.h}</th>)}</tr></thead>
                <tbody>
                  {rows.length === 0 && <tr><td colSpan={COLS[tab].length} className="!py-10 text-center text-ink-500">No data</td></tr>}
                  {rows.map((r, i) => (
                    <tr key={i}>
                      {COLS[tab].map(c => (
                        <td key={c.key} className={c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : ''}>
                          {c.fmt ? c.fmt(r[c.key]) : (r[c.key] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KPI({ label, v, accent }) {
  return (
    <div className={`rounded-xl p-4 ${accent ? 'bg-rbd-50 dark:bg-rbd-900/30' : 'bg-ink-50 dark:bg-ink-800/60'}`}>
      <div className="text-xs uppercase tracking-wide text-ink-500 dark:text-ink-400">{label}</div>
      <div className="text-2xl font-extrabold mt-1">{v}</div>
    </div>
  );
}
