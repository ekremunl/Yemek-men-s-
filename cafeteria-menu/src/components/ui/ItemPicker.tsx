// src/components/ui/ItemPicker.tsx
'use client';
import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, Search, X, Check } from 'lucide-react';
import type { FoodItem } from '@/types';
import { cn } from '@/lib/utils';
import BottomSheet from './BottomSheet';

interface ItemPickerProps {
  items: FoodItem[];
  value: string | null;
  onChange: (id: string | null) => void;
  /** Sheet başlığı (ör. "Ana Yemek seç"). */
  title: string;
  placeholder?: string;
  /** Kural çiğneyen adaylar: kimlik → açıklama. Uyarı rozeti ve "yalnızca uygunlar" süzgeci için. */
  violations?: Record<string, string>;
  /** Kurala uygun adayların sırası (en iyi önde): "Önerilen" rozeti için. */
  suggestedIds?: string[];
  /** Önerilen adaylarda görünen rozet metni. */
  suggestedLabel?: string;
  conflict?: boolean;
  focusClass?: string;
}

/**
 * Aranabilir seçici. Mobilde alttan açılır, büyük dokunma hedefleri kullanır.
 * Uzun yemek listelerinde açılır liste (select) yerine bunu kullanın.
 */
export default function ItemPicker({
  items,
  value,
  onChange,
  title,
  placeholder = '— Seçiniz —',
  violations,
  suggestedIds,
  suggestedLabel = 'uygun',
  conflict,
}: ItemPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [onlyValid, setOnlyValid] = useState(false);

  const selected = items.find((item) => item.id === value) ?? null;
  const hasViolations = violations && Object.keys(violations).length > 0;
  const suggested = useMemo(() => new Set(suggestedIds ?? []), [suggestedIds]);

  const visible = useMemo(() => {
    const q = query.toLocaleLowerCase('tr-TR').trim();
    return items
      .filter((item) => (q ? item.name.toLocaleLowerCase('tr-TR').includes(q) : true))
      .filter((item) => !(onlyValid && violations?.[item.id] && item.id !== value))
      .sort((a, b) => {
        // Önerilenler önce, sonra alfabetik (Türkçe).
        const sa = suggested.has(a.id) ? 0 : 1;
        const sb = suggested.has(b.id) ? 0 : 1;
        return sa - sb || a.name.localeCompare(b.name, 'tr');
      });
  }, [items, query, onlyValid, violations, value, suggested]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const pick = (id: string | null) => {
    onChange(id);
    close();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'w-full min-h-[3rem] flex items-center gap-2 text-left bg-slate-800 border rounded-xl px-3 py-2.5 text-sm transition-colors',
          conflict ? 'border-amber-500/60 bg-amber-500/5' : 'border-white/10 active:border-white/30'
        )}
      >
        <span className={cn('flex-1 truncate', selected ? 'text-white' : 'text-white/40')}>
          {selected ? selected.name : placeholder}
        </span>
        {selected && violations?.[selected.id] && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
        <ChevronDown className="w-4 h-4 text-white/40 shrink-0" />
      </button>

      <BottomSheet open={open} onClose={close} title={title} nested full maxWidthClass="md:max-w-lg">
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="search"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Yemek ara..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-9 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Aramayı temizle"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-white/40"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {hasViolations && (
            <label className="flex items-center gap-2 text-xs text-white/60 select-none">
              <input type="checkbox" checked={onlyValid} onChange={(e) => setOnlyValid(e.target.checked)} className="w-4 h-4" />
              Yalnızca kurallara uyanları göster
            </label>
          )}

          <ul className="divide-y divide-white/5 rounded-xl border border-white/10 overflow-hidden">
            <li>
              <button
                type="button"
                onClick={() => pick(null)}
                className="w-full min-h-[3rem] px-4 text-left text-sm text-white/50 active:bg-white/10"
              >
                — Seçimi temizle —
              </button>
            </li>
            {visible.length === 0 && <li className="px-4 py-6 text-center text-sm text-white/30">Sonuç yok</li>}
            {visible.map((item) => {
              const reason = violations?.[item.id];
              const isSelected = item.id === value;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => pick(item.id)}
                    className={cn(
                      'w-full min-h-[3rem] px-4 py-2.5 text-left active:bg-white/10 flex items-start gap-3',
                      isSelected && 'bg-indigo-500/15'
                    )}
                  >
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2">
                        <span className={cn('text-sm', reason ? 'text-white/60' : 'text-white')}>{item.name}</span>
                        {suggested.has(item.id) && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            {suggestedLabel}
                          </span>
                        )}
                        {item.calories ? <span className="text-[10px] text-white/35">{item.calories} kcal</span> : null}
                      </span>
                      {reason && (
                        <span className="mt-1 flex items-start gap-1 text-[11px] leading-snug text-amber-300/80">
                          <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                          {reason}
                        </span>
                      )}
                    </span>
                    {isSelected && <Check className="w-4 h-4 text-indigo-300 shrink-0 mt-0.5" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </BottomSheet>
    </>
  );
}
