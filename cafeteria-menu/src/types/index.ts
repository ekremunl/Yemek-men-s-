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
  /** Aynı öğünde bu etiketleri taşıyan yemeklerle birlikte seçilmez (otomatik menü motoru). */
  incompatibleWithTags?: string[];
  /** Baskın bileşenler (ör. ['mercimek']). Aynı öğünde çakışan bileşen engellenir. */
  mainIngredients?: string[];
  /**
   * Yalnızca ana yemekler için: yanına önerilen çorba / yan yemek / tamamlayıcıların kimlikleri.
   * Otomatik menü, her kategoride bu listeden birini tercih eder (kurallara aykırı değilse).
   */
  suggestedCompanions?: string[];
  /** Porsiyon başına kalori (kcal). Elle girilir. */
  calories?: number;
  /** Mutfaktakip reçete kimliği (varsa malzeme listesi bu reçeteden hesaplanır). */
  recipeId?: string;
}

/** Mutfaktakip reçetesindeki bir malzeme (miktar KİŞİ BAŞI). */
export interface RecipeIngredient {
  name: string;
  amt: number;
  unit: string;
}

/** Mutfaktakip'ten alınan reçetenin yerel kopyası. */
export interface LinkedRecipe {
  id: string;
  name: string;
  cat?: string;
  ings: RecipeIngredient[];
}

/** Menü üretici kural ayarları (arayüzden değiştirilebilir). */
export interface RuleSettings {
  /** Aynı ana yemek kaç gün tekrar edemez. */
  mainCooldownDays: number;
  /** Aynı protein en fazla kaç gün üst üste. */
  maxConsecutiveProteinDays: number;
  /** Hafta sonu akşam çorba/yan/tamamlayıcı öğleyle aynı olsun. */
  weekendSync: boolean;
  /** Ana yemeğin eşlikçi listesi zorunlu olsun. */
  requireCompanions: boolean;
}

export const DEFAULT_RULE_SETTINGS: RuleSettings = {
  mainCooldownDays: 5,
  maxConsecutiveProteinDays: 2,
  weekendSync: true,
  requireCompanions: true,
};

/** Malzeme / üretim listesi için kişi sayıları. */
export interface PersonCounts {
  lunch: number;
  dinner: number;
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
export type ActiveTab = 'planner' | 'pool' | 'ingredients' | 'export' | 'settings';
