// src/components/planner/DayEditor.tsx
'use client';
import { useMemo, useState } from 'react';
import {
  Soup,
  UtensilsCrossed,
  Salad,
  Apple,
  Cookie,
  AlertTriangle,
  RotateCcw,
  Lock,
  Unlock,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Flame,
} from 'lucide-react';
import { useAppStore } from '@/context/store';
import { CategoryKey, MainMealKey, PlannerMealKey, MealCourseField } from '@/types';
import { CATEGORY_META } from '@/lib/seedData';
import {
  CATEGORY_TO_COURSE_FIELD,
  COURSE_LABELS_TR,
  evaluateCandidates,
  companionConflicts,
  MAIN_MEAL_KEYS,
  MEAL_LABELS_TR,
  MEAL_COURSE_FIELDS,
  PLANNER_MEAL_KEYS,
  summarizeCalories,
} from '@/lib/menu';
import { addDays, cn, formatDateLabelTR, getWeekRange, MONTH_NAMES_TR, parseDate } from '@/lib/utils';
import BottomSheet from '@/components/ui/BottomSheet';
import ItemPicker from '@/components/ui/ItemPicker';

const CAT_ICONS: Record<CategoryKey, React.ReactNode> = {
  soups: <Soup className="w-4 h-4" />,
  mainCourses: <UtensilsCrossed className="w-4 h-4" />,
  sideDishes: <Salad className="w-4 h-4" />,
  complements: <Apple className="w-4 h-4" />,
  snacks: <Cookie className="w-4 h-4" />,
};

const ACCENT_COLORS: Record<CategoryKey, string> = {
  soups: 'text-amber-400',
  mainCourses: 'text-red-400',
  sideDishes: 'text-emerald-400',
  complements: 'text-blue-400',
  snacks: 'text-violet-400',
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

export default function DayEditor({ date: initialDate, onClose }: Props) {
  const {
    foodItems, menus, setMealCourse, setSnack, clearMenuDay, checkConflicts, replaceCourse,
    lockedDates, toggleLockDay, generateBalancedMonthMenus, planSettings,
  } = useAppStore((s) => ({
    foodItems: s.foodItems,
    menus: s.menus,
    setMealCourse: s.setMealCourse,
    setSnack: s.setSnack,
    clearMenuDay: s.clearMenuDay,
    checkConflicts: s.checkConflicts,
    replaceCourse: s.replaceCourse,
    lockedDates: s.lockedDates,
    toggleLockDay: s.toggleLockDay,
    generateBalancedMonthMenus: s.generateBalancedMonthMenus,
    planSettings: s.planSettings,
  }));

  const [date, setDate] = useState(initialDate);
  const [activeMeal, setActiveMeal] = useState<PlannerMealKey>('lunch');

  const menu = menus.find((m) => m.date === date);
  const d = parseDate(date);
  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
  const isLocked = lockedDates.includes(date);

  const itemById = useMemo(() => new Map(foodItems.map((item) => [item.id, item])), [foodItems]);
  const calories = useMemo(() => summarizeCalories(menu, itemById), [menu, itemById]);

  const snackItems = useMemo(() => foodItems.filter((item) => item.category === 'snacks'), [foodItems]);

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

  // Aktif öğünün her kursu için motorun kural değerlendirmesi (uygun adaylar + ihlal nedenleri).
  const evaluations = useMemo(() => {
    if (activeMeal === 'snack') return null;
    return MEAL_COURSE_FIELDS.reduce<Record<MealCourseField, ReturnType<typeof evaluateCandidates>>>(
      (acc, field) => {
        acc[field] = evaluateCandidates(foodItems, menus, date, activeMeal, field, planSettings);
        return acc;
      },
      {} as Record<MealCourseField, ReturnType<typeof evaluateCandidates>>
    );
  }, [activeMeal, foodItems, menus, date, planSettings]);

  const regenerateWeek = () => {
    const { from, to } = getWeekRange(date);
    const lockedInWeek = lockedDates.filter((x) => x >= from && x <= to).length;
    if (
      !window.confirm(
        `${from} – ${to} haftası yeniden üretilsin mi?${lockedInWeek ? ` (${lockedInWeek} kilitli gün korunur.)` : ''}`
      )
    ) {
      return;
    }
    // Hafta iki ayı kapsıyorsa her ay için ayrı üretilir.
    const byMonth = new Map<string, { year: number; month: number; from: string; to: string }>();
    for (let cursor = from; cursor <= to; cursor = addDays(cursor, 1)) {
      const c = parseDate(cursor);
      const key = `${c.getFullYear()}-${c.getMonth()}`;
      const entry = byMonth.get(key);
      if (entry) entry.to = cursor;
      else byMonth.set(key, { year: c.getFullYear(), month: c.getMonth(), from: cursor, to: cursor });
    }
    byMonth.forEach((entry) => generateBalancedMonthMenus(entry.year, entry.month, { from: entry.from, to: entry.to }));
  };

  const mealCalories = activeMeal === 'snack' ? calories.snack : calories[activeMeal];

  const renderMainMealFields = (mealKey: MainMealKey) => {
    const meal = menu?.[mealKey];
    const conflicts = mealConflicts[mealKey];
    const companionClashes = companionConflicts(menu, mealKey, itemById);

    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-white">{MEAL_LABELS_TR[mealKey]}</p>
            {mealCalories > 0 && (
              <span className="flex items-center gap-1 text-xs text-orange-300">
                <Flame className="w-3.5 h-3.5" />
                {mealCalories} kcal
              </span>
            )}
          </div>
          <p className="text-xs text-white/45 mt-1">
            4 kap: {COURSE_LABELS_TR.soup}, {COURSE_LABELS_TR.mainCourse}, {COURSE_LABELS_TR.sideDish},{' '}
            {COURSE_LABELS_TR.complement}
          </p>
        </div>

        {MAIN_MEAL_CATEGORIES.map((category) => {
          const field = CATEGORY_TO_COURSE_FIELD[category.key] as MealCourseField;
          const selected = meal?.[field] || '';
          const inCategory = foodItems.filter((item) => item.category === category.key);
          const items = inCategory;
          const isMainConflict = field === 'mainCourse' && conflicts.length > 0;
          const evaluation = evaluations?.[field];

          return (
            <div key={`${mealKey}-${field}`}>
              <label className={cn('flex items-center gap-2 text-xs font-semibold uppercase tracking-wider mb-1.5', ACCENT_COLORS[category.key])}>
                {CAT_ICONS[category.key]}
                {category.labelTR}
                {isMainConflict && (
                  <span className="ml-auto flex items-center gap-1 text-amber-400 text-xs font-medium normal-case">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Çakışma!
                  </span>
                )}
              </label>
              <div className="flex items-stretch gap-2">
                <div className="flex-1 min-w-0">
                  <ItemPicker
                    items={items}
                    value={selected || null}
                    onChange={(id) => setMealCourse(date, mealKey, field, id)}
                    title={`${category.labelTR} seç`}
                    conflict={isMainConflict}
                    violations={evaluation?.violations}
                    suggestedIds={evaluation?.ranked}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => replaceCourse(date, mealKey, field)}
                  title="Kurallara uyan başka bir yemek öner"
                  aria-label={`${category.labelTR} için kurallara uyan başka bir yemek öner`}
                  className="w-12 shrink-0 flex items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60 active:bg-white/15 hover:text-white transition-colors"
                >
                  {selected ? <RefreshCw className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                </button>
              </div>
              {field === 'mainCourse' && companionClashes.length > 0 && (
                <div className="mt-1.5 flex items-start gap-1.5 px-3 py-2 bg-red-500/10 border border-red-400/30 rounded-lg">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-300 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-200/90">
                    {itemById.get(companionClashes[0].mainId)?.name} yanında{' '}
                    {companionClashes.map((c) => itemById.get(c.itemId)?.name).join(', ')} istenmiyor (Havuz → ana yemek → "Yanında olmasın").
                  </p>
                </div>
              )}
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
          <label className={cn('flex items-center gap-2 text-xs font-semibold uppercase tracking-wider mb-1.5', ACCENT_COLORS.snacks)}>
            {CAT_ICONS.snacks}
            {snackMeta.labelTR}
          </label>
          <ItemPicker
            items={snackItems}
            value={selected || null}
            onChange={(id) => setSnack(date, id)}
            title="Ara öğün seç"
          />
        </div>
      </div>
    );
  };

  return (
    <BottomSheet
      open
      onClose={onClose}
      subtitle="Günlük Plan Düzenleyici"
      title={formatDateLabelTR(d)}
      actions={
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => setDate(addDays(date, -1))}
            aria-label="Önceki gün"
            className="w-10 h-11 flex items-center justify-center rounded-xl text-white/60 active:bg-white/10"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setDate(addDays(date, 1))}
            aria-label="Sonraki gün"
            className="w-10 h-11 flex items-center justify-center rounded-xl text-white/60 active:bg-white/10"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => toggleLockDay(date)}
            aria-pressed={isLocked}
            aria-label={isLocked ? 'Kilidi kaldır' : 'Günü kilitle'}
            title={isLocked ? 'Kilitli: otomatik üretimde değişmez' : 'Günü kilitle'}
            className={cn(
              'w-11 h-11 flex items-center justify-center rounded-xl transition-colors',
              isLocked ? 'text-amber-300 bg-amber-400/10' : 'text-white/50 active:bg-white/10'
            )}
          >
            {isLocked ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
          </button>
        </div>
      }
      footer={
        <div className="space-y-2">
          {calories.total > 0 && (
            <p className="flex items-center justify-between text-xs text-white/50">
              <span className="flex items-center gap-1 text-orange-300">
                <Flame className="w-3.5 h-3.5" />
                Günlük toplam: <b>{calories.total} kcal</b>
              </span>
              {calories.missing > 0 && <span>{calories.missing} yemekte kalori girilmemiş</span>}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={regenerateWeek}
              className="px-4 min-h-[3rem] rounded-xl border border-white/10 bg-white/5 text-white/80 text-sm font-medium active:bg-white/15 transition-colors"
            >
              Haftayı yenile
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-h-[3rem] bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-500 text-white font-semibold rounded-xl transition-colors text-sm"
            >
              Kaydet & Kapat
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {isLocked && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
            <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            Bu gün kilitli: ay veya hafta yeniden üretilirken olduğu gibi korunur. Elle düzenleyebilirsiniz.
          </div>
        )}

        <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-white/[0.03] p-1 border border-white/10">
          {PLANNER_MEAL_KEYS.map((mealKey) => (
            <button
              key={mealKey}
              type="button"
              onClick={() => setActiveMeal(mealKey)}
              data-active={activeMeal === mealKey}
              className={cn(
                'min-h-[2.75rem] rounded-xl border border-transparent px-2 py-2 text-sm font-medium text-white/50 transition-all',
                'hover:text-white hover:bg-white/5',
                MEAL_TAB_STYLES[mealKey]
              )}
            >
              {MEAL_LABELS_TR[mealKey]}
            </button>
          ))}
        </div>

        {activeMeal === 'snack' ? renderSnackField() : renderMainMealFields(activeMeal)}

        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={() => clearMenuDay(date, activeMeal)}
            className="flex items-center gap-1.5 min-h-[2.75rem] px-2 text-xs text-white/45 active:text-white/80"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {MEAL_LABELS_TR[activeMeal]} bölümünü temizle
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`${d.getDate()} ${MONTH_NAMES_TR[d.getMonth()]} günü tamamen temizlensin mi?`)) clearMenuDay(date);
            }}
            className="min-h-[2.75rem] px-2 text-xs text-red-300/70 active:text-red-300"
          >
            Tüm günü temizle
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
