// src/components/planner/ListView.tsx
'use client';
import { useState } from 'react';
import { Soup, UtensilsCrossed, Salad, Apple, AlertTriangle, ChevronLeft, ChevronRight, Edit3 } from 'lucide-react';
import { useAppStore } from '@/context/store';
import { CategoryKey, DailyMenu } from '@/types';
import { CATEGORY_META } from '@/lib/seedData';
import { cn, getDaysInMonth, formatDate, MONTH_NAMES_TR, DAY_NAMES_TR_FULL } from '@/lib/utils';
import DayEditor from './DayEditor';

const FIELD_MAP: Record<CategoryKey, keyof Omit<DailyMenu, 'date'>> = {
  soups: 'soup',
  mainCourses: 'mainCourse',
  sideDishes: 'sideDish',
  complements: 'complement',
};

const CAT_ICONS: Record<CategoryKey, React.ReactNode> = {
  soups: <Soup className="w-3.5 h-3.5" />,
  mainCourses: <UtensilsCrossed className="w-3.5 h-3.5" />,
  sideDishes: <Salad className="w-3.5 h-3.5" />,
  complements: <Apple className="w-3.5 h-3.5" />,
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
              {CATEGORY_META.map((cat) => (
                <th key={cat.key} className="text-left px-3 py-3 text-white/50 font-semibold text-xs uppercase tracking-wider">
                  <div className="flex items-center gap-1.5">
                    {CAT_ICONS[cat.key]}
                    <span className="hidden sm:inline">{cat.labelTR}</span>
                  </div>
                </th>
              ))}
              <th className="px-3 py-3 w-12" />
            </tr>
          </thead>
          <tbody>
            {days.map(({ day, dateStr, dayName }) => {
              const menu = menus.find((m) => m.date === dateStr);
              const hasConflict = menu?.mainCourse ? checkConflicts(dateStr, menu.mainCourse).length > 0 : false;
              const isWeekend = ['Cumartesi', 'Pazar'].includes(dayName);
              const today = formatDate(new Date());

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
                  {CATEGORY_META.map((cat) => {
                    const field = FIELD_MAP[cat.key];
                    const itemId = menu?.[field] as string | null;
                    const item = foodItems.find((f) => f.id === itemId);
                    const isConflictField = cat.key === 'mainCourses' && hasConflict;

                    return (
                      <td key={cat.key} className="px-3 py-2.5">
                        {item ? (
                          <span className={cn('text-xs', isConflictField ? 'text-amber-300' : 'text-white/70')}>
                            {isConflictField && <AlertTriangle className="inline w-3 h-3 mr-1 text-amber-400" />}
                            {item.name}
                          </span>
                        ) : (
                          <span className="text-xs text-white/15">—</span>
                        )}
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
