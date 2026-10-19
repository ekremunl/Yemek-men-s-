// src/lib/kitchen.ts
// Mutfak günlük tüketim raporu (eski adıyla Mutfaktakip) — menü planlayıcıyla tek veri üzerinde çalışır.
import type {
  DailyMenu, FoodItem, KitchenCardKey, KitchenDay, KitchenLine, KitchenMealKey, LinkedRecipe, PersonCounts,
} from '@/types';
import { MEAL_COURSE_FIELDS } from '@/lib/menu';
import { normalizeQuantity } from '@/lib/shopping';

export const KITCHEN_MEALS: [KitchenMealKey, string][] = [
  ['kahvalti', 'Kahvaltı'],
  ['ogle', 'Öğle Yemeği'],
  ['aksam', 'Akşam Yemeği'],
  ['ara', 'Ara Öğün'],
];
export const KITCHEN_CARDS: [KitchenCardKey, string][] = [...KITCHEN_MEALS, ['firin', 'Fırın Ürünleri']];
export const KITCHEN_MEAL_LABEL = Object.fromEntries(KITCHEN_MEALS) as Record<KitchenMealKey, string>;

export const RECIPE_UNITS = ['g', 'ml', 'adet'];
export const LINE_UNITS = ['g', 'kg', 'ml', 'L', 'adet', 'paket', 'kutu', 'dilim'];
export const RECIPE_CATEGORIES = ['Çorba', 'Ana Yemek', 'Pilav/Makarna', 'Salata', 'Tatlı', 'Kahvaltılık', 'Ara Öğün', 'Diğer'];

export const DEFAULT_BASIS: KitchenDay['basis'] = { kahvalti: 'lunch', ogle: 'lunch', aksam: 'dinner', ara: 'lunch' };

export function emptyKitchenDay(persons: PersonCounts): KitchenDay {
  return {
    lunch: persons.lunch,
    dinner: persons.dinner,
    basis: { ...DEFAULT_BASIS },
    meals: { kahvalti: [], ogle: [], aksam: [], ara: [] },
    firin: [],
    direkt: [],
    report: {},
  };
}

/** Eksik alanları tamamlar (eski/içe aktarılmış kayıtlara karşı). */
export function normalizeKitchenDay(day: Partial<KitchenDay> | undefined, persons: PersonCounts): KitchenDay {
  const base = emptyKitchenDay(persons);
  if (!day) return base;
  return {
    lunch: Number.isFinite(Number(day.lunch)) ? Number(day.lunch) : base.lunch,
    dinner: Number.isFinite(Number(day.dinner)) ? Number(day.dinner) : base.dinner,
    basis: { ...base.basis, ...(day.basis ?? {}) },
    meals: {
      kahvalti: day.meals?.kahvalti ?? [],
      ogle: day.meals?.ogle ?? [],
      aksam: day.meals?.aksam ?? [],
      ara: day.meals?.ara ?? [],
    },
    firin: day.firin ?? [],
    direkt: day.direkt ?? [],
    report: day.report ?? {},
  };
}

/** Planlayıcı menüsünden bu öğüne düşen yemekler (kahvaltı için planlayıcıda karşılık yok). */
export function plannedItemsForMeal(menu: DailyMenu | undefined, key: KitchenMealKey, itemById: Map<string, FoodItem>): FoodItem[] {
  if (!menu) return [];
  let ids: (string | null)[] = [];
  if (key === 'ogle') ids = MEAL_COURSE_FIELDS.map((f) => menu.lunch[f]);
  else if (key === 'aksam') ids = MEAL_COURSE_FIELDS.map((f) => menu.dinner[f]);
  else if (key === 'ara') ids = [menu.snack];
  return ids.map((id) => (id ? itemById.get(id) : undefined)).filter((item): item is FoodItem => Boolean(item));
}

export function mealHeadcount(day: KitchenDay, key: KitchenMealKey): number {
  return day.basis[key] === 'dinner' ? Number(day.dinner) || 0 : Number(day.lunch) || 0;
}

export interface MealRecipes {
  /** Reçetesi olan, hesaba katılacak reçeteler (menüden + elle). */
  recipes: LinkedRecipe[];
  /** Menüde olup reçetesi bağlı olmayan yemek adları. */
  unlinked: string[];
}

export function recipesForMeal(
  day: KitchenDay,
  key: KitchenMealKey,
  menu: DailyMenu | undefined,
  itemById: Map<string, FoodItem>,
  recipes: Record<string, LinkedRecipe>
): MealRecipes {
  const seen = new Set<string>();
  const out: LinkedRecipe[] = [];
  const unlinked: string[] = [];
  const add = (recipe?: LinkedRecipe) => {
    if (recipe && !seen.has(recipe.id)) {
      seen.add(recipe.id);
      out.push(recipe);
    }
  };
  plannedItemsForMeal(menu, key, itemById).forEach((item) => {
    const recipe = item.recipeId ? recipes[item.recipeId] : undefined;
    if (recipe) add(recipe);
    else unlinked.push(item.name);
  });
  (day.meals[key] ?? []).forEach((id) => add(recipes[id]));
  return { recipes: out, unlinked };
}

/** Bir kartın otomatik (menüden hesaplanan) malzeme satırları. */
export function autoLines(
  day: KitchenDay,
  key: KitchenCardKey,
  menu: DailyMenu | undefined,
  itemById: Map<string, FoodItem>,
  recipes: Record<string, LinkedRecipe>
): KitchenLine[] {
  if (key === 'firin') {
    return day.firin.map((x) => normalizeQuantity({ name: x.name, qty: Number(x.amt) || 0, unit: x.unit }));
  }
  const headcount = mealHeadcount(day, key);
  const map = new Map<string, KitchenLine>();
  const add = (name: string, qty: number, unit: string) => {
    const k = `${name.trim().toLocaleLowerCase('tr-TR')}|${unit}`;
    const entry = map.get(k) ?? { name, qty: 0, unit };
    entry.qty += qty;
    map.set(k, entry);
  };
  recipesForMeal(day, key, menu, itemById, recipes).recipes.forEach((recipe) =>
    recipe.ings.forEach((ing) => add(ing.name, (Number(ing.amt) || 0) * headcount, ing.unit))
  );
  day.direkt.filter((x) => x.meal === key).forEach((x) => add(String(x.name), Number(x.amt) || 0, x.unit));
  return Array.from(map.values()).map(normalizeQuantity);
}

/** Raporda gösterilen satırlar: elle düzenlenmişse o, değilse otomatik. */
export function cardLines(
  day: KitchenDay,
  key: KitchenCardKey,
  menu: DailyMenu | undefined,
  itemById: Map<string, FoodItem>,
  recipes: Record<string, LinkedRecipe>
): KitchenLine[] {
  return day.report[key] ?? autoLines(day, key, menu, itemById, recipes);
}
