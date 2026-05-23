import React from 'react';

/**
 * RBD brand logo. Inline SVG so it inherits color and renders sharp at any size.
 * Used in the login screen, sidebar header, and PDF invoices (rendered via <img />).
 */
export default function Logo({ className = '', showTagline = true }) {
  return (
    <svg
      viewBox="0 0 540 240"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="RBD - Trust of India"
    >
      <g fill="currentColor">
        <path d="M22 30 H120 a60 60 0 0 1 60 60 v8 a60 60 0 0 1 -42 57 l46 35 H132 l-44 -33 H78 v33 H22 Z M78 70 v36 h36 a18 18 0 0 0 18 -18 a18 18 0 0 0 -18 -18 Z"/>
        <path d="M196 30 H300 a52 52 0 0 1 52 44 a44 44 0 0 1 -16 30 a48 48 0 0 1 22 38 a52 52 0 0 1 -52 48 H196 Z M252 70 v32 h44 a16 16 0 0 0 16 -16 a16 16 0 0 0 -16 -16 Z M252 134 v36 h48 a18 18 0 0 0 18 -18 a18 18 0 0 0 -18 -18 Z"/>
        <path d="M372 30 H468 a72 72 0 0 1 72 72 v6 a72 72 0 0 1 -72 72 H372 Z M428 70 v100 h36 a32 32 0 0 0 32 -32 v-36 a32 32 0 0 0 -32 -32 Z"/>
        <rect x="498" y="6" width="14" height="44" rx="2"/>
        <rect x="483" y="21" width="44" height="14" rx="2"/>
      </g>
      {showTagline && (
        <g>
          <rect x="22" y="200" width="496" height="2" className="fill-ink-900 dark:fill-white" />
          <text x="270" y="226" textAnchor="middle"
                fontFamily="Inter, Arial, sans-serif" fontWeight="700"
                fontSize="22" letterSpacing="6"
                className="fill-ink-900 dark:fill-white">TRUST OF INDIA</text>
        </g>
      )}
    </svg>
  );
}

export function LogoMark({ className = '' }) {
  // Compact version (no tagline) for tight spots like the topbar/sidebar.
  return <Logo className={className} showTagline={false} />;
}
