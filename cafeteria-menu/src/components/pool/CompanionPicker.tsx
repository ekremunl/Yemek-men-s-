// src/components/pool/CompanionPicker.tsx
'use client';
import { useState } from 'react';
import { CheckSquare, Square, Search } from 'lucide-react';
import { CategoryKey, FoodItem } from '@/types';
import { cn } from '@/lib/utils';

export const COMPANION_CATEGORIES: { key: CategoryKey; title: string }[] = [
  { key: 'soups', title: 'Çorba' },
  { key: 'sideDishes', title: 'Yan yemek' },
  { key: 'complements', title: 'Tamamlayıcı' },
];

interface CompanionPickerProps {
  foodItems: FoodItem[];
  selected: string[];
  /** Tek bir yemeği aç/kapat. */
  onToggle: (id: string) => void;
  /** Bir kategorideki birçok yemeği tek seferde seç / bırak. */
  onSetMany: (ids: string[], on: boolean) => void;
  activeClass: string;
}

/** Çorba / yan yemek / tamamlayıcı seçici: kategori başına arama ve "tümünü seç" ile toplu seçim destekler. */
export function CompanionPicker({ foodItems, selected, onToggle, onSetMany, activeClass }: CompanionPickerProps) {
  const [queries, setQueries] = useState<Partial<Record<CategoryKey, string>>>({});

  return (
    <div className="space-y-3">
      {COMPANION_CATEGORIES.map(({ key, title }) => {
        const all = foodItems.filter((food) => food.category === key);
        const query = (queries[key] ?? '').toLocaleLowerCase('tr-TR');
        const options = all.filter((food) => food.name.toLocaleLowerCase('tr-TR').includes(query));
        const count = all.filter((option) => selected.includes(option.id)).length;
        const allVisibleOn = options.length > 0 && options.every((option) => selected.includes(option.id));

        return (
          <div key={key}>
            <div className="flex items-center gap-2 mb-1.5">
              <p className="text-[11px] font-medium text-white/40">
                {title}
                {count > 0 ? ` · ${count}/${all.length}` : ` · ${all.length}`}
              </p>
              <div className="relative ml-auto">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30" />
                <input
                  type="text"
                  value={queries[key] ?? ''}
                  onChange={(e) => setQueries((prev) => ({ ...prev, [key]: e.target.value }))}
                  placeholder="Ara..."
                  aria-label={`${title} ara`}
                  className="w-24 bg-white/5 border border-white/10 rounded-md pl-6 pr-2 py-0.5 text-[11px] text-white placeholder-white/30 focus:outline-none focus:border-white/30"
                />
              </div>
              <button
                type="button"
                disabled={options.length === 0}
                onClick={() => onSetMany(options.map((o) => o.id), !allVisibleOn)}
                className="flex items-center gap-1 text-[11px] text-white/50 hover:text-white disabled:opacity-30 transition-colors"
              >
                {allVisibleOn ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3" />}
                {allVisibleOn ? 'Bırak' : 'Tümünü seç'}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
              {options.map((option) => {
                const active = selected.includes(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onToggle(option.id)}
                    className={cn(
                      'text-xs px-2 py-1 rounded-full border transition-colors',
                      active ? activeClass : 'border-white/10 text-white/50 hover:bg-white/5 hover:text-white/80'
                    )}
                  >
                    {option.name}
                  </button>
                );
              })}
              {options.length === 0 && <span className="text-[11px] text-white/30">Yemek bulunamadı</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
