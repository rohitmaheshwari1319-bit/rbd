import React from 'react';

/**
 * Quota usage row: label, "X / Y" formatted value, and a colored progress bar.
 * Bar tints amber at >= 75% and rose at >= 90%.
 */
export default function StatBar({ label, used, total, format = v => v, icon: Icon }) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  const tone = pct >= 90 ? 'danger' : pct >= 75 ? 'warn' : '';
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1.5">
        <div className="flex items-center gap-2 font-medium text-ink-700 dark:text-ink-200">
          {Icon && <Icon size={14} className="text-brand-600" />}
          <span>{label}</span>
        </div>
        <div className="text-ink-500 dark:text-ink-400 text-xs font-mono">
          {format(used)} <span className="opacity-60">/ {format(total)}</span>
        </div>
      </div>
      <div className="quota-bar">
        <div className={`quota-fill ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-[10px] text-ink-500 dark:text-ink-400 mt-1 text-right font-mono">{pct.toFixed(1)}%</div>
    </div>
  );
}
