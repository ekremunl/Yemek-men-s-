// src/components/ingredients/IngredientsPanel.tsx
'use client';
import { useMemo, useState } from 'react';
import { Copy, FileSpreadsheet, Share2, ShoppingBasket, Users, AlertTriangle } from 'lucide-react';
import { useAppStore } from '@/context/store';
import { addDays, cn, formatShortDateTR, getTodayDateKey, getWeekRange, MONTH_NAMES_TR } from '@/lib/utils';
import { computeIngredients, formatQuantity, ingredientsToText } from '@/lib/shopping';

type Preset = 'today' | 'week' | 'month' | 'custom';

export default function IngredientsPanel() {
  const { menus, foodItems, recipes, persons, setPersons, currentYear, currentMonth, addToast, setActiveTab } = useAppStore((s) => ({
    menus: s.menus,
    foodItems: s.foodItems,
    recipes: s.recipes,
    persons: s.persons,
    setPersons: s.setPersons,
    currentYear: s.currentYear,
    currentMonth: s.currentMonth,
    addToast: s.addToast,
    setActiveTab: s.setActiveTab,
  }));

  const today = getTodayDateKey();
  const pad = (n: number) => String(n).padStart(2, '0');
  const monthFrom = `${currentYear}-${pad(currentMonth + 1)}-01`;
  const monthTo = `${currentYear}-${pad(currentMonth + 1)}-${pad(new Date(currentYear, currentMonth + 1, 0).getDate())}`;

  const [preset, setPreset] = useState<Preset>('week');
  const [customFrom, setCustomFrom] = useState(today);
  const [customTo, setCustomTo] = useState(addDays(today, 6));

  const range = useMemo(() => {
    if (preset === 'today') return { from: today, to: today };
    if (preset === 'week') return getWeekRange(today);
    if (preset === 'month') return { from: monthFrom, to: monthTo };
    return { from: customFrom <= customTo ? customFrom : customTo, to: customFrom <= customTo ? customTo : customFrom };
  }, [preset, today, monthFrom, monthTo, customFrom, customTo]);

  const report = useMemo(
    () => computeIngredients(menus, foodItems, recipes, persons, range.from, range.to),
    [menus, foodItems, recipes, persons, range]
  );

  const title = `Malzeme listesi: ${formatShortDateTR(range.from)} – ${formatShortDateTR(range.to)} (öğle ${persons.lunch}, akşam ${persons.dinner} kişi)`;
  const hasRecipes = Object.keys(recipes).length > 0;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(ingredientsToText(title, report));
      addToast({ type: 'success', title: 'Kopyalandı', message: 'Liste panoya kopyalandı.' });
    } catch {
      addToast({ type: 'error', title: 'Kopyalanamadı', message: 'Tarayıcı panoya erişimi engelledi.' });
    }
  };

  const share = async () => {
    const text = ingredientsToText(title, report);
    try {
      if (navigator.share) await navigator.share({ title: 'Malzeme listesi', text });
      else await copy();
    } catch (error) {
      if ((error as Error)?.name !== 'AbortError') addToast({ type: 'error', title: 'Paylaşılamadı', message: 'Bunun yerine kopyalayın.' });
    }
  };

  const exportExcel = async () => {
    const XLSX = await import('xlsx');
    const rows: (string | number)[][] = [[title], [], ['Malzeme', 'Miktar', 'Birim']];
    report.lines.forEach((l) => rows.push([l.name, l.qty, l.unit]));
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 8 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Malzeme');
    XLSX.writeFile(wb, `malzeme-listesi-${range.from}_${range.to}.xlsx`);
  };

  const presets: [Preset, string][] = [
    ['today', 'Bugün'],
    ['week', 'Bu hafta'],
    ['month', `${MONTH_NAMES_TR[currentMonth]}`],
    ['custom', 'Özel'],
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white">Malzeme / Üretim Listesi</h2>
        <p className="text-sm text-white/50 mt-1">Menüdeki yemeklerin reçetelerinden toplam malzeme hesaplanır (kişi başı miktar × kişi sayısı).</p>
      </div>

      <div className="grid grid-cols-4 gap-1.5 rounded-2xl bg-white/5 border border-white/10 p-1">
        {presets.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setPreset(key)}
            aria-pressed={preset === key}
            className={cn('min-h-[2.75rem] rounded-xl text-sm font-medium truncate px-1', preset === key ? 'bg-indigo-600 text-white' : 'text-white/55 active:bg-white/10')}
          >
            {label}
          </button>
        ))}
      </div>

      {preset === 'custom' && (
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-white/50 space-y-1">
            Başlangıç
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-white" />
          </label>
          <label className="text-xs text-white/50 space-y-1">
            Bitiş
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-white" />
          </label>
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="flex items-center gap-2 text-xs font-semibold text-white/60 mb-3">
          <Users className="w-4 h-4" />
          Kişi sayısı
        </p>
        <div className="grid grid-cols-2 gap-3">
          {(['lunch', 'dinner'] as const).map((key) => (
            <label key={key} className="text-xs text-white/50 space-y-1">
              {key === 'lunch' ? 'Öğle (ve ara öğün)' : 'Akşam'}
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={persons[key]}
                onChange={(e) => setPersons({ [key]: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-3 text-white text-base"
              />
            </label>
          ))}
        </div>
      </div>

      {!hasRecipes && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
          Henüz Mutfaktakip reçetesi içe aktarılmadı, bu yüzden liste boş.
          <button type="button" onClick={() => setActiveTab('settings')} className="block mt-2 underline underline-offset-2 text-amber-200">
            Ayarlar → Mutfaktakip bağlantısına git
          </button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          ['Menülü gün', report.daysWithMenu],
          ['Hesaplanan yemek', report.countedDishes],
          ['Malzeme', report.lines.length],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-xl bg-white/5 border border-white/10 py-3">
            <div className="text-xl font-bold text-indigo-300">{value}</div>
            <div className="text-[11px] text-white/40">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button type="button" onClick={copy} disabled={!report.lines.length} className="min-h-[3rem] flex items-center justify-center gap-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white/80 disabled:opacity-30 active:bg-white/15">
          <Copy className="w-4 h-4" /> Kopyala
        </button>
        <button type="button" onClick={share} disabled={!report.lines.length} className="min-h-[3rem] flex items-center justify-center gap-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white/80 disabled:opacity-30 active:bg-white/15">
          <Share2 className="w-4 h-4" /> Paylaş
        </button>
        <button type="button" onClick={exportExcel} disabled={!report.lines.length} className="min-h-[3rem] flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm text-white font-medium disabled:opacity-30 active:bg-emerald-500">
          <FileSpreadsheet className="w-4 h-4" /> Excel
        </button>
      </div>

      {report.lines.length > 0 ? (
        <ul className="rounded-2xl border border-white/10 divide-y divide-white/5 overflow-hidden">
          {report.lines.map((line) => (
            <li key={`${line.name}|${line.unit}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="text-white/85 min-w-0 truncate">{line.name}</span>
              <span className="font-semibold text-white tabular-nums shrink-0">{formatQuantity(line)}</span>
            </li>
          ))}
        </ul>
      ) : (
        hasRecipes && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-sm text-white/40">
            <ShoppingBasket className="w-8 h-8 mx-auto mb-2 text-white/20" />
            Bu aralıkta reçeteli yemek bulunamadı.
          </div>
        )
      )}

      {report.unlinked.length > 0 && (
        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-200">
            <AlertTriangle className="w-4 h-4" />
            Reçetesi bağlı olmayan yemekler ({report.unlinked.length})
          </p>
          <p className="text-xs text-amber-100/60 mt-1">Bunlar hesaba katılmadı. Havuzda yemeği açıp reçete bağlayın.</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {report.unlinked.map((u) => (
              <li key={u.name} className="text-[11px] px-2 py-1 rounded-full border border-amber-400/30 text-amber-200">
                {u.name}{u.count > 1 ? ` ×${u.count}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
