// src/components/kitchen/KitchenPanel.tsx
'use client';
import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays, cn, formatDateLabelTR, getTodayDateKey, parseDate } from '@/lib/utils';
import KitchenDayView from './KitchenDayView';
import KitchenReport from './KitchenReport';
import RecipeManager from './RecipeManager';

type Sub = 'day' | 'report' | 'recipes';
const SUBS: [Sub, string][] = [['day', 'Günlük'], ['report', 'Rapor'], ['recipes', 'Reçeteler']];

/** Mutfak: günlük çıkış, rapor ve reçete havuzu. */
export default function KitchenPanel() {
  const [sub, setSub] = useState<Sub>('day');
  const [date, setDate] = useState(getTodayDateKey());

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-white">Mutfak</h2>
        <p className="text-sm text-white/50 mt-1 hidden sm:block">Günlük malzeme çıkışı, rapor ve reçeteler</p>
      </div>

      <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-white/5 border border-white/10 p-1">
        {SUBS.map(([key, label]) => (
          <button key={key} type="button" onClick={() => setSub(key)} aria-pressed={sub === key}
            className={cn('min-h-[2.75rem] rounded-xl text-sm font-medium', sub === key ? 'bg-indigo-600 text-white' : 'text-white/55 active:bg-white/10')}>
            {label}
          </button>
        ))}
      </div>

      {sub !== 'recipes' && (
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setDate(addDays(date, -1))} aria-label="Önceki gün" className="w-11 h-11 flex items-center justify-center rounded-xl bg-white/5 text-white/70 active:bg-white/15"><ChevronLeft className="w-5 h-5" /></button>
          <label className="flex-1 relative rounded-xl bg-white/5 min-h-[2.75rem] flex flex-col items-center justify-center text-center">
            <span className="text-sm font-semibold text-white">{formatDateLabelTR(parseDate(date))}</span>
            <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Tarih seç" className="absolute inset-0 opacity-0 w-full h-full" />
          </label>
          <button type="button" onClick={() => setDate(addDays(date, 1))} aria-label="Sonraki gün" className="w-11 h-11 flex items-center justify-center rounded-xl bg-white/5 text-white/70 active:bg-white/15"><ChevronRight className="w-5 h-5" /></button>
        </div>
      )}

      {sub === 'day' && <KitchenDayView date={date} />}
      {sub === 'report' && <KitchenReport date={date} />}
      {sub === 'recipes' && <RecipeManager />}
    </div>
  );
}
