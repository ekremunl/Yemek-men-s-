// src/types/index.ts

export type CategoryKey = 'soups' | 'mainCourses' | 'sideDishes' | 'complements' | 'snacks';

export type MainMealKey = 'lunch' | 'dinner';
export type PlannerMealKey = MainMealKey | 'snack';
export type MealCourseField = 'soup' | 'mainCourse' | 'sideDish' | 'complement';

export interface FoodItem {
  id: string;
  name: string;
  category: CategoryKey;
  tags?: string[];
}

export interface FourCourseMeal {
  soup: string | null;
  mainCourse: string | null;
  sideDish: string | null;
  complement: string | null;
}

export interface DailyMenu {
  date: string; // ISO date string YYYY-MM-DD
  lunch: FourCourseMeal;
  dinner: FourCourseMeal;
  snack: string | null; // FoodItem id
}

export interface ConflictEntry {
  date: string;
  mealKey: MainMealKey;
}

export interface ConflictWarning {
  itemId: string;
  itemName: string;
  conflictType: 'daily' | 'weekly' | 'monthly';
  conflicts: ConflictEntry[];
}

export interface CategoryMeta {
  key: CategoryKey;
  label: string;
  labelTR: string;
  color: string;
  accent: string;
  icon: string;
}

export type ViewMode = 'calendar' | 'list';
export type ActiveTab = 'planner' | 'pool' | 'export';
