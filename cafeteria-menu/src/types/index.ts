// src/types/index.ts

export type CategoryKey = 'soups' | 'mainCourses' | 'sideDishes' | 'complements';

export interface FoodItem {
  id: string;
  name: string;
  category: CategoryKey;
  tags?: string[];
}

export interface DailyMenu {
  date: string; // ISO date string YYYY-MM-DD
  soup: string | null;       // FoodItem id
  mainCourse: string | null; // FoodItem id
  sideDish: string | null;   // FoodItem id
  complement: string | null; // FoodItem id
}

export interface ConflictWarning {
  itemId: string;
  itemName: string;
  conflictType: 'weekly' | 'monthly';
  conflictDates: string[];
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
