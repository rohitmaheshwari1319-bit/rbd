import React from 'react';

export default function Spinner({ size = 18, className = '' }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      style={{ width: size, height: size }}
      aria-label="Loading"
    />
  );
}

export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="grid place-items-center py-24 text-ink-500 dark:text-ink-400">
      <Spinner size={28} />
      <div className="mt-3 text-sm font-medium">{label}</div>
    </div>
  );
}
