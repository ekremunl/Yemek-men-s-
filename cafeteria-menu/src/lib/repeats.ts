// src/lib/repeats.ts
// Bir ayın menüsünde hangi yemeklerin kaç kez tekrar ettiğini ve havuzun yeterli olup olmadığını özetler.
import type { CategoryKey, DailyMenu, FoodItem } from '@/types';
import { MAIN_MEAL_KEYS, MEAL_COURSE_FIELDS } from '@/lib/menu';

export interface DishRepeat {
  id: string;
  name: string;
  category: CategoryKey;
  count: number;
}

export interface CategoryRepeat {
  key: CategoryKey;
  poolSize: number;
  /** Ay boyunca bu kategoriden doldurulan yer sayısı. */
  slots: number;
  /** Havuzdaki her yemek ortalama kaç kez çıkıyor. */
  average: number;
  /** Ayda en fazla `target` kez çıksın istenirse havuzda en az kaç çeşit gerekir. */
  neededForTarget: number;
}

export interface NameGroup {
  stem: string;
  /** Gösterilecek okunur ad (köke uyan en kısa sözcük, ör. "domates"). */
  label: string;
  total: number;
  dishes: { name: string; count: number }[];
}

export interface RepeatReport {
  dishes: DishRepeat[];
  categories: CategoryRepeat[];
  groups: NameGroup[];
  target: number;
}

const CATEGORY_OF_FIELD: Record<(typeof MEAL_COURSE_FIELDS)[number], CategoryKey> = {
  soup: 'soups',
  mainCourse: 'mainCourses',
  sideDish: 'sideDishes',
  complement: 'complements',
};

/** Ad benzerliği için yok sayılan, yemek türünü belirten genel sözcükler. */
const GENERIC_WORDS = new Set([
  'çorbası', 'çorba', 'yemeği', 'salatası', 'salata', 'pilavı', 'pilav', 'kızartması', 'tatlısı', 'helvası',
  'böreği', 'meyvesi', 'mevsim', 'sade', 'şehriyeli', 'makarna', 'köftesi', 'güveç', 'sosu', 'tarator',
]);

const lower = (text: string) => text.toLocaleLowerCase('tr-TR');

/** Ad içindeki anlamlı sözcüklerin ilk 5 harfi (ör. "Ispanak Yemeği" ve "Ispanaklı Börek" → "ıspan"). */
export function nameStems(name: string): string[] {
  return Array.from(
    new Set(
      lower(name)
        .split(/[^a-zçğıöşüâîû]+/)
        .filter((w) => w.length >= 5 && !GENERIC_WORDS.has(w))
        .map((w) => w.slice(0, 5)),
    ),
  );
}

function shortestWordWithStem(names: string[], stem: string): string {
  const words = names
    .flatMap((n) => lower(n).split(/[^a-zçğıöşüâîû]+/))
    .filter((w) => w.startsWith(stem) && !GENERIC_WORDS.has(w));
  const best = words.sort((a, b) => a.length - b.length)[0] ?? stem;
  return best.charAt(0).toLocaleUpperCase('tr-TR') + best.slice(1);
}

export function analyzeRepeats(
  menus: DailyMenu[],
  items: FoodItem[],
  year: number,
  month: number, // 0 tabanlı
  target = 3
): RepeatReport {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const itemById = new Map(items.map((i) => [i.id, i]));
  const counts = new Map<string, number>();
  const filledSlots: Record<CategoryKey, number> = { soups: 0, mainCourses: 0, sideDishes: 0, complements: 0, snacks: 0 };

  menus
    .filter((m) => m.date.startsWith(prefix))
    .forEach((menu) => {
      MAIN_MEAL_KEYS.forEach((mealKey) =>
        MEAL_COURSE_FIELDS.forEach((field) => {
          const id = menu[mealKey][field];
          if (!id) return;
          counts.set(id, (counts.get(id) ?? 0) + 1);
          filledSlots[CATEGORY_OF_FIELD[field]] += 1;
        })
      );
      if (menu.snack) {
        counts.set(menu.snack, (counts.get(menu.snack) ?? 0) + 1);
        filledSlots.snacks += 1;
      }
    });

  const dishes: DishRepeat[] = Array.from(counts.entries())
    .map(([id, count]) => ({ id, count, item: itemById.get(id) }))
    .filter((x): x is { id: string; count: number; item: FoodItem } => Boolean(x.item))
    .map((x) => ({ id: x.id, name: x.item.name, category: x.item.category, count: x.count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'tr'));

  const dayCount = new Date(year, month + 1, 0).getDate();
  const categories: CategoryRepeat[] = (['soups', 'mainCourses', 'sideDishes', 'complements', 'snacks'] as CategoryKey[]).map((key) => {
    const poolSize = items.filter((i) => i.category === key).length;
    const slots = key === 'snacks' ? dayCount : dayCount * 2; // planlanmış değil, ay boyunca dolması gereken yer
    return {
      key,
      poolSize,
      slots,
      average: poolSize ? Math.round((slots / poolSize) * 10) / 10 : 0,
      neededForTarget: Math.ceil(slots / target),
    };
  });

  // Ad benzerliğine göre ortak sözcük grupları (ör. ıspanaklı yemekler toplamda kaç kez çıktı).
  const byStem = new Map<string, Map<string, number>>();
  dishes.forEach((d) => {
    nameStems(d.name).forEach((stem) => {
      const group = byStem.get(stem) ?? new Map<string, number>();
      group.set(d.name, (group.get(d.name) ?? 0) + d.count);
      byStem.set(stem, group);
    });
  });
  const groups: NameGroup[] = Array.from(byStem.entries())
    .map(([stem, group]) => ({
      stem,
      label: shortestWordWithStem(Array.from(group.keys()), stem),
      total: Array.from(group.values()).reduce((a, b) => a + b, 0),
      dishes: Array.from(group.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    }))
    .filter((g) => g.dishes.length >= 2 && g.total >= 4)
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  return { dishes, categories, groups, target };
}
