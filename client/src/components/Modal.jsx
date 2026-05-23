import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ open, onClose, title, children, size = 'md', footer }) {
  useEffect(() => {
    if (!open) return;
    const fn = e => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', fn);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', fn); document.body.style.overflow = ''; };
  }, [open, onClose]);
  if (!open) return null;

  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 animate-fade-in" onClick={onClose} />
      <div className={`relative w-full ${widths[size]} card animate-fade-in`}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-ink-100 dark:border-ink-800">
          <h2 className="font-bold">{title}</h2>
          <button onClick={onClose} className="btn-ghost !p-1.5"><X size={18} /></button>
        </div>
        <div className="p-5 max-h-[70vh] overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-ink-100 dark:border-ink-800 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
