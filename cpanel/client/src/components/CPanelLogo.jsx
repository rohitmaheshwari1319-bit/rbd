import React from 'react';

/**
 * Brand mark for the control panel. Inline SVG so it inherits color and
 * stays sharp at any size. The "c" mark is paired with a text wordmark.
 */
export default function CPanelLogo({ className = '', wordmark = true, accent = '#3B82F6' }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 64 64" className="h-7 w-7 shrink-0" aria-hidden="true">
        <rect x="2" y="2" width="60" height="60" rx="14" fill="currentColor" opacity="0.18" />
        <path d="M44 19a16 16 0 1 0 0 26" fill="none" stroke={accent} strokeWidth="6" strokeLinecap="round"/>
        <circle cx="44" cy="19" r="4" fill={accent} />
        <circle cx="44" cy="45" r="4" fill={accent} />
      </svg>
      {wordmark && (
        <span className="leading-none">
          <span className="block text-base font-extrabold tracking-tight">cPanel</span>
          <span className="block text-[10px] font-semibold tracking-[0.2em] opacity-70">CONTROL PANEL</span>
        </span>
      )}
    </span>
  );
}
