// src/components/planner/CalendarView.tsx
'use client';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, AlertTriangle, Check } from 'lucide-react';
import { useAppStore } from '@/context/store';
import { cn, getDaysInMonth, getFirstDayOfMonth, MONTH_NAMES_TR, DAY_NAMES_TR, formatDate } from '@/lib/utils';
import DayEditor from './DayEditor';

function completionScore(menu: { soup: string | null; mainCourse: string | null; sideDish: string | null; complement: string | null } | undefined): number {
  if (!menu) return 0;
  return [menu.soup, menu.mainCourse, menu.sideDish, menu.complement].filter(Boolean).length;
}

export default function CalendarView() {
  const { currentYear, currentMonth, setCurrentMonth, menus, foodItems, checkConflicts } = useAppStore((s) => ({
    currentYear: s.currentYear,
    currentMonth: s.currentMonth,
    setCurrentMonth: s.setCurrentMonth,
    menus: s.menus,
    foodItems: s.foodItems,
    checkConflicts: s.checkConflicts,
  }));

  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  const prevMonth = () => {
    if (currentMonth === 0) setCurrentMonth(currentYear - 1, 11);
    else setCurrentMonth(currentYear, currentMonth - 1);
  };
  const nextMonth = () => {
    if (currentMonth === 11) setCurrentMonth(currentYear + 1, 0);
    else setCurrentMonth(currentYear, currentMonth + 1);
  };

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="space-y-4">
      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white tracking-tight">
            {MONTH_NAMES_TR[currentMonth]} {currentYear}
          </h2>
          <p className="text-xs text-white/40 mt-0.5">
            {menus.filter((m) => {
              const d = new Date(m.date);
              return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
            }).length} / {daysInMonth} gün planlandı
          </p>
        </div>
        <button
          onClick={nextMonth}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1">
        {DAY_NAMES_TR.map((day) => (
          <div key={day} className="text-center text-xs font-semibold text-white/30 uppercase tracking-widest py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((day, idx) => {
          if (!day) {
            return <div key={`empty-${idx}`} className="aspect-square" />;
          }

          const dateStr = formatDate(new Date(currentYear, currentMonth, day));
          const menu = menus.find((m) => m.date === dateStr);
          const score = completionScore(menu);
          const hasConflict = menu?.mainCourse ? checkConflicts(dateStr, menu.mainCourse).length > 0 : false;
          const today = new Date();
          const isToday = today.getDate() === day && today.getMonth() === currentMonth && today.getFullYear() === currentYear;

          return (
            <button
              key={dateStr}
              onClick={() => setSelectedDate(dateStr)}
              className={cn(
                'aspect-square rounded-xl border text-left p-1.5 flex flex-col transition-all group relative overflow-hidden',
                isToday
                  ? 'border-indigo-500/60 bg-indigo-500/10 ring-1 ring-indigo-500/40'
                  : score > 0
                  ? 'border-white/15 bg-white/5 hover:bg-white/10'
                  : 'border-white/5 bg-white/[0.02] hover:bg-white/5 hover:border-white/15'
              )}
            >
              <span
                className={cn(
                  'text-xs font-bold leading-none',
                  isToday ? 'text-indigo-400' : score > 0 ? 'text-white/80' : 'text-white/30'
                )}
              >
                {day}
              </span>

              {/* Completion dots */}
              {score > 0 && (
                <div className="flex gap-0.5 mt-auto flex-wrap">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={cn(
                        'w-1.5 h-1.5 rounded-full',
                        i === 0 ? (menu?.soup ? 'bg-amber-400' : 'bg-white/10') :
                        i === 1 ? (menu?.mainCourse ? 'bg-red-400' : 'bg-white/10') :
                        i === 2 ? (menu?.sideDish ? 'bg-emerald-400' : 'bg-white/10') :
                        (menu?.complement ? 'bg-blue-400' : 'bg-white/10')
                      )}
                    />
                  ))}
                </div>
              )}

              {/* Full check */}
              {score === 4 && !hasConflict && (
                <div className="absolute top-1 right-1">
                  <Check className="w-2.5 h-2.5 text-emerald-400" />
                </div>
              )}

              {/* Conflict badge */}
              {hasConflict && (
                <div className="absolute top-1 right-1">
                  <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-white/40 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-amber-400" />
          <span>Çorba</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-400" />
          <span>Ana Yemek</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>Yan Yemek</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-blue-400" />
          <span>Tamamlayıcı</span>
        </div>
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="w-3 h-3 text-amber-400" />
          <span>Çakışma</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Check className="w-3 h-3 text-emerald-400" />
          <span>Tam</span>
        </div>
      </div>

      {selectedDate && (
        <DayEditor date={selectedDate} onClose={() => setSelectedDate(null)} />
      )}
    </div>
  );
}
