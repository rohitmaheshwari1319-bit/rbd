import React from 'react';
import { Inbox } from 'lucide-react';

export default function EmptyState({ icon: Icon = Inbox, title = 'Nothing here yet', description, action }) {
  return (
    <div className="text-center py-12 px-6 text-ink-500 dark:text-ink-400">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-ink-100 dark:bg-ink-800 grid place-items-center text-rbd-600">
        <Icon size={26} />
      </div>
      <div className="mt-4 font-semibold text-ink-800 dark:text-ink-100">{title}</div>
      {description && <p className="mt-1 text-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
