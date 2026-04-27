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
}

function ToastItem({ id, type, title, message }: ToastItemProps) {
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
        visible ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'
      )}
      style={{ minWidth: 320, maxWidth: 420 }}
    >
      {ICONS[type]}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white leading-tight">{title}</p>
        <p className="text-xs text-white/70 mt-0.5 leading-snug break-words">{message}</p>
      </div>
      <button
        onClick={() => removeToast(id)}
        className="text-white/40 hover:text-white/80 transition-colors shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const toasts = useAppStore((s) => s.toasts);

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem {...t} />
        </div>
      ))}
    </div>
  );
}
