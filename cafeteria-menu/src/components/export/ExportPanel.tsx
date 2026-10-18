// src/components/export/ExportPanel.tsx
'use client';
import { useMemo, useState } from 'react';
import { FileSpreadsheet, FileText, Share2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAppStore } from '@/context/store';
import {
  cn,
  getCalendarDateKey,
  getDaysInMonth,
  MONTH_NAMES_TR,
  DAY_NAMES_TR_FULL,
} from '@/lib/utils';
import { isDayComplete, summarizeCalories } from '@/lib/menu';

export default function ExportPanel() {
  const { currentYear, currentMonth, setCurrentMonth, menus, foodItems, addToast } = useAppStore((s) => ({
    currentYear: s.currentYear,
    currentMonth: s.currentMonth,
    setCurrentMonth: s.setCurrentMonth,
    menus: s.menus,
    foodItems: s.foodItems,
    addToast: s.addToast,
  }));

  const [busy, setBusy] = useState<null | 'xlsx' | 'pdf' | 'share'>(null);
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const monthStamp = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

  const prevMonth = () => (currentMonth === 0 ? setCurrentMonth(currentYear - 1, 11) : setCurrentMonth(currentYear, currentMonth - 1));
  const nextMonth = () => (currentMonth === 11 ? setCurrentMonth(currentYear + 1, 0) : setCurrentMonth(currentYear, currentMonth + 1));

  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(currentYear, currentMonth, i + 1, 12);
    return { day: i + 1, dateStr: getCalendarDateKey(currentYear, currentMonth, i + 1), dayName: DAY_NAMES_TR_FULL[(d.getDay() + 6) % 7] };
  });

  const itemById = useMemo(() => new Map(foodItems.map((item) => [item.id, item])), [foodItems]);
  const getItemName = (id: string | null | undefined) => (id ? itemById.get(id)?.name || '—' : '—');
  const hasCalories = foodItems.some((i) => i.calories);

  const exportToExcel = async () => {
    setBusy('xlsx');
    try {
      const XLSX = await import('xlsx');
      const header = [
        'Tarih', 'Gün',
        'Öğle Çorba', 'Öğle Ana Yemek', 'Öğle Yan Yemek', 'Öğle Tamamlayıcı',
        'Akşam Çorba', 'Akşam Ana Yemek', 'Akşam Yan Yemek', 'Akşam Tamamlayıcı',
        'Ara Öğün',
        ...(hasCalories ? ['Öğle kcal', 'Akşam kcal', 'Ara kcal', 'Toplam kcal'] : []),
      ];
      const wsData: (string | number)[][] = [[`${MONTH_NAMES_TR[currentMonth]} ${currentYear} - Yemek Listesi`], [], header];

      days.forEach(({ day, dateStr, dayName }) => {
        const menu = menus.find((m) => m.date === dateStr);
        const kcal = summarizeCalories(menu, itemById);
        wsData.push([
          `${day} ${MONTH_NAMES_TR[currentMonth]}`, dayName,
          getItemName(menu?.lunch.soup), getItemName(menu?.lunch.mainCourse), getItemName(menu?.lunch.sideDish), getItemName(menu?.lunch.complement),
          getItemName(menu?.dinner.soup), getItemName(menu?.dinner.mainCourse), getItemName(menu?.dinner.sideDish), getItemName(menu?.dinner.complement),
          getItemName(menu?.snack),
          ...(hasCalories ? [kcal.lunch || '', kcal.dinner || '', kcal.snack || '', kcal.total || ''] : []),
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = [18, 12, 20, 24, 20, 20, 20, 24, 20, 20, 18, ...(hasCalories ? [10, 10, 10, 12] : [])].map((wch) => ({ wch }));
      ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: header.length - 1 } }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `${MONTH_NAMES_TR[currentMonth]} ${currentYear}`);
      XLSX.writeFile(wb, `yemek-listesi-${monthStamp}.xlsx`);
    } finally {
      setBusy(null);
    }
  };

  const makePdf = async (): Promise<File> => {
    const { buildMonthPdf } = await import('@/lib/pdf');
    const blob = await buildMonthPdf(currentYear, currentMonth, menus, foodItems);
    return new File([blob], `yemek-listesi-${monthStamp}.pdf`, { type: 'application/pdf' });
  };

  const downloadPdf = async () => {
    setBusy('pdf');
    try {
      const file = await makePdf();
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch {
      addToast({ type: 'error', title: 'PDF oluşturulamadı', message: 'İnternet bağlantısı olmadan ilk kullanımda yazı tipi yüklenemeyebilir; bir kez çevrimiçi deneyin.' });
    } finally {
      setBusy(null);
    }
  };

  const sharePdf = async () => {
    setBusy('share');
    try {
      const file = await makePdf();
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `${MONTH_NAMES_TR[currentMonth]} ${currentYear} menüsü` });
      } else {
        addToast({ type: 'info', title: 'Paylaşım desteklenmiyor', message: 'Bu tarayıcı dosya paylaşamıyor; "PDF indir" düğmesini kullanın.' });
      }
    } catch (error) {
      if ((error as Error)?.name !== 'AbortError') addToast({ type: 'error', title: 'Paylaşılamadı', message: 'Bunun yerine "PDF indir" düğmesini kullanın.' });
    } finally {
      setBusy(null);
    }
  };

  const plannedCount = days.filter(({ dateStr }) => menus.some((m) => m.date === dateStr)).length;
  const fullCount = days.filter(({ dateStr }) => isDayComplete(menus.find((x) => x.date === dateStr))).length;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white">Menüyü Dışa Aktar</h2>
        <p className="text-sm text-white/50 mt-1">PDF veya Excel olarak indirin, ya da doğrudan paylaşın</p>
      </div>

      <div className="flex items-center justify-between">
        <button onClick={prevMonth} aria-label="Önceki ay" className="w-11 h-11 flex items-center justify-center rounded-xl bg-white/5 active:bg-white/15 text-white/60">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h3 className="text-lg font-semibold text-white">{MONTH_NAMES_TR[currentMonth]} {currentYear}</h3>
        <button onClick={nextMonth} aria-label="Sonraki ay" className="w-11 h-11 flex items-center justify-center rounded-xl bg-white/5 active:bg-white/15 text-white/60">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Toplam Gün', value: daysInMonth, color: 'text-white/80' },
          { label: 'Planlandı', value: plannedCount, color: 'text-indigo-400' },
          { label: 'Tam Menü', value: fullCount, color: 'text-emerald-400' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
            <div className={cn('text-2xl font-bold', stat.color)}>{stat.value}</div>
            <div className="text-xs text-white/40 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      <div>
        <div className="flex justify-between text-xs text-white/50 mb-1.5">
          <span>Tamamlanma</span>
          <span>{Math.round((fullCount / daysInMonth) * 100)}%</span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all duration-500" style={{ width: `${(fullCount / daysInMonth) * 100}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button onClick={downloadPdf} disabled={busy !== null} className="flex items-center justify-center gap-3 min-h-[3.5rem] px-5 rounded-xl bg-indigo-600 active:bg-indigo-500 disabled:opacity-50 text-white font-semibold transition-colors">
          <FileText className="w-5 h-5" />
          {busy === 'pdf' ? 'Hazırlanıyor…' : 'PDF indir'}
        </button>
        <button onClick={sharePdf} disabled={busy !== null} className="flex items-center justify-center gap-3 min-h-[3.5rem] px-5 rounded-xl bg-slate-600 active:bg-slate-500 disabled:opacity-50 text-white font-semibold transition-colors">
          <Share2 className="w-5 h-5" />
          {busy === 'share' ? 'Hazırlanıyor…' : 'PDF paylaş'}
        </button>
        <button onClick={exportToExcel} disabled={busy !== null} className="flex items-center justify-center gap-3 min-h-[3.5rem] px-5 rounded-xl bg-emerald-600 active:bg-emerald-500 disabled:opacity-50 text-white font-semibold transition-colors">
          <FileSpreadsheet className="w-5 h-5" />
          {busy === 'xlsx' ? 'Hazırlanıyor…' : 'Excel indir'}
        </button>
      </div>

      {/* Önizleme: yalnızca geniş ekranda */}
      <div className="hidden md:block rounded-2xl border border-white/10 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-white/5 text-white/50 text-left">
              <th className="px-3 py-2">Tarih</th>
              <th className="px-3 py-2">Öğle ana yemek</th>
              <th className="px-3 py-2">Akşam ana yemek</th>
              <th className="px-3 py-2">Ara öğün</th>
              {hasCalories && <th className="px-3 py-2">kcal</th>}
            </tr>
          </thead>
          <tbody>
            {days.map(({ day, dateStr, dayName }) => {
              const menu = menus.find((m) => m.date === dateStr);
              const kcal = summarizeCalories(menu, itemById).total;
              return (
                <tr key={dateStr} className="border-t border-white/5 text-white/70">
                  <td className="px-3 py-1.5 whitespace-nowrap">{day} {dayName.slice(0, 3)}</td>
                  <td className="px-3 py-1.5">{getItemName(menu?.lunch.mainCourse)}</td>
                  <td className="px-3 py-1.5">{getItemName(menu?.dinner.mainCourse)}</td>
                  <td className="px-3 py-1.5">{getItemName(menu?.snack)}</td>
                  {hasCalories && <td className="px-3 py-1.5">{kcal || '—'}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
