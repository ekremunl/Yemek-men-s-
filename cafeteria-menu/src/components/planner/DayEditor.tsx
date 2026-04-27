// src/components/planner/DayEditor.tsx
'use client';
import { useMemo, useState } from 'react';
import {
  Soup,
  UtensilsCrossed,
  Salad,
  Apple,
  Cookie,
  X,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { useAppStore } from '@/context/store';
import { CategoryKey, MainMealKey, PlannerMealKey } from '@/types';
import { CATEGORY_META } from '@/lib/seedData';
import {
  CATEGORY_TO_COURSE_FIELD,
  COURSE_LABELS_TR,
  COURSE_TO_CATEGORY_KEY,
  MAIN_MEAL_KEYS,
  MEAL_LABELS_TR,
  PLANNER_MEAL_KEYS,
} from '@/lib/menu';
import { cn, formatDateLabelTR, parseDate } from '@/lib/utils';

const CAT_ICONS: Record<CategoryKey, React.ReactNode> = {
  soups: <Soup className="w-4 h-4" />,
  mainCourses: <UtensilsCrossed className="w-4 h-4" />,
  sideDishes: <Salad className="w-4 h-4" />,
  complements: <Apple className="w-4 h-4" />,
  snacks: <Cookie className="w-4 h-4" />,
};

const ACCENT_COLORS: Record<CategoryKey, string> = {
  soups: 'text-amber-400 border-amber-500/40',
  mainCourses: 'text-red-400 border-red-500/40',
  sideDishes: 'text-emerald-400 border-emerald-500/40',
  complements: 'text-blue-400 border-blue-500/40',
  snacks: 'text-violet-400 border-violet-500/40',
};

const SELECT_FOCUS: Record<CategoryKey, string> = {
  soups: 'focus:border-amber-500/60',
  mainCourses: 'focus:border-red-500/60',
  sideDishes: 'focus:border-emerald-500/60',
  complements: 'focus:border-blue-500/60',
  snacks: 'focus:border-violet-500/60',
};

const MEAL_TAB_STYLES: Record<PlannerMealKey, string> = {
  lunch: 'data-[active=true]:bg-amber-500/20 data-[active=true]:text-amber-300 data-[active=true]:border-amber-500/40',
  dinner: 'data-[active=true]:bg-red-500/20 data-[active=true]:text-red-300 data-[active=true]:border-red-500/40',
  snack: 'data-[active=true]:bg-violet-500/20 data-[active=true]:text-violet-300 data-[active=true]:border-violet-500/40',
};

const MAIN_MEAL_CATEGORIES = CATEGORY_META.filter(
  (category): category is (typeof CATEGORY_META)[number] & { key: Exclude<CategoryKey, 'snacks'> } =>
    category.key !== 'snacks'
);

interface Props {
  date: string;
  onClose: () => void;
}

function formatConflictText(conflictType: 'daily' | 'weekly' | 'monthly') {
  if (conflictType === 'daily') return 'aynı günde';
  if (conflictType === 'weekly') return 'aynı haftada';
  return 'aynı ayda';
}

export default function DayEditor({ date, onClose }: Props) {
  const { foodItems, menus, setMealCourse, setSnack, clearMenuDay, checkConflicts } = useAppStore((s) => ({
    foodItems: s.foodItems,
    menus: s.menus,
    setMealCourse: s.setMealCourse,
    setSnack: s.setSnack,
    clearMenuDay: s.clearMenuDay,
    checkConflicts: s.checkConflicts,
  }));

  const [activeMeal, setActiveMeal] = useState<PlannerMealKey>('lunch');

  const menu = menus.find((m) => m.date === date);
  const d = parseDate(date);
  const dateLabel = formatDateLabelTR(d);
  const isWeekend = d.getDay() === 0 || d.getDay() === 6;

  const snackItems = useMemo(
    () => foodItems.filter((item) => item.category === 'snacks'),
    [foodItems]
  );

  const mealConflicts = useMemo(
    () =>
      MAIN_MEAL_KEYS.reduce<Record<MainMealKey, ReturnType<typeof checkConflicts>>>(
        (acc, mealKey) => {
          const mainCourseId = menu?.[mealKey].mainCourse || null;
          acc[mealKey] = mainCourseId ? checkConflicts(date, mealKey, mainCourseId) : [];
          return acc;
        },
        { lunch: [], dinner: [] }
      ),
    [checkConflicts, date, menu]
  );

  const renderMainMealFields = (mealKey: MainMealKey) => {
    const meal = menu?.[mealKey];
    const conflicts = mealConflicts[mealKey];

    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <p className="text-sm font-semibold text-white">{MEAL_LABELS_TR[mealKey]}</p>
          <p className="text-xs text-white/45 mt-1">
            4 kap: {COURSE_LABELS_TR.soup}, {COURSE_LABELS_TR.mainCourse}, {COURSE_LABELS_TR.sideDish},{' '}
            {COURSE_LABELS_TR.complement}
          </p>
          {isWeekend && mealKey === 'lunch' && (
            <p className="text-xs text-amber-300/80 mt-2">
              Hafta sonlarında {COURSE_LABELS_TR.soup}, {COURSE_LABELS_TR.sideDish} ve {COURSE_LABELS_TR.complement}{' '}
              seçimi otomatik olarak akşam yemeğine de uygulanır. {COURSE_LABELS_TR.mainCourse} bağımsız kalır.
            </p>
          )}
        </div>

        {MAIN_MEAL_CATEGORIES.map((category) => {
          const field = CATEGORY_TO_COURSE_FIELD[category.key];
          const items = foodItems.filter((item) => item.category === category.key);
          const selected = meal?.[field] || '';
          const isMainConflict = field === 'mainCourse' && conflicts.length > 0;

          return (
            <div key={`${mealKey}-${field}`}>
              <label
                className={cn(
                  'flex items-center gap-2 text-xs font-semibold uppercase tracking-wider mb-1.5',
                  ACCENT_COLORS[category.key].split(' ')[0]
                )}
              >
                {CAT_ICONS[category.key]}
                {category.labelTR}
                {isMainConflict && (
                  <span className="ml-auto flex items-center gap-1 text-amber-400 text-xs font-medium normal-case">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Çakışma!
                  </span>
                )}
              </label>
              <select
                value={selected}
                onChange={(e) => setMealCourse(date, mealKey, field, e.target.value || null)}
                className={cn(
                  'w-full bg-slate-800 border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none transition-colors appearance-none cursor-pointer',
                  isMainConflict
                    ? 'border-amber-500/60 bg-amber-500/5'
                    : `border-white/10 ${SELECT_FOCUS[category.key]}`
                )}
              >
                <option value="">— Seçiniz —</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>

              {isMainConflict && (
                <div className="mt-1.5 flex items-start gap-1.5 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-300/80">
                    Bu ana yemek {formatConflictText(conflicts[0].conflictType)} planlandı:{' '}
                    {conflicts[0].conflicts
                      .map((entry) => `${entry.date} (${entry.mealKey === 'lunch' ? 'Öğle' : 'Akşam'})`)
                      .join(', ')}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderSnackField = () => {
    const selected = menu?.snack || '';
    const snackMeta = CATEGORY_META.find((category) => category.key === 'snacks')!;

    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <p className="text-sm font-semibold text-white">{MEAL_LABELS_TR.snack}</p>
          <p className="text-xs text-white/45 mt-1">Günlük tek ara öğün seçimi yapın.</p>
        </div>

        <div>
          <label
            className={cn(
              'flex items-center gap-2 text-xs font-semibold uppercase tracking-wider mb-1.5',
              ACCENT_COLORS.snacks.split(' ')[0]
            )}
          >
            {CAT_ICONS.snacks}
            {snackMeta.labelTR}
          </label>
          <select
            value={selected}
            onChange={(e) => setSnack(date, e.target.value || null)}
            className={cn(
              'w-full bg-slate-800 border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none transition-colors appearance-none cursor-pointer',
              `border-white/10 ${SELECT_FOCUS.snacks}`
            )}
          >
            <option value="">— Seçiniz —</option>
            {snackItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <p className="text-xs text-white/50 uppercase tracking-widest font-medium">
              Günlük Plan Düzenleyici
            </p>
            <h3 className="text-lg font-bold text-white mt-0.5">{dateLabel}</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => clearMenuDay(date, activeMeal)}
              title={`${MEAL_LABELS_TR[activeMeal]} bölümünü temizle`}
              className="p-2 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={() => clearMenuDay(date)}
              title="Tüm günü temizle"
              className="px-3 py-2 rounded-lg text-xs text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
            >
              Tümünü Temizle
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="px-6 pt-4">
          <div className="grid grid-cols-3 gap-2 rounded-2xl bg-white/[0.03] p-1 border border-white/10">
            {PLANNER_MEAL_KEYS.map((mealKey) => (
              <button
                key={mealKey}
                type="button"
                onClick={() => setActiveMeal(mealKey)}
                data-active={activeMeal === mealKey}
                className={cn(
                  'rounded-xl border border-transparent px-3 py-2.5 text-sm font-medium text-white/50 transition-all',
                  'hover:text-white hover:bg-white/5',
                  MEAL_TAB_STYLES[mealKey]
                )}
              >
                <div className="flex items-center justify-center gap-2">
                  {mealKey === 'snack'
                    ? CAT_ICONS.snacks
                    : CAT_ICONS[COURSE_TO_CATEGORY_KEY.mainCourse]}
                  <span>{MEAL_LABELS_TR[mealKey]}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-13rem)]">
          {activeMeal === 'snack' ? renderSnackField() : renderMainMealFields(activeMeal)}
        </div>

        <div className="px-6 pb-5">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors text-sm"
          >
            Kaydet & Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
