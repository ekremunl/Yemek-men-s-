// src/components/planner/DayCard.tsx
'use client';
import { useMemo, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, Edit3, Flame, Lock } from 'lucide-react';
import { useAppStore } from '@/context/store';
import { MainMealKey, PlannerMealKey } from '@/types';
import {
  isDayComplete,
  MAIN_MEAL_KEYS,
  MEAL_COURSE_FIELDS,
  MEAL_LABELS_TR,
  COURSE_LABELS_TR,
  PLANNER_MEAL_KEYS,
  summarizeCalories,
} from '@/lib/menu';
import { cn, DAY_NAMES_TR, getTodayDateKey, parseDate } from '@/lib/utils';

const MEAL_STYLES: Record<PlannerMealKey, string> = {
  lunch: 'border-amber-500/20 bg-amber-500/10',
  dinner: 'border-red-500/20 bg-red-500/10',
  snack: 'border-violet-500/20 bg-violet-500/10',
};

interface DayCardProps {
  dateStr: string;
  onOpen: (dateStr: string) => void;
  /** true: dokununca 4 kapı gösterir (liste görünümü). false: her zaman tam açık (hafta görünümü). */
  expandable?: boolean;
}

/** Mobil için tek günlük kart: tarih, kilit/uyarı rozetleri, öğün özetleri ve kalori. */
export default function DayCard({ dateStr, onOpen, expandable }: DayCardProps) {
  const { menus, foodItems, checkConflicts, lockedDates } = useAppStore((s) => ({
    menus: s.menus,
    foodItems: s.foodItems,
    checkConflicts: s.checkConflicts,
    lockedDates: s.lockedDates,
  }));
  const [expanded, setExpanded] = useState(false);
  const showFull = !expandable || expanded;

  const menu = menus.find((m) => m.date === dateStr);
  const itemById = useMemo(() => new Map(foodItems.map((item) => [item.id, item])), [foodItems]);
  const name = (id: string | null | undefined) => (id ? itemById.get(id)?.name ?? '—' : '—');
  const d = parseDate(dateStr);
  const dayName = DAY_NAMES_TR[(d.getDay() + 6) % 7];
  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
  const isToday = dateStr === getTodayDateKey();
  const isLocked = lockedDates.includes(dateStr);
  const calories = summarizeCalories(menu, itemById);

  const hasConflict = MAIN_MEAL_KEYS.some((mealKey) => {
    const id = menu?.[mealKey].mainCourse;
    return id ? checkConflicts(dateStr, mealKey, id).length > 0 : false;
  });

  const mealLines = (mealKey: PlannerMealKey): { label: string; value: string }[] => {
    if (mealKey === 'snack') return [{ label: MEAL_LABELS_TR.snack, value: name(menu?.snack) }];
    const meal = menu?.[mealKey as MainMealKey];
    if (!showFull) return [{ label: COURSE_LABELS_TR.mainCourse, value: name(meal?.mainCourse) }];
    return MEAL_COURSE_FIELDS.map((field) => ({ label: COURSE_LABELS_TR[field], value: name(meal?.[field]) }));
  };

  return (
    <article
      className={cn(
        'rounded-2xl border overflow-hidden',
        isToday ? 'border-indigo-500/60 bg-indigo-500/10' : isWeekend ? 'border-white/10 bg-white/[0.04]' : 'border-white/10 bg-white/5'
      )}
    >
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={expandable ? () => setExpanded((v) => !v) : () => onOpen(dateStr)}
          aria-expanded={expandable ? expanded : undefined}
          className="flex-1 min-w-0 flex items-center gap-3 px-4 py-3 text-left"
        >
          <span className="w-10 shrink-0 text-center">
            <span className={cn('block text-xl font-bold leading-none', isToday ? 'text-indigo-300' : 'text-white/90')}>{d.getDate()}</span>
            <span className="block text-[10px] uppercase tracking-wide text-white/40 mt-1">{dayName}</span>
          </span>
          <span className="flex-1 min-w-0">
            <span className="flex items-center gap-1.5 text-xs text-white/50">
              {isLocked && <Lock className="w-3 h-3 text-amber-300" />}
              {hasConflict && <AlertTriangle className="w-3 h-3 text-amber-400" />}
              {isDayComplete(menu) && !hasConflict && <Check className="w-3 h-3 text-emerald-400" />}
              {calories.total > 0 && (
                <span className="flex items-center gap-0.5 text-orange-300/90">
                  <Flame className="w-3 h-3" />
                  {calories.total} kcal
                </span>
              )}
            </span>
            {expandable && !expanded && (
              <span className="block text-xs text-white/70 mt-1 truncate">
                {[name(menu?.lunch.mainCourse), name(menu?.dinner.mainCourse)].join(' · ')}
              </span>
            )}
          </span>
          {expandable && <ChevronDown className={cn('w-4 h-4 text-white/40 transition-transform', expanded && 'rotate-180')} />}
        </button>
        <button
          type="button"
          onClick={() => onOpen(dateStr)}
          aria-label={`${d.getDate()}. günü düzenle`}
          className="w-14 shrink-0 flex items-center justify-center text-white/50 active:bg-white/10 border-l border-white/5"
        >
          <Edit3 className="w-4 h-4" />
        </button>
      </div>

      {showFull && (
        <div className="px-3 pb-3 space-y-2">
          {PLANNER_MEAL_KEYS.map((mealKey) => (
            <div key={mealKey} className={cn('rounded-xl border px-3 py-2', MEAL_STYLES[mealKey])}>
              <p className="text-[10px] uppercase tracking-wide text-white/50 font-semibold mb-1">{MEAL_LABELS_TR[mealKey]}</p>
              <dl className="space-y-0.5">
                {mealLines(mealKey).map((line) => (
                  <div key={line.label} className="flex gap-2 text-xs">
                    <dt className="w-24 shrink-0 text-white/40">{line.label}</dt>
                    <dd className={cn('min-w-0 truncate', line.value === '—' ? 'text-white/20' : 'text-white/80')}>{line.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
