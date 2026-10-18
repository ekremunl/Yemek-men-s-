// src/components/ui/ToastContainer.tsx
'use client';
import { useEffect, useState } from 'react';
import { X, AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { useAppStore } from '@/context/store';
import { cn } from '@/lib/utils';

const ICONS = {
  warning: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />,
  error: <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />,
  success: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />,
  info: <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />,
};

const BORDERS = {
  warning: 'border-l-amber-400 bg-amber-950/80',
  error: 'border-l-red-400 bg-red-950/80',
  success: 'border-l-emerald-400 bg-emerald-950/80',
  info: 'border-l-blue-400 bg-blue-950/80',
};

interface ToastItemProps {
  id: string;
  type: 'warning' | 'error' | 'success' | 'info';
  title: string;
  message: string;
  action?: { label: string; run: () => void };
}

function ToastItem({ id, type, title, message, action }: ToastItemProps) {
  const removeToast = useAppStore((s) => s.removeToast);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-4 rounded-xl border border-white/10 border-l-4 shadow-2xl backdrop-blur-md transition-all duration-300',
        BORDERS[type],
        visible ? 'translate-y-0 opacity-100' : '-translate-y-3 opacity-0'
      )}
      style={{ maxWidth: 420 }}
    >
      {ICONS[type]}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white leading-tight">{title}</p>
        <p className="text-xs text-white/70 mt-0.5 leading-snug break-words">{message}</p>
        {action && (
          <button
            type="button"
            onClick={() => {
              action.run();
              removeToast(id);
            }}
            className="mt-2 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-semibold text-white transition-colors"
          >
            {action.label}
          </button>
        )}
      </div>
      <button
        onClick={() => removeToast(id)}
        aria-label="Kapat"
        className="p-1 -m-1 text-white/40 hover:text-white/80 transition-colors shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const toasts = useAppStore((s) => s.toasts);

  return (
    <div className="fixed z-[9999] flex flex-col gap-2 pointer-events-none top-3 inset-x-3 items-stretch pt-safe lg:top-auto lg:inset-x-auto lg:bottom-6 lg:right-6 lg:items-end">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem {...t} />
        </div>
      ))}
    </div>
  );
}
