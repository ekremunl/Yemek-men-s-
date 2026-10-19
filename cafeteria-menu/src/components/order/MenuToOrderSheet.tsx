// src/components/order/MenuToOrderSheet.tsx
'use client';
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Users } from 'lucide-react';
import { useAppStore } from '@/context/store';
import { addDays, cn, formatShortDateTR, getTodayDateKey, getWeekRange } from '@/lib/utils';
import { computeIngredients, formatQuantity } from '@/lib/shopping';
import { ingredientToOrderItem } from '@/lib/order';
import BottomSheet from '@/components/ui/BottomSheet';

type Preset = 'week' | 'next' | 'custom';

/** Menüdeki yemeklerin reçetelerinden toplam malzemeyi hesaplar; seçilenleri siparişe ekler. */
export default function MenuToOrderSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { menus, foodItems, recipes, persons, setPersons, addOrderItems, addToast, setActiveTab } = useAppStore((s) => ({
    menus: s.menus, foodItems: s.foodItems, recipes: s.recipes, persons: s.persons, setPersons: s.setPersons,
    addOrderItems: s.addOrderItems, addToast: s.addToast, setActiveTab: s.setActiveTab,
  }));

  const today = getTodayDateKey();
  const [preset, setPreset] = useState<Preset>('next'); // sipariş genelde gelecek hafta için girilir
  const [customFrom, setCustomFrom] = useState(today);
  const [customTo, setCustomTo] = useState(addDays(today, 6));

  const range = useMemo(() => {
    if (preset === 'week') return getWeekRange(today);
    if (preset === 'next') return getWeekRange(addDays(today, 7));
    const [from, to] = customFrom <= customTo ? [customFrom, customTo] : [customTo, customFrom];
    return { from, to };
  }, [preset, today, customFrom, customTo]);

  const report = useMemo(
    () => computeIngredients(menus, foodItems, recipes, persons, range.from, range.to),
    [menus, foodItems, recipes, persons, range]
  );

  const [unchecked, setUnchecked] = useState<Set<string>>(new Set());
  useEffect(() => setUnchecked(new Set()), [range.from, range.to, persons.lunch, persons.dinner]);

  const key = (l: { name: string; unit: string }) => `${l.name}|${l.unit}`;
  const selected = report.lines.filter((l) => !unchecked.has(key(l)));

  const add = () => {
    addOrderItems(selected.map(ingredientToOrderItem));
    addToast({ type: 'success', title: 'Siparişe eklendi', message: `${selected.length} kalem sipariş listesine eklendi.` });
    onClose();
  };

  const presets: [Preset, string][] = [['week', 'Bu hafta'], ['next', 'Gelecek hafta'], ['custom', 'Özel']];
  const hasRecipes = Object.keys(recipes).length > 0;

  return (
    <BottomSheet open={open} onClose={onClose} full title="Menüden sipariş hesapla" subtitle="Reçetelerden toplam malzeme"
      footer={<button type="button" onClick={add} disabled={selected.length === 0} className="w-full min-h-[3rem] rounded-xl bg-emerald-600 text-white font-semibold disabled:opacity-40 active:bg-emerald-500">{selected.length} kalemi siparişe ekle</button>}>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-white/5 border border-white/10 p-1">
          {presets.map(([k, label]) => (
            <button key={k} type="button" onClick={() => setPreset(k)} aria-pressed={preset === k}
              className={cn('min-h-[2.75rem] rounded-xl text-sm font-medium', preset === k ? 'bg-indigo-600 text-white' : 'text-white/55 active:bg-white/10')}>{label}</button>
          ))}
        </div>
        <p className="text-xs text-white/45 text-center">{formatShortDateTR(range.from)} – {formatShortDateTR(range.to)}</p>

        {preset === 'custom' && (
          <div className="grid grid-cols-2 gap-3">
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} aria-label="Başlangıç" className="bg-slate-800 border border-white/10 rounded-xl px-3 py-3 text-white" />
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} aria-label="Bitiş" className="bg-slate-800 border border-white/10 rounded-xl px-3 py-3 text-white" />
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <p className="flex items-center gap-2 text-xs font-semibold text-white/60 mb-2"><Users className="w-4 h-4" /> Kişi sayısı</p>
          <div className="grid grid-cols-2 gap-3">
            {(['lunch', 'dinner'] as const).map((k) => (
              <label key={k} className="text-[11px] text-white/45 space-y-1 block">
                {k === 'lunch' ? 'Öğle (ve ara öğün)' : 'Akşam'}
                <input type="number" inputMode="numeric" min={0} value={persons[k]} onChange={(e) => setPersons({ [k]: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-white text-base" />
              </label>
            ))}
          </div>
        </div>

        {!hasRecipes && (
          <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">
            Henüz reçete yok.{' '}
            <button type="button" onClick={() => { onClose(); setActiveTab('kitchen'); }} className="underline underline-offset-2">Mutfak → Reçeteler</button>
          </div>
        )}

        {report.lines.length > 0 ? (
          <ul className="rounded-2xl border border-white/10 divide-y divide-white/5 overflow-hidden">
            {report.lines.map((l) => {
              const on = !unchecked.has(key(l));
              return (
                <li key={key(l)}>
                  <label className="flex items-center gap-3 px-4 min-h-[3rem] cursor-pointer active:bg-white/5">
                    <input type="checkbox" checked={on} className="w-5 h-5 shrink-0"
                      onChange={() => setUnchecked((prev) => { const n = new Set(prev); on ? n.add(key(l)) : n.delete(key(l)); return n; })} />
                    <span className={cn('flex-1 min-w-0 truncate text-sm', on ? 'text-white/90' : 'text-white/35 line-through')}>{l.name}</span>
                    <span className="text-sm font-semibold tabular-nums text-white shrink-0">{formatQuantity(l)}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        ) : hasRecipes && <p className="text-center text-sm text-white/40 py-6">Bu aralıkta reçeteli yemek bulunamadı.</p>}

        {report.unlinked.length > 0 && (
          <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3">
            <p className="flex items-center gap-2 text-xs font-semibold text-amber-200"><AlertTriangle className="w-4 h-4" /> Reçetesiz yemekler hesaba katılmadı ({report.unlinked.length})</p>
            <p className="mt-1.5 text-[11px] text-amber-100/60">{report.unlinked.map((u) => u.name).join(', ')}</p>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
