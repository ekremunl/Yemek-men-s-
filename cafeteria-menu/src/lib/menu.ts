import {
  CategoryKey,
  DailyMenu,
  FourCourseMeal,
  MainMealKey,
  MealCourseField,
  PlannerMealKey,
} from '@/types';

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
