// src/components/planner/RepeatSummary.tsx
'use client';
import { useMemo, useState } from 'react';
import { ChevronDown, Repeat } from 'lucide-react';
import { useAppStore } from '@/context/store';
import { CATEGORY_META } from '@/lib/seedData';
import { analyzeRepeats } from '@/lib/repeats';
import { cn, getMonthMenus, MONTH_NAMES_TR } from '@/lib/utils';

/** "Tekrar özeti": ay içinde en çok tekrar eden yemekler ve havuzun yeterliliği. */
export default function RepeatSummary() {
  const { menus, foodItems, currentYear, currentMonth, setActiveTab } = useAppStore((s) => ({
    menus: s.menus, foodItems: s.foodItems, currentYear: s.currentYear, currentMonth: s.currentMonth, setActiveTab: s.setActiveTab,
  }));
  const [open, setOpen] = useState(false);

  const report = useMemo(() => analyzeRepeats(menus, foodItems, currentYear, currentMonth), [menus, foodItems, currentYear, currentMonth]);
  const planned = getMonthMenus(menus, currentYear, currentMonth).length;
  if (planned === 0) return null;

  // Ana yemekte 2. tekrar zaten "kaç günde bir" sorusunu doğurur; diğer kategorilerde 3 ve üstü gösterilir.
  const repeated = report.dishes.filter((d) => d.count >= (d.category === 'mainCourses' ? 2 : 3));
  const top = report.dishes[0];
  const label = (key: string) => CATEGORY_META.find((c) => c.key === key)?.labelTR ?? key;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="w-full flex items-center gap-3 px-4 min-h-[3.25rem] text-left">
        <Repeat className="w-4 h-4 text-indigo-300 shrink-0" />
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold text-white">Tekrar özeti · {MONTH_NAMES_TR[currentMonth]}</span>
          <span className="block text-[11px] text-white/45 truncate">
            {top ? `En çok: ${top.name} (${top.count}×)` : 'Henüz menü yok'}
          </span>
        </span>
        <ChevronDown className={cn('w-4 h-4 text-white/40 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-5">
          <div>
            <p className="text-xs font-semibold text-white/60 mb-2">Sık tekrar edenler (ana yemek 2+, diğerleri 3+)</p>
            {repeated.length === 0 ? (
              <p className="text-xs text-emerald-300/80">Sık tekrar eden yemek yok.</p>
            ) : (
              <ul className="space-y-1">
                {repeated.slice(0, 12).map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 text-sm bg-white/5 rounded-lg px-3 py-2">
                    <span className="min-w-0 truncate text-white/85">{d.name} <span className="text-[11px] text-white/35">· {label(d.category)}</span></span>
                    <span className="font-bold tabular-nums text-amber-300 shrink-0">{d.count}×</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {report.groups.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-white/60 mb-1">Aynı malzemeyle anılan yemekler</p>
              <p className="text-[11px] text-white/35 mb-2">Ad benzerliğine göre tahmindir (ör. ıspanak yemeği + ıspanaklı börek).</p>
              <ul className="space-y-1.5">
                {report.groups.map((g) => (
                  <li key={g.stem} className="rounded-lg bg-white/5 px-3 py-2">
                    <p className="text-sm text-white/85"><b>{g.label}</b> toplam <b className="text-amber-300">{g.total}×</b></p>
                    <p className="text-[11px] text-white/45">{g.dishes.map((x) => `${x.name} ${x.count}×`).join(' · ')}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-white/60 mb-1">Havuz yeterli mi?</p>
            <p className="text-[11px] text-white/35 mb-2">Tekrarı azaltmanın tek kesin yolu çeşit eklemektir. Aşağıda, bir yemeğin ayda en fazla {report.target} kez çıkması için gereken çeşit sayısı var.</p>
            <ul className="space-y-1.5">
              {report.categories.map((c) => {
                const enough = c.poolSize >= c.neededForTarget;
                return (
                  <li key={c.key} className="flex items-center justify-between gap-2 text-sm rounded-lg bg-white/5 px-3 py-2">
                    <span className="min-w-0">
                      <span className="text-white/85">{label(c.key)}</span>
                      <span className="block text-[11px] text-white/40">{c.poolSize} çeşit · her biri ayda ort. {String(c.average).replace('.', ',')}×</span>
                    </span>
                    <span className={cn('text-xs font-semibold shrink-0', enough ? 'text-emerald-300' : 'text-amber-300')}>
                      {enough ? 'yeterli' : `${c.neededForTarget - c.poolSize} çeşit daha`}
                    </span>
                  </li>
                );
              })}
            </ul>
            <button type="button" onClick={() => setActiveTab('pool')} className="mt-2 min-h-[2.5rem] text-xs font-medium text-indigo-300 underline underline-offset-2">Havuza yemek ekle</button>
          </div>
        </div>
      )}
    </section>
  );
}
