// src/components/ui/BottomSheet.tsx
'use client';
import { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Başlık satırının sağındaki ek düğmeler (kapat düğmesinden önce). */
  actions?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Mobilde ekranı tamamen kaplasın (uzun listeler için). */
  full?: boolean;
  /** Başka bir sheet'in üstünde açılacaksa true. */
  nested?: boolean;
  maxWidthClass?: string;
}

/**
 * Mobilde alttan açılan, masaüstünde ortada duran panel.
 * Escape ile kapanır, arka plan kaydırmasını kilitler, çentik alanını (safe-area) dikkate alır.
 */
export default function BottomSheet({
  open,
  onClose,
  title,
  subtitle,
  actions,
  children,
  footer,
  full,
  nested,
  maxWidthClass = 'md:max-w-2xl',
}: BottomSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={cn('fixed inset-0 flex items-end md:items-center justify-center', nested ? 'z-[60]' : 'z-50')}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        aria-label="Kapat"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-default"
        tabIndex={-1}
      />
      <div
        className={cn(
          'relative w-full flex flex-col bg-slate-900 border border-white/10 shadow-2xl overflow-hidden',
          'rounded-t-3xl md:rounded-2xl',
          maxWidthClass,
          full ? 'h-[94dvh] md:h-auto md:max-h-[88vh]' : 'max-h-[92dvh] md:max-h-[88vh]'
        )}
      >
        <div className="md:hidden flex justify-center pt-2" aria-hidden>
          <span className="h-1 w-10 rounded-full bg-white/20" />
        </div>
        {(title || actions) && (
          <div className="flex items-center gap-2 px-4 sm:px-6 py-3 border-b border-white/10 shrink-0">
            <div className="min-w-0 flex-1">
              {subtitle && <p className="text-[11px] text-white/50 uppercase tracking-widest font-medium">{subtitle}</p>}
              {title && <h3 className="text-base sm:text-lg font-bold text-white leading-tight">{title}</h3>}
            </div>
            {actions}
            <button
              type="button"
              onClick={onClose}
              aria-label="Kapat"
              className="w-11 h-11 -mr-2 flex items-center justify-center rounded-xl text-white/50 hover:text-white hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4 min-h-0">{children}</div>
        {footer && <div className="shrink-0 px-4 sm:px-6 pt-3 pb-4 border-t border-white/10 pb-safe">{footer}</div>}
      </div>
    </div>
  );
}
