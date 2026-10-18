// src/lib/shopping.ts
// Menüden malzeme / üretim listesi: bağlı Mutfaktakip reçetelerinin kişi başı miktarları × kişi sayısı.
import type { DailyMenu, FoodItem, LinkedRecipe, PersonCounts } from '@/types';
import { MEAL_COURSE_FIELDS } from '@/lib/menu';

export interface IngredientLine {
  name: string;
  qty: number;
  unit: string;
}

export interface IngredientReport {
  lines: IngredientLine[];
  /** Reçetesi bağlı olmadığı için hesaba katılmayan yemekler (kaç kez menüde geçtiği ile). */
  unlinked: { name: string; count: number }[];
  /** Hesaba katılan yemek sayısı (tekrarlarıyla). */
  countedDishes: number;
  /** Tarih aralığında menüsü olan gün sayısı. */
  daysWithMenu: number;
}

/** Mutfaktakip ile aynı sadeleştirme: 1000 g → kg, 1000 ml → L; iki ondalık. */
export function normalizeQuantity(line: IngredientLine): IngredientLine {
  let { qty, unit } = line;
  if (unit === 'g' && qty >= 1000) {
    qty /= 1000;
    unit = 'kg';
  } else if (unit === 'ml' && qty >= 1000) {
    qty /= 1000;
    unit = 'L';
  }
  return { name: line.name, qty: Math.round(qty * 100) / 100, unit };
}

export function formatQuantity(line: IngredientLine): string {
  return `${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(line.qty)} ${line.unit}`;
}

export function computeIngredients(
  menus: DailyMenu[],
  items: FoodItem[],
  recipes: Record<string, LinkedRecipe>,
  persons: PersonCounts,
  from: string,
  to: string
): IngredientReport {
  const itemById = new Map(items.map((i) => [i.id, i]));
  const totals = new Map<string, IngredientLine>();
  const unlinked = new Map<string, number>();
  let countedDishes = 0;
  let daysWithMenu = 0;

  const addDish = (id: string | null, headcount: number) => {
    if (!id) return;
    const item = itemById.get(id);
    if (!item) return;
    const recipe = item.recipeId ? recipes[item.recipeId] : undefined;
    if (!recipe) {
      unlinked.set(item.name, (unlinked.get(item.name) ?? 0) + 1);
      return;
    }
    countedDishes += 1;
    recipe.ings.forEach((ing) => {
      const key = `${ing.name.trim().toLocaleLowerCase('tr-TR')}|${ing.unit}`;
      const entry = totals.get(key) ?? { name: ing.name.trim(), qty: 0, unit: ing.unit };
      entry.qty += ing.amt * headcount;
      totals.set(key, entry);
    });
  };

  menus
    .filter((menu) => menu.date >= from && menu.date <= to)
    .forEach((menu) => {
      daysWithMenu += 1;
      MEAL_COURSE_FIELDS.forEach((field) => {
        addDish(menu.lunch[field], persons.lunch);
        addDish(menu.dinner[field], persons.dinner);
      });
      addDish(menu.snack, persons.lunch); // Mutfaktakip varsayılanı: ara öğün öğle kişi sayısını kullanır
    });

  return {
    lines: Array.from(totals.values())
      .map(normalizeQuantity)
      .sort((a, b) => a.name.localeCompare(b.name, 'tr')),
    unlinked: Array.from(unlinked.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'tr')),
    countedDishes,
    daysWithMenu,
  };
}

/** Panoya / paylaşıma uygun düz metin. */
export function ingredientsToText(title: string, report: IngredientReport): string {
  const rows = report.lines.map((line) => `• ${line.name}: ${formatQuantity(line)}`);
  const missing = report.unlinked.length
    ? `\n\nReçetesi bağlı olmayan yemekler (hesaba katılmadı):\n${report.unlinked.map((u) => `- ${u.name} (${u.count}×)`).join('\n')}`
    : '';
  return `${title}\n\n${rows.join('\n')}${missing}`;
}
