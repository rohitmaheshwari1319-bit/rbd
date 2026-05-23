import React, { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';

const ToastContext = createContext(null);
const ICONS = { success: CheckCircle2, error: XCircle, warning: AlertTriangle, info: Info };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const remove = useCallback(id => setToasts(t => t.filter(x => x.id !== id)), []);
  const push = useCallback((type, message, opts = {}) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [...t, { id, type, message }]);
    setTimeout(() => remove(id), opts.duration || 3500);
  }, [remove]);

  const api = {
    success: (m, o) => push('success', m, o),
    error:   (m, o) => push('error',   m, o),
    warning: (m, o) => push('warning', m, o),
    info:    (m, o) => push('info',    m, o)
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]">
        {toasts.map(t => {
          const Icon = ICONS[t.type] || Info;
          const tone = {
            success: 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-100 dark:ring-emerald-900',
            error:   'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-900/30 dark:text-rose-100 dark:ring-rose-900',
            warning: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-100 dark:ring-amber-900',
            info:    'bg-white text-ink-800 ring-ink-200 dark:bg-ink-900 dark:text-ink-100 dark:ring-ink-700'
          }[t.type];
          return (
            <div key={t.id} className={`animate-fade-in shadow-card rounded-xl px-3 py-2.5 flex gap-2 items-start ring-1 ${tone}`}>
              <Icon size={18} className="mt-0.5 shrink-0" />
              <div className="text-sm flex-1 break-words">{t.message}</div>
              <button onClick={() => remove(t.id)} className="opacity-60 hover:opacity-100"><X size={14} /></button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
