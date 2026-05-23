export function bytes(b) {
  if (b === null || b === undefined) return '—';
  const n = Number(b);
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1073741824) return `${(n / 1048576).toFixed(1)} MB`;
  return `${(n / 1073741824).toFixed(2)} GB`;
}

export function mb(v) {
  const n = Number(v) || 0;
  if (n < 1024) return `${n.toLocaleString('en-US', { maximumFractionDigits: 1 })} MB`;
  return `${(n / 1024).toLocaleString('en-US', { maximumFractionDigits: 2 })} GB`;
}

export function num(n) { return (Number(n) || 0).toLocaleString('en-US'); }

export function pct(v) { return `${(Number(v) || 0).toFixed(1)}%`; }

export function dt(iso) {
  if (!iso) return '';
  const d = new Date(iso.replace(' ', 'T') + (iso.includes('Z') ? '' : 'Z'));
  return d.toLocaleString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
export function date(iso) {
  if (!iso) return '';
  const d = new Date(iso.replace(' ', 'T') + (iso.includes('Z') ? '' : 'Z'));
  return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function relativeTime(iso) {
  if (!iso) return '';
  const d = new Date(iso.replace(' ', 'T') + (iso.includes('Z') ? '' : 'Z'));
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  return date(iso);
}
