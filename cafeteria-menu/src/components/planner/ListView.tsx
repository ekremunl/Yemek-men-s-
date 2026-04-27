// src/components/planner/ListView.tsx
'use client';
import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Edit3 } from 'lucide-react';
import { useAppStore } from '@/context/store';
import { MainMealKey, PlannerMealKey } from '@/types';
import { cn, getDaysInMonth, getMonthDayEntries, getTodayIsoDate, MONTH_NAMES_TR } from '@/lib/utils';
import { MAIN_MEAL_KEYS, MEAL_LABELS_TR, PLANNER_MEAL_KEYS } from '@/lib/menu';
import DayEditor from './DayEditor';

const CELL_STYLES: Record<PlannerMealKey, string> = {
  lunch: 'border-amber-500/20 bg-amber-500/10',
  dinner: 'border-red-500/20 bg-red-500/10',
  snack: 'border-violet-500/20 bg-violet-500/10',
};

export default function ListView() {
  const { currentYear, currentMonth, setCurrentMonth, menus, foodItems, checkConflicts } = useAppStore((s) => ({
    currentYear: s.currentYear,
    currentMonth: s.currentMonth,
    setCurrentMonth: s.setCurrentMonth,
    menus: s.menus,
    foodItems: s.foodItems,
    checkConflicts: s.checkConflicts,
  }));

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const itemNameMap = useMemo(
    () => Object.fromEntries(foodItems.map((item) => [item.id, item.name])),
    [foodItems]
  );

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);

  const prevMonth = () => {
    if (currentMonth === 0) setCurrentMonth(currentYear - 1, 11);
    else setCurrentMonth(currentYear, currentMonth - 1);
  };
  const nextMonth = () => {
    if (currentMonth === 11) setCurrentMonth(currentYear + 1, 0);
    else setCurrentMonth(currentYear, currentMonth + 1);
  };

  const days = getMonthDayEntries(currentYear, currentMonth);

  const getMealSummary = (dateStr: string, mealKey: PlannerMealKey) => {
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
      {/* Nav */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-bold text-white">{MONTH_NAMES_TR[currentMonth]} {currentYear}</h2>
        <button onClick={nextMonth} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Table header */}
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              <th className="text-left px-4 py-3 text-white/50 font-semibold text-xs uppercase tracking-wider w-32">Tarih</th>
              <th className="text-left px-3 py-3 text-white/50 font-semibold text-xs uppercase tracking-wider">Öğle Yemeği</th>
              <th className="text-left px-3 py-3 text-white/50 font-semibold text-xs uppercase tracking-wider">Akşam Yemeği</th>
              <th className="text-left px-3 py-3 text-white/50 font-semibold text-xs uppercase tracking-wider">Ara Öğün</th>
              <th className="px-3 py-3 w-12" />
            </tr>
          </thead>
          <tbody>
            {days.map(({ day, dateStr, dayName }) => {
              const hasConflict = MAIN_MEAL_KEYS.some((mealKey) => hasMealConflict(dateStr, mealKey));
              const isWeekend = ['Cumartesi', 'Pazar'].includes(dayName);
              const today = getTodayIsoDate();

              return (
                <tr
                  key={dateStr}
                  className={cn(
                    'border-b border-white/5 transition-colors',
                    isWeekend ? 'bg-white/[0.015]' : '',
                    dateStr === today ? 'bg-indigo-500/5' : 'hover:bg-white/[0.03]'
                  )}
                >
                  <td className="px-4 py-2.5">
                    <div className={cn('font-semibold text-sm', dateStr === today ? 'text-indigo-400' : isWeekend ? 'text-white/40' : 'text-white/80')}>
                      {day}
                    </div>
                    <div className="text-xs text-white/30">{dayName.slice(0, 3)}</div>
                  </td>
                  {PLANNER_MEAL_KEYS.map((mealKey) => {
                    const summary = getMealSummary(dateStr, mealKey);
                    const isConflictField = mealKey !== 'snack' && hasMealConflict(dateStr, mealKey);

                    return (
                      <td key={mealKey} className="px-3 py-2.5">
                        <div className={cn('rounded-lg border px-3 py-2 min-h-[3.5rem]', CELL_STYLES[mealKey])}>
                          <div className="text-[10px] uppercase tracking-wide text-white/45 font-semibold mb-1">
                            {MEAL_LABELS_TR[mealKey]}
                          </div>
                          <div className={cn('text-xs leading-snug', summary === '—' ? 'text-white/20' : 'text-white/75')}>
                            {isConflictField && (
                              <span className="inline-flex items-center gap-1 mr-1 text-amber-300">
                                <AlertTriangle className="w-3 h-3 text-amber-400" />
                              </span>
                            )}
                            {summary}
                          </div>
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2.5">
                    <button
                      onClick={() => setSelectedDate(dateStr)}
                      className="p-1.5 rounded-lg text-white/20 hover:text-white/60 hover:bg-white/10 transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedDate && (
        <DayEditor date={selectedDate} onClose={() => setSelectedDate(null)} />
      )}
    </div>
  );
}
