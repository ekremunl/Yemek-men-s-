// src/components/export/ExportPanel.tsx
'use client';
import { useState } from 'react';
import { FileSpreadsheet, Printer, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAppStore } from '@/context/store';
import { cn, getDaysInMonth, formatDate, MONTH_NAMES_TR, DAY_NAMES_TR_FULL } from '@/lib/utils';
import { CATEGORY_META } from '@/lib/seedData';
import { CategoryKey, DailyMenu } from '@/types';

const FIELD_MAP: Record<CategoryKey, keyof Omit<DailyMenu, 'date'>> = {
  soups: 'soup',
  mainCourses: 'mainCourse',
  sideDishes: 'sideDish',
  complements: 'complement',
};

export default function ExportPanel() {
  const { currentYear, currentMonth, setCurrentMonth, menus, foodItems } = useAppStore((s) => ({
    currentYear: s.currentYear,
    currentMonth: s.currentMonth,
    setCurrentMonth: s.setCurrentMonth,
    menus: s.menus,
    foodItems: s.foodItems,
  }));

  const [isExporting, setIsExporting] = useState(false);

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);

  const prevMonth = () => {
    if (currentMonth === 0) setCurrentMonth(currentYear - 1, 11);
    else setCurrentMonth(currentYear, currentMonth - 1);
  };
  const nextMonth = () => {
    if (currentMonth === 11) setCurrentMonth(currentYear + 1, 0);
    else setCurrentMonth(currentYear, currentMonth + 1);
  };

  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(currentYear, currentMonth, i + 1);
    return { day: i + 1, dateStr: formatDate(d), dayName: DAY_NAMES_TR_FULL[(d.getDay() + 6) % 7] };
  });

  const getItemName = (id: string | null | undefined) => {
    if (!id) return '—';
    return foodItems.find((f) => f.id === id)?.name || '—';
  };

  const exportToExcel = async () => {
    setIsExporting(true);
    try {
      const XLSX = await import('xlsx');
      const wsData: (string | number)[][] = [
        [`${MONTH_NAMES_TR[currentMonth]} ${currentYear} - Yemek Listesi`],
        [],
        ['Tarih', 'Gün', 'Çorba', 'Ana Yemek', 'Yan Yemek', 'Tamamlayıcı'],
      ];

      days.forEach(({ day, dateStr, dayName }) => {
        const menu = menus.find((m) => m.date === dateStr);
        wsData.push([
          `${day} ${MONTH_NAMES_TR[currentMonth]}`,
          dayName,
          getItemName(menu?.soup),
          getItemName(menu?.mainCourse),
          getItemName(menu?.sideDish),
          getItemName(menu?.complement),
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = [{ wch: 18 }, { wch: 12 }, { wch: 24 }, { wch: 24 }, { wch: 20 }, { wch: 20 }];
      // Merge title row
      ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `${MONTH_NAMES_TR[currentMonth]} ${currentYear}`);
      XLSX.writeFile(wb, `yemek-listesi-${currentYear}-${String(currentMonth + 1).padStart(2, '0')}.xlsx`);
    } finally {
      setIsExporting(false);
    }
  };

  const printMenu = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const rows = days.map(({ day, dateStr, dayName }) => {
      const menu = menus.find((m) => m.date === dateStr);
      const isWeekend = ['Cumartesi', 'Pazar'].includes(dayName);
      return `
        <tr style="${isWeekend ? 'background:#f9f9f9;' : ''}">
          <td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;">${day} ${MONTH_NAMES_TR[currentMonth]}</td>
          <td style="padding:8px 12px;border:1px solid #e5e7eb;color:#6b7280;">${dayName}</td>
          <td style="padding:8px 12px;border:1px solid #e5e7eb;">${getItemName(menu?.soup)}</td>
          <td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:500;">${getItemName(menu?.mainCourse)}</td>
          <td style="padding:8px 12px;border:1px solid #e5e7eb;">${getItemName(menu?.sideDish)}</td>
          <td style="padding:8px 12px;border:1px solid #e5e7eb;">${getItemName(menu?.complement)}</td>
        </tr>
      `;
    }).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${MONTH_NAMES_TR[currentMonth]} ${currentYear} - Yemek Listesi</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
          body { font-family: 'Inter', sans-serif; padding: 32px; color: #111827; }
          h1 { font-size: 24px; font-weight: 700; margin-bottom: 4px; }
          p { color: #6b7280; margin-bottom: 24px; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          thead { background: #1e293b; color: white; }
          thead th { padding: 10px 12px; text-align: left; font-weight: 600; border: 1px solid #334155; }
          tbody tr:hover { background: #f0f9ff; }
          @media print { body { padding: 16px; } }
        </style>
      </head>
      <body>
        <h1>🍽 ${MONTH_NAMES_TR[currentMonth]} ${currentYear} Yemek Listesi</h1>
        <p>Okul Yatakhanesi Yemekhane Aylık Menüsü</p>
        <table>
          <thead>
            <tr>
              <th>Tarih</th><th>Gün</th><th>Çorba</th><th>Ana Yemek</th><th>Yan Yemek</th><th>Tamamlayıcı</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <script>window.onload = () => { window.print(); }<\/script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const plannedCount = days.filter(({ dateStr }) => menus.some((m) => m.date === dateStr)).length;
  const fullCount = days.filter(({ dateStr }) => {
    const m = menus.find((x) => x.date === dateStr);
    return m && m.soup && m.mainCourse && m.sideDish && m.complement;
  }).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Menüyü Dışa Aktar</h2>
        <p className="text-sm text-white/50 mt-1">Excel veya yazdırılabilir format olarak indirin</p>
      </div>

      {/* Month Nav */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h3 className="text-lg font-semibold text-white">{MONTH_NAMES_TR[currentMonth]} {currentYear}</h3>
        <button onClick={nextMonth} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Toplam Gün', value: daysInMonth, color: 'text-white/80' },
          { label: 'Planlandı', value: plannedCount, color: 'text-indigo-400' },
          { label: 'Tam Menü', value: fullCount, color: 'text-emerald-400' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl bg-white/5 border border-white/10 p-4 text-center">
            <div className={cn('text-2xl font-bold', stat.color)}>{stat.value}</div>
            <div className="text-xs text-white/40 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Completeness bar */}
      <div>
        <div className="flex justify-between text-xs text-white/50 mb-1.5">
          <span>Tamamlanma</span>
          <span>{Math.round((fullCount / daysInMonth) * 100)}%</span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${(fullCount / daysInMonth) * 100}%` }}
          />
        </div>
      </div>

      {/* Export buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={exportToExcel}
          disabled={isExporting}
          className="flex items-center justify-center gap-3 py-4 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold transition-colors"
        >
          <FileSpreadsheet className="w-5 h-5" />
          {isExporting ? 'Dışa Aktarılıyor...' : 'Excel İndir (.xlsx)'}
        </button>
        <button
          onClick={printMenu}
          className="flex items-center justify-center gap-3 py-4 px-5 rounded-xl bg-slate-600 hover:bg-slate-500 text-white font-semibold transition-colors"
        >
          <Printer className="w-5 h-5" />
          Yazdır / PDF
        </button>
      </div>

      {/* Preview table */}
      <div>
        <h4 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">Önizleme</h4>
        <div className="overflow-x-auto rounded-2xl border border-white/10 max-h-96 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-800">
              <tr>
                <th className="text-left px-3 py-2.5 text-white/50 font-semibold uppercase tracking-wider">Tarih</th>
                <th className="text-left px-3 py-2.5 text-white/50 font-semibold uppercase tracking-wider">Gün</th>
                {CATEGORY_META.map((cat) => (
                  <th key={cat.key} className="text-left px-3 py-2.5 text-white/50 font-semibold uppercase tracking-wider">
                    {cat.labelTR}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map(({ day, dateStr, dayName }) => {
                const menu = menus.find((m) => m.date === dateStr);
                return (
                  <tr key={dateStr} className="border-t border-white/5 hover:bg-white/[0.03]">
                    <td className="px-3 py-2 text-white/70 font-medium">{day} {MONTH_NAMES_TR[currentMonth].slice(0, 3)}</td>
                    <td className="px-3 py-2 text-white/40">{dayName.slice(0, 3)}</td>
                    {CATEGORY_META.map((cat) => {
                      const field = FIELD_MAP[cat.key];
                      return (
                        <td key={cat.key} className="px-3 py-2 text-white/60">
                          {getItemName((menu?.[field] as string | null) || null)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
