// src/components/planner/CalendarView.tsx
'use client';
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, AlertTriangle, Check } from 'lucide-react';
import { useAppStore } from '@/context/store';
import {
  cn,
  getCalendarDateKey,
  getDaysInMonth,
  getFirstDayOfMonth,
  getMonthMenus,
  MONTH_NAMES_TR,
  DAY_NAMES_TR,
  getTodayDateKey,
} from '@/lib/utils';
import {
  countDayEntries,
  isDayComplete,
  MAIN_MEAL_KEYS,
  MEAL_SHORT_LABELS_TR,
  PLANNER_MEAL_KEYS,
} from '@/lib/menu';
import { MainMealKey, PlannerMealKey } from '@/types';
import DayEditor from './DayEditor';

const SUMMARY_STYLES: Record<PlannerMealKey, string> = {
  lunch: 'border-amber-500/20 bg-amber-500/10 text-amber-100',
  dinner: 'border-red-500/20 bg-red-500/10 text-red-100',
  snack: 'border-violet-500/20 bg-violet-500/10 text-violet-100',
};

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

  const itemNameMap = useMemo(
    () => Object.fromEntries(foodItems.map((item) => [item.id, item.name])),
    [foodItems]
  );

  const getSummaryText = (dateStr: string, mealKey: PlannerMealKey) => {
    const menu = menus.find((entry) => entry.date === dateStr);
    if (!menu) return '—';

    if (mealKey === 'snack') {
      return menu.snack ? itemNameMap[menu.snack] ?? '—' : '—';
    }

    return menu[mealKey].mainCourse ? itemNameMap[menu[mealKey].mainCourse] ?? '—' : '—';
  };

  const hasMealConflict = (dateStr: string, mealKey: MainMealKey) => {
    const menu = menus.find((entry) => entry.date === dateStr);
    const mainCourseId = menu?.[mealKey].mainCourse;
    return mainCourseId ? checkConflicts(dateStr, mealKey, mainCourseId).length > 0 : false;
  };

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
            {getMonthMenus(menus, currentYear, currentMonth).length} / {daysInMonth} gün planlandı
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
            return <div key={`empty-${idx}`} className="min-h-[8.5rem]" />;
          }

          const dateStr = getCalendarDateKey(currentYear, currentMonth, day);
          const menu = menus.find((m) => m.date === dateStr);
          const score = countDayEntries(menu);
          const hasConflict = MAIN_MEAL_KEYS.some((mealKey) => hasMealConflict(dateStr, mealKey));
          const isToday = dateStr === getTodayDateKey();

          return (
            <button
              key={dateStr}
              onClick={() => setSelectedDate(dateStr)}
              className={cn(
                'min-h-[8.5rem] rounded-xl border text-left p-2 flex flex-col transition-all group relative overflow-hidden',
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

              <div className="mt-2 space-y-1.5">
                {PLANNER_MEAL_KEYS.map((mealKey) => {
                  const text = getSummaryText(dateStr, mealKey);
                  return (
                    <div
                      key={mealKey}
                      className={cn(
                        'rounded-lg border px-2 py-1 text-[10px] leading-tight',
                        SUMMARY_STYLES[mealKey],
                        text === '—' ? 'opacity-50' : 'opacity-100'
                      )}
                    >
                      <span className="block font-semibold uppercase tracking-wide text-white/70">
                        {MEAL_SHORT_LABELS_TR[mealKey]}
                      </span>
                      <span className="block truncate mt-0.5">{text}</span>
                    </div>
                  );
                })}
              </div>

              {/* Full check */}
              {isDayComplete(menu) && !hasConflict && (
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
          <span>Öğle</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-400" />
          <span>Akşam</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-violet-400" />
          <span>Ara Öğün</span>
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
