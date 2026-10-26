import {
  CategoryKey,
  DailyMenu,
  FoodItem,
  FourCourseMeal,
  MainMealKey,
  MealCourseField,
  PlannerMealKey,
  PlanSettings,
} from '@/types';
import { banReason, dayNumber, scheduleMonth } from './scheduler';

export const MAIN_MEAL_KEYS: MainMealKey[] = ['lunch', 'dinner'];
export const PLANNER_MEAL_KEYS: PlannerMealKey[] = ['lunch', 'dinner', 'snack'];
export const MEAL_COURSE_FIELDS: MealCourseField[] = ['soup', 'mainCourse', 'sideDish', 'complement'];

export const MEAL_LABELS_TR: Record<PlannerMealKey, string> = {
  lunch: 'Öğle Yemeği',
  dinner: 'Akşam Yemeği',
  snack: 'Ara Öğün',
};

export const MEAL_SHORT_LABELS_TR: Record<PlannerMealKey, string> = {
  lunch: 'Öğle',
  dinner: 'Akşam',
  snack: 'Ara',
};

export const COURSE_LABELS_TR: Record<MealCourseField, string> = {
  soup: 'Çorba',
  mainCourse: 'Ana Yemek',
  sideDish: 'Yan Yemek',
  complement: 'Tamamlayıcı',
};

export const COURSE_TO_CATEGORY_KEY: Record<MealCourseField, Exclude<CategoryKey, 'snacks'>> = {
  soup: 'soups',
  mainCourse: 'mainCourses',
  sideDish: 'sideDishes',
  complement: 'complements',
};

export const CATEGORY_TO_COURSE_FIELD: Record<Exclude<CategoryKey, 'snacks'>, MealCourseField> = {
  soups: 'soup',
  mainCourses: 'mainCourse',
  sideDishes: 'sideDish',
  complements: 'complement',
};

export const EMPTY_FOUR_COURSE_MEAL: FourCourseMeal = {
  soup: null,
  mainCourse: null,
  sideDish: null,
  complement: null,
};

export function createEmptyFourCourseMeal(): FourCourseMeal {
  return { ...EMPTY_FOUR_COURSE_MEAL };
}

export function createEmptyDailyMenu(date: string): DailyMenu {
  return {
    date,
    lunch: createEmptyFourCourseMeal(),
    dinner: createEmptyFourCourseMeal(),
    snack: null,
  };
}

export function countMealCourses(meal: FourCourseMeal | undefined): number {
  if (!meal) return 0;
  return MEAL_COURSE_FIELDS.filter((field) => Boolean(meal[field])).length;
}

export function isMealComplete(meal: FourCourseMeal | undefined): boolean {
  return countMealCourses(meal) === MEAL_COURSE_FIELDS.length;
}

export function countDayEntries(menu: DailyMenu | undefined): number {
  if (!menu) return 0;
  return countMealCourses(menu.lunch) + countMealCourses(menu.dinner) + (menu.snack ? 1 : 0);
}

export function isDayComplete(menu: DailyMenu | undefined): boolean {
  return Boolean(menu && isMealComplete(menu.lunch) && isMealComplete(menu.dinner) && menu.snack);
}

export function hasAnyPlannedItems(menu: DailyMenu | undefined): boolean {
  return countDayEntries(menu) > 0;
}

export function getAllMenuItemIds(menu: DailyMenu): string[] {
  return [
    ...MAIN_MEAL_KEYS.flatMap((mealKey) => MEAL_COURSE_FIELDS.map((field) => menu[mealKey][field])),
    menu.snack,
  ].filter((value): value is string => Boolean(value));
}

// --- KALORİ ---------------------------------------------------------------

export interface CalorieSummary {
  lunch: number;
  dinner: number;
  snack: number;
  total: number;
  /** Menüde seçili olup kalori bilgisi girilmemiş yemek sayısı. */
  missing: number;
}

/** Günün öğün başına ve toplam kalorisi (yalnızca kalorisi girilmiş yemekler sayılır). */
export function summarizeCalories(menu: DailyMenu | undefined, itemById: Map<string, FoodItem>): CalorieSummary {
  const out: CalorieSummary = { lunch: 0, dinner: 0, snack: 0, total: 0, missing: 0 };
  if (!menu) return out;
  const add = (id: string | null | undefined, key: 'lunch' | 'dinner' | 'snack') => {
    if (!id) return;
    const kcal = itemById.get(id)?.calories;
    if (kcal) out[key] += kcal;
    else out.missing += 1;
  };
  for (const mealKey of MAIN_MEAL_KEYS) {
    for (const field of MEAL_COURSE_FIELDS) add(menu[mealKey][field], mealKey);
  }
  add(menu.snack, 'snack');
  out.total = out.lunch + out.dinner + out.snack;
  return out;
}

// ---------------------------------------------------------------------------
// OTOMATİK MENÜ (grup tabanlı zamanlayıcı: bkz. scheduler.ts)
// ---------------------------------------------------------------------------

export interface GeneratedMonth {
  menus: DailyMenu[];
  warnings: string[];
  seed: number;
}

/**
 * Ayın menüsünü oluşturur. Ana yemekler gruplardan (bakliyat, et, etli sebze, tavuk) seçilir, haftalık eşit dağıtılır;
 * seçimde "en uzun süredir seçilmemiş" yemek alınır (geçmiş aylar dahil). Tek kural yasaklardır.
 */
export function generateAutoMonthMenus(
  items: FoodItem[],
  year: number,
  month: number,
  existingMenus: DailyMenu[],
  settings: PlanSettings,
  frozenDates: string[] = [],
  seed?: number
): GeneratedMonth {
  return scheduleMonth({ items, year, month, existingMenus, settings, frozenDates, seed });
}

// ---------------------------------------------------------------------------
// TEK YEMEK DEĞİŞTİRME / UYGUNLUK
// ---------------------------------------------------------------------------

export interface CandidateEvaluation {
  /** Önerilen adaylar: en uzun süredir kullanılmayan önde (mevcut seçim hariç). */
  ranked: string[];
  /** Seçilemez (yasaklı ya da aynı gün başka öğünde var) adaylar: kimlik → neden. */
  violations: Record<string, string>;
}

/**
 * Bir günün tek bir yemek yuvası için adayları değerlendirir.
 * Ana yemekte mevcut yemeğin grubundan öneri gelir (grup değişmez); diğer kategorilerde tüm havuz taranır.
 */
export function evaluateCandidates(
  items: FoodItem[],
  menus: DailyMenu[],
  date: string,
  mealKey: MainMealKey,
  field: MealCourseField,
  settings: PlanSettings
): CandidateEvaluation {
  const category = COURSE_TO_CATEGORY_KEY[field];
  const pool = items.filter((item) => item.category === category);
  const byId = new Map(items.map((item) => [item.id, item]));
  const today = menus.find((m) => m.date === date);
  const currentId = today?.[mealKey][field] ?? null;

  // Aynı gün başka yuvalarda kullanılanlar (bu yuva hariç).
  const usedToday = new Set<string>();
  if (today) {
    MAIN_MEAL_KEYS.forEach((key) =>
      MEAL_COURSE_FIELDS.forEach((f) => {
        const id = today[key][f];
        if (id && !(key === mealKey && f === field)) usedToday.add(id);
      })
    );
  }

  const violations: Record<string, string> = {};
  pool.forEach((item) => {
    const reason = banReason(item, date, settings);
    if (reason) violations[item.id] = reason.charAt(0).toLocaleUpperCase('tr-TR') + reason.slice(1);
    else if (usedToday.has(item.id)) violations[item.id] = 'Aynı gün başka bir öğünde zaten var';
  });

  // Her yemeğin hedef tarihe en yakın kullanım uzaklığı (gün). Uzak = önce.
  const here = dayNumber(date);
  const nearest = new Map<string, number>();
  menus.forEach((m) => {
    const gap = Math.abs(dayNumber(m.date) - here);
    MAIN_MEAL_KEYS.forEach((key) =>
      MEAL_COURSE_FIELDS.forEach((f) => {
        if (m.date === date && key === mealKey && f === field) return;
        const id = m[key][f];
        if (id) nearest.set(id, Math.min(nearest.get(id) ?? Infinity, gap));
      })
    );
    if (m.snack) nearest.set(m.snack, Math.min(nearest.get(m.snack) ?? Infinity, gap));
  });

  const currentGroup = currentId ? byId.get(currentId)?.group : undefined;
  const ranked = pool
    .filter((item) => item.id !== currentId && !violations[item.id])
    .filter((item) => (category === 'mainCourses' ? (currentGroup ? item.group === currentGroup : Boolean(item.group)) : true))
    .sort((a, b) => (nearest.get(b.id) ?? Infinity) - (nearest.get(a.id) ?? Infinity) || a.name.localeCompare(b.name, 'tr'))
    .map((item) => item.id);
  return { ranked, violations };
}
