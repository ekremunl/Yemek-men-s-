// src/components/pool/CompanionBanSheet.tsx
'use client';
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useAppStore } from '@/context/store';
import type { FoodItem } from '@/types';
import { CATEGORY_META } from '@/lib/seedData';
import BottomSheet from '@/components/ui/BottomSheet';
import { cn } from '@/lib/utils';

interface Props {
  main: FoodItem;
  open: boolean;
  onClose: () => void;
}

/** Ana yemeğin yanına gelmemesi gereken yemekleri seçer (çorba, yan yemek, tamamlayıcı). */
export default function CompanionBanSheet({ main, open, onClose }: Props) {
  const foodItems = useAppStore((s) => s.foodItems);
  const setBannedCompanions = useAppStore((s) => s.setBannedCompanions);
  const [query, setQuery] = useState('');
  const banned = new Set(main.bannedCompanions ?? []);

  const candidates = useMemo(
    () => foodItems.filter((i) => i.category !== 'mainCourses' && i.category !== 'snacks'),
    [foodItems]
  );
  const q = query.toLocaleLowerCase('tr-TR').trim();
  const shown = q ? candidates.filter((i) => i.name.toLocaleLowerCase('tr-TR').includes(q)) : candidates;

  const toggle = (id: string) => {
    const next = new Set(banned);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setBannedCompanions(main.id, Array.from(next));
  };
  const setMany = (ids: string[], on: boolean) => {
    const next = new Set(banned);
    ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
    setBannedCompanions(main.id, Array.from(next));
  };
  const shownIds = shown.map((i) => i.id);
  const allShownBanned = shownIds.length > 0 && shownIds.every((id) => banned.has(id));

  return (
    <BottomSheet open={open} onClose={() => { setQuery(''); onClose(); }} full nested title={`${main.name}: yanında olmasın`} subtitle="Aynı öğünde birlikte seçilmez" maxWidthClass="md:max-w-lg">
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Ara (ör. "makarna")'
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30"
          />
        </div>
        {shown.length > 0 && (
          <button
            type="button"
            onClick={() => setMany(shownIds, !allShownBanned)}
            className="w-full min-h-[2.75rem] rounded-xl border border-white/10 bg-white/5 text-xs font-medium text-white/80 active:bg-white/10"
          >
            {allShownBanned ? 'Görünenlerin yasağını kaldır' : `Görünen ${shown.length} yemeği yasakla`}
          </button>
        )}
        {CATEGORY_META.filter((c) => c.key !== 'mainCourses' && c.key !== 'snacks').map((c) => {
          const rows = shown.filter((i) => i.category === c.key).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
          if (rows.length === 0) return null;
          return (
            <div key={c.key}>
              <p className="text-xs font-semibold text-white/50 mb-1.5">{c.labelTR}</p>
              <ul className="rounded-xl border border-white/10 divide-y divide-white/5 overflow-hidden">
                {rows.map((i) => (
                  <li key={i.id}>
                    <label className={cn('flex items-center gap-3 px-4 min-h-[3rem] cursor-pointer active:bg-white/5', banned.has(i.id) && 'bg-red-500/10')}>
                      <input type="checkbox" checked={banned.has(i.id)} onChange={() => toggle(i.id)} className="w-5 h-5 shrink-0" />
                      <span className={cn('text-sm', banned.has(i.id) ? 'text-red-200' : 'text-white/85')}>{i.name}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        {shown.length === 0 && <p className="text-center text-sm text-white/30 py-6">Sonuç yok</p>}
      </div>
    </BottomSheet>
  );
}
