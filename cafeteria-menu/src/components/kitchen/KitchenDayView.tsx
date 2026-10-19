// src/components/kitchen/KitchenDayView.tsx
'use client';
import { useMemo, useState } from 'react';
import { AlertTriangle, BookOpen, X } from 'lucide-react';
import { useAppStore } from '@/context/store';
import type { FoodItem, KitchenMealKey } from '@/types';
import {
  KITCHEN_MEALS, KITCHEN_MEAL_LABEL, LINE_UNITS, normalizeKitchenDay, plannedItemsForMeal,
} from '@/lib/kitchen';
import { cn } from '@/lib/utils';
import ItemPicker from '@/components/ui/ItemPicker';

const field = 'min-w-0 bg-slate-800 border border-white/10 rounded-xl px-3 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30';

/** Günlük menü: kişi sayıları, menüden gelen yemekler, elle eklenen reçeteler, fırın ve doğrudan tüketim. */
export default function KitchenDayView({ date }: { date: string }) {
  const { kitchenDays, persons, menus, foodItems, recipes, updateKitchenDay, setActiveTab, addToast } = useAppStore((s) => ({
    kitchenDays: s.kitchenDays,
    persons: s.persons,
    menus: s.menus,
    foodItems: s.foodItems,
    recipes: s.recipes,
    updateKitchenDay: s.updateKitchenDay,
    setActiveTab: s.setActiveTab,
    addToast: s.addToast,
  }));

  const day = useMemo(() => normalizeKitchenDay(kitchenDays[date], persons), [kitchenDays, date, persons]);
  const menu = menus.find((m) => m.date === date);
  const itemById = useMemo(() => new Map(foodItems.map((i) => [i.id, i])), [foodItems]);

  const recipeItems = useMemo<FoodItem[]>(
    () => Object.values(recipes).map((r) => ({ id: r.id, name: r.name, category: 'mainCourses' as const })).sort((a, b) => a.name.localeCompare(b.name, 'tr')),
    [recipes]
  );

  const [firin, setFirin] = useState({ name: '', amt: '', unit: 'adet' });
  const [direkt, setDirekt] = useState<{ name: string; amt: string; unit: string; meal: KitchenMealKey }>({ name: '', amt: '', unit: 'ml', meal: 'kahvalti' });

  const addRow = (kind: 'firin' | 'direkt') => {
    const form = kind === 'firin' ? firin : direkt;
    const amt = parseFloat(form.amt.replace(',', '.'));
    if (!form.name.trim() || !(amt > 0)) {
      addToast({ type: 'warning', title: 'Eksik bilgi', message: "Ürün adı ve 0'dan büyük bir miktar girin." });
      return;
    }
    updateKitchenDay(date, (d) => {
      if (kind === 'firin') d.firin.push({ name: form.name.trim(), amt, unit: form.unit });
      else d.direkt.push({ name: form.name.trim(), amt, unit: form.unit, meal: direkt.meal });
    });
    if (kind === 'firin') setFirin({ ...firin, name: '', amt: '' });
    else setDirekt({ ...direkt, name: '', amt: '' });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {(['lunch', 'dinner'] as const).map((k) => (
          <label key={k} className="rounded-2xl border border-white/10 bg-white/5 p-4 block">
            <span className="text-xs font-semibold text-white/50">{k === 'lunch' ? 'Öğle kişi sayısı' : 'Akşam kişi sayısı'}</span>
            <input type="number" inputMode="numeric" min={0} value={day[k] || ''} placeholder="0"
              onChange={(e) => updateKitchenDay(date, (d) => { d[k] = Math.max(0, parseInt(e.target.value) || 0); })}
              className="mt-1 w-full bg-transparent text-3xl font-extrabold text-white focus:outline-none" />
          </label>
        ))}
      </div>

      {KITCHEN_MEALS.map(([key, label]) => {
        const planned = plannedItemsForMeal(menu, key, itemById);
        const extras = day.meals[key].map((id) => recipes[id]).filter(Boolean);
        return (
          <section key={key} className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold text-white">{label}</h3>
              <select value={day.basis[key]} aria-label={`${label} kişi sayısı kaynağı`}
                onChange={(e) => updateKitchenDay(date, (d) => { d.basis[key] = e.target.value as 'lunch' | 'dinner'; })}
                className={cn(field, '!py-2 text-xs')}>
                <option value="lunch">Öğle sayısı ({day.lunch || 0})</option>
                <option value="dinner">Akşam sayısı ({day.dinner || 0})</option>
              </select>
            </div>

            {planned.length > 0 && (
              <div>
                <p className="text-[11px] text-white/40 mb-1.5">Menüden (Plan sekmesi)</p>
                <ul className="flex flex-wrap gap-1.5">
                  {planned.map((item) => {
                    const ok = item.recipeId && recipes[item.recipeId];
                    return (
                      <li key={item.id} className={cn('inline-flex items-center gap-1 text-xs rounded-full px-2.5 py-1 border', ok ? 'border-emerald-400/30 text-emerald-200 bg-emerald-500/5' : 'border-amber-400/40 text-amber-200 bg-amber-400/5')}>
                        {ok ? <BookOpen className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                        {item.name}
                      </li>
                    );
                  })}
                </ul>
                {planned.some((i) => !(i.recipeId && recipes[i.recipeId])) && (
                  <button type="button" onClick={() => setActiveTab('settings')} className="mt-2 text-[11px] text-amber-300 underline underline-offset-2">
                    Sarı yemeklerin reçetesi bağlı değil, hesaba katılmaz — eşleştir
                  </button>
                )}
              </div>
            )}

            <div>
              <p className="text-[11px] text-white/40 mb-1.5">Elle eklenen reçeteler</p>
              {extras.length > 0 && (
                <ul className="space-y-1 mb-2">
                  {extras.map((r) => (
                    <li key={r.id} className="flex items-center justify-between bg-white/5 rounded-lg pl-3 pr-1 text-sm text-white/85">
                      <span className="py-2 min-w-0 truncate">{r.name} <span className="text-white/40 text-xs">· {r.cat}</span></span>
                      <button type="button" aria-label={`${r.name} kaldır`} onClick={() => updateKitchenDay(date, (d) => { d.meals[key] = d.meals[key].filter((x) => x !== r.id); })} className="w-10 h-10 flex items-center justify-center text-red-400/70"><X className="w-4 h-4" /></button>
                    </li>
                  ))}
                </ul>
              )}
              <ItemPicker items={recipeItems.filter((r) => !day.meals[key].includes(r.id))} value={null} title={`${label}: reçete ekle`} placeholder="Reçete ekle…"
                onChange={(id) => id && updateKitchenDay(date, (d) => { if (!d.meals[key].includes(id)) d.meals[key].push(id); })} />
            </div>
          </section>
        );
      })}

      {(['firin', 'direkt'] as const).map((kind) => {
        const form = kind === 'firin' ? firin : direkt;
        const set = (patch: Record<string, string>) => (kind === 'firin' ? setFirin({ ...firin, ...patch }) : setDirekt({ ...direkt, ...patch } as typeof direkt));
        const rows = day[kind];
        return (
          <section key={kind} className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
            <div>
              <h3 className="font-bold text-white">{kind === 'firin' ? 'Fırın Ürünleri' : 'Doğrudan Tüketim (ekstra ürün)'}</h3>
              <p className="text-[11px] text-white/40">{kind === 'firin' ? 'Ekmek, simit, poğaça…' : 'Süt, meyve suyu… Seçilen öğünün altında raporda görünür.'}</p>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_5rem_5rem] gap-1.5">
              <input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ürün" className={field} />
              <input value={form.amt} onChange={(e) => set({ amt: e.target.value })} inputMode="decimal" placeholder="Miktar" className={field} />
              <select value={form.unit} onChange={(e) => set({ unit: e.target.value })} className={field}>{LINE_UNITS.map((u) => <option key={u}>{u}</option>)}</select>
            </div>
            <div className="flex gap-2">
              {kind === 'direkt' && (
                <select value={direkt.meal} onChange={(e) => setDirekt({ ...direkt, meal: e.target.value as KitchenMealKey })} className={cn(field, 'flex-1')} aria-label="Hangi öğünün altında görünsün">
                  {KITCHEN_MEALS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              )}
              <button type="button" onClick={() => addRow(kind)} className="flex-1 min-h-[3rem] rounded-xl bg-emerald-600 text-white text-sm font-semibold active:bg-emerald-500">Ekle</button>
            </div>
            {rows.length > 0 && (
              <ul className="space-y-1">
                {rows.map((x, i) => (
                  <li key={i} className="flex items-center justify-between bg-white/5 rounded-lg pl-3 pr-1 text-sm text-white/85">
                    <span className="py-2 min-w-0 truncate">{x.name} <b>{x.amt} {x.unit}</b>
                      {'meal' in x && x.meal ? <span className="text-emerald-300 text-xs"> · {KITCHEN_MEAL_LABEL[x.meal]}</span> : null}</span>
                    <button type="button" aria-label={`${x.name} sil`} onClick={() => updateKitchenDay(date, (d) => { d[kind].splice(i, 1); })} className="w-10 h-10 flex items-center justify-center text-red-400/70"><X className="w-4 h-4" /></button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
