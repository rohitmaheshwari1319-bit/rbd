import React from 'react';
import { Link } from 'react-router-dom';

/**
 * The iconic cPanel module tile. Renders an icon, label, and optional
 * status badge. Acts as a link to the module's page (or runs onClick).
 */
export default function ModuleTile({ icon: Icon, label, to, onClick, badge, badgeTone = 'blue', desc }) {
  const inner = (
    <div className="tile group" onClick={onClick}>
      <div className="tile-icon group-hover:bg-brand-100 dark:group-hover:bg-brand-900/60"><Icon size={20} /></div>
      <div className="tile-label">{label}</div>
      {desc && <div className="text-[11px] text-ink-500 dark:text-ink-400 leading-snug">{desc}</div>}
      {badge !== undefined && badge !== null && (
        <span className={`badge-${badgeTone} mt-0.5 !text-[10px] !px-1.5 !py-0.5`}>{badge}</span>
      )}
    </div>
  );
  if (to) return <Link to={to} className="block">{inner}</Link>;
  return inner;
}
