// src/components/kitchen/KitchenReport.tsx
'use client';
import { useMemo, useState } from 'react';
import { FileText, Share2, X } from 'lucide-react';
import { useAppStore } from '@/context/store';
import type { KitchenCardKey } from '@/types';
import {
  autoLines, cardLines, KITCHEN_CARDS, KITCHEN_MEALS, LINE_UNITS, normalizeKitchenDay, recipesForMeal, plannedItemsForMeal,
} from '@/lib/kitchen';
import { cn, formatDateLabelTR, parseDate } from '@/lib/utils';

const cell = 'bg-slate-800 border border-white/10 rounded-lg px-2.5 py-2.5 text-sm text-white focus:outline-none focus:border-white/30';

/** Günlük rapor: menüden hesaplanan malzemeler; satırlar elle düzenlenebilir. PDF olarak indirilir/paylaşılır. */
export default function KitchenReport({ date }: { date: string }) {
  const { kitchenDays, persons, menus, foodItems, recipes, updateKitchenDay, addToast } = useAppStore((s) => ({
    kitchenDays: s.kitchenDays, persons: s.persons, menus: s.menus, foodItems: s.foodItems, recipes: s.recipes,
    updateKitchenDay: s.updateKitchenDay, addToast: s.addToast,
  }));
  const [busy, setBusy] = useState<null | 'pdf' | 'share'>(null);

  const day = useMemo(() => normalizeKitchenDay(kitchenDays[date], persons), [kitchenDays, date, persons]);
  const menu = menus.find((m) => m.date === date);
  const itemById = useMemo(() => new Map(foodItems.map((i) => [i.id, i])), [foodItems]);

  const cards = KITCHEN_CARDS.map(([key, label]) => ({
    key, label, rows: cardLines(day, key, menu, itemById, recipes), edited: Boolean(day.report[key]),
  }));
  const totalRows = cards.reduce((s, c) => s + c.rows.length, 0);

  const summary = KITCHEN_MEALS.map(([key, label]) => {
    const planned = plannedItemsForMeal(menu, key, itemById).map((i) => i.name);
    const extras = recipesForMeal(day, key, menu, itemById, recipes).recipes
      .filter((r) => day.meals[key].includes(r.id)).map((r) => r.name);
    return { label, names: Array.from(new Set([...planned, ...extras])) };
  });

  const edit = (key: KitchenCardKey, mutate: (lines: { name: string; qty: number; unit: string }[]) => void) =>
    updateKitchenDay(date, (d) => {
      const lines = (d.report[key] ?? autoLines(d, key, menu, itemById, recipes)).map((l) => ({ ...l }));
      mutate(lines);
      d.report[key] = lines;
    });

  const reset = (key: KitchenCardKey) => {
    if (window.confirm('Elle yapılan değişiklikler silinip menüden yeniden hesaplanacak. Devam edilsin mi?')) {
      updateKitchenDay(date, (d) => { delete d.report[key]; });
    }
  };

  const makePdf = async () => {
    const { buildDayReportPdf } = await import('@/lib/pdf');
    const blob = await buildDayReportPdf({
      dateLabel: formatDateLabelTR(parseDate(date)),
      headcounts: { lunch: day.lunch, dinner: day.dinner },
      summary,
      cards: cards.map((c) => ({ label: c.label, rows: c.rows.filter((r) => r.name.trim()) })),
    });
    return new File([blob], `gunluk-rapor-${date}.pdf`, { type: 'application/pdf' });
  };

  const download = async () => {
    setBusy('pdf');
    try {
      const file = await makePdf();
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url; a.download = file.name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch {
      addToast({ type: 'error', title: 'PDF oluşturulamadı', message: 'İlk kullanımda yazı tipi için internet gerekebilir.' });
    } finally { setBusy(null); }
  };

  const share = async () => {
    setBusy('share');
    try {
      const file = await makePdf();
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: 'Günlük rapor' });
      else addToast({ type: 'info', title: 'Paylaşım desteklenmiyor', message: '"PDF indir" düğmesini kullanın.' });
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') addToast({ type: 'error', title: 'Paylaşılamadı', message: 'Bunun yerine PDF indirin.' });
    } finally { setBusy(null); }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-4">
        <p className="text-xs font-bold tracking-wide text-emerald-300 mb-2">O GÜN ÇIKAN MENÜ ÖZETİ</p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-3">
          {summary.map((s) => (
            <div key={s.label} className="min-w-0">
              <p className="text-[10px] font-bold uppercase text-white/40">{s.label.replace(' Yemeği', '')}</p>
              <p className="text-xs text-white/80 leading-snug">{s.names.length ? s.names.join(', ') : '—'}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={download} disabled={busy !== null || totalRows === 0} className="min-h-[3rem] flex items-center justify-center gap-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold disabled:opacity-40 active:bg-indigo-500">
          <FileText className="w-4 h-4" /> {busy === 'pdf' ? 'Hazırlanıyor…' : 'PDF indir'}
        </button>
        <button type="button" onClick={share} disabled={busy !== null || totalRows === 0} className="min-h-[3rem] flex items-center justify-center gap-2 rounded-xl bg-slate-600 text-white text-sm font-semibold disabled:opacity-40 active:bg-slate-500">
          <Share2 className="w-4 h-4" /> {busy === 'share' ? 'Hazırlanıyor…' : 'PDF paylaş'}
        </button>
      </div>
      <p className="text-[11px] text-white/35">Miktarlar menüden ve reçetelerden otomatik hesaplanır. Ad, miktar, birimi düzenleyebilir, satır ekleyip silebilirsiniz.</p>

      {cards.map((c) => (
        <section key={c.key} className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between mb-2 gap-2">
            <h3 className="font-bold text-white">{c.label} <span className="text-xs font-normal text-white/40">{c.rows.length} kalem</span></h3>
            {c.edited && <button type="button" onClick={() => reset(c.key)} className="text-xs font-medium text-amber-300 underline underline-offset-2 min-h-[2.5rem]">Elle düzenlendi · Sıfırla</button>}
          </div>
          <div className="space-y-1.5">
            {c.rows.map((r, i) => (
              <div key={`${c.key}-${i}-${r.name}-${r.qty}-${r.unit}`} className="grid grid-cols-[minmax(0,1fr)_4.25rem_5rem_2rem] gap-1.5 items-center">
                <input defaultValue={r.name} placeholder="Malzeme" className={cell} onBlur={(e) => e.target.value !== r.name && edit(c.key, (l) => { l[i].name = e.target.value; })} />
                <input defaultValue={r.qty} inputMode="decimal" className={cn(cell, 'text-right font-bold')}
                  onBlur={(e) => { const v = Math.max(0, parseFloat(e.target.value.replace(',', '.')) || 0); if (v !== r.qty) edit(c.key, (l) => { l[i].qty = v; }); }} />
                <select value={r.unit} className={cell} onChange={(e) => edit(c.key, (l) => { l[i].unit = e.target.value; })}>
                  {(LINE_UNITS.includes(r.unit) ? LINE_UNITS : [...LINE_UNITS, r.unit]).map((u) => <option key={u}>{u}</option>)}
                </select>
                <button type="button" aria-label="Satırı sil" onClick={() => edit(c.key, (l) => { l.splice(i, 1); })} className="w-9 h-10 flex items-center justify-center text-red-400/70"><X className="w-4 h-4" /></button>
              </div>
            ))}
            {c.rows.length === 0 && <p className="py-2 text-sm text-white/35">Bu kategoride kayıt yok.</p>}
          </div>
          <button type="button" onClick={() => edit(c.key, (l) => { l.push({ name: '', qty: 0, unit: 'adet' }); })} className="mt-2 min-h-[2.5rem] text-sm font-medium text-emerald-300">+ Satır ekle</button>
        </section>
      ))}
    </div>
  );
}
