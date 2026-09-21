// lib/menu-generator/rules.ts
//
// SERT KISITLAR (hard constraints). Bir aday yemek bunlardan birini bile
// çiğnerse o konuma asla yerleştirilmez. Her kural "bu aday, şu ana kadar
// yerleşen menüyle çelişiyor mu?" sorusuna cevap verir; bu yüzden hem
// çözücüde (filtering) hem de hazır bir menünün doğrulanmasında (replay)
// aynen kullanılır.
import type { GeneratorConfig } from './config';
import {
  MEAL_SLOTS,
  type DayMenu,
  type Dish,
  type DishCategory,
  type Meal,
  type MealSlot,
  type Tag,
} from './types';

export interface RuleContext {
  config: GeneratorConfig;
  /** [önceki ayın günleri..., bu ayın günleri...] */
  timeline: DayMenu[];
  /** Yerleştirilen yemeğin günü (timeline indeksi). */
  dayIndex: number;
  slot: MealSlot;
  category: DishCategory;
}

export type RuleId =
  | 'INTRA_INCOMPATIBLE_TAGS'
  | 'INTRA_CARB_MAIN_WITH_RICE_PASTA'
  | 'INTRA_DOMINANT_INGREDIENT'
  | 'DAY_DUPLICATE_ITEM'
  | 'DAY_PROTEIN_REPEAT'
  | 'DAY_LEGUME_THEN_LIGHT'
  | 'WEEKEND_LUNCH_PRACTICAL'
  | 'COOLDOWN_MAIN_DISH'
  | 'COOLDOWN_PROTEIN_STREAK';

export interface Rule {
  id: RuleId;
  description: string;
  /** true → aday bu kural açısından uygun. */
  allows(dish: Dish, ctx: RuleContext): boolean;
}

// ---------------------------------------------------------------------------
// Yardımcılar
// ---------------------------------------------------------------------------

export const norm = (s: string): string => s.trim().toLocaleLowerCase('tr-TR');

export const mealDishes = (meal: Meal): Dish[] =>
  Object.values(meal).filter((d): d is Dish => Boolean(d));

export const hasAnyTag = (dish: Dish, tags: readonly Tag[]): boolean =>
  dish.tags.some((t) => tags.includes(t));

export const proteinsOf = (dishes: readonly Dish[], cfg: GeneratorConfig): Set<Tag> =>
  new Set(dishes.flatMap((d) => d.tags).filter((t) => cfg.proteinTags.includes(t)));

export const currentDay = (ctx: RuleContext): DayMenu => ctx.timeline[ctx.dayIndex];
export const currentMeal = (ctx: RuleContext): Meal => currentDay(ctx).meals[ctx.slot];

/** Aynı günün DİĞER öğünlerindeki yemekler. */
export const otherMealDishes = (ctx: RuleContext): Dish[] =>
  MEAL_SLOTS.filter((s) => s !== ctx.slot).flatMap((s) => mealDishes(currentDay(ctx).meals[s]));

/** Bugünden önceki son n gün (eskiden yeniye). */
export const previousDays = (ctx: RuleContext, n: number): DayMenu[] =>
  ctx.timeline.slice(Math.max(0, ctx.dayIndex - n), ctx.dayIndex);

export const dayDishes = (day: DayMenu): Dish[] =>
  MEAL_SLOTS.flatMap((s) => mealDishes(day.meals[s]));

export const dayHasTag = (day: DayMenu, tag: Tag): boolean =>
  dayDishes(day).some((d) => d.tags.includes(tag));

export const isWeekend = (day: DayMenu): boolean => day.weekday === 0 || day.weekday === 6;

// ---------------------------------------------------------------------------
// Kurallar
// ---------------------------------------------------------------------------

export const RULES: readonly Rule[] = [
  // 1) AYNI ÖĞÜN İÇİ ---------------------------------------------------------
  {
    id: 'INTRA_INCOMPATIBLE_TAGS',
    description: 'Yemeğin incompatibleWithTags listesindeki bir etiketi taşıyan yemekle aynı öğünde olamaz (iki yönlü).',
    allows(dish, ctx) {
      return mealDishes(currentMeal(ctx)).every(
        (other) =>
          !dish.incompatibleWithTags?.some((t) => other.tags.includes(t)) &&
          !other.incompatibleWithTags?.some((t) => dish.tags.includes(t)),
      );
    },
  },
  {
    id: 'INTRA_CARB_MAIN_WITH_RICE_PASTA',
    description: "Ana yemek 'hamur_isi'/'karbonhidrat_agirlikli' ise yanında 'pilav_makarna' olamaz.",
    allows(dish, ctx) {
      const cfg = ctx.config;
      const isCarbMain = (d: Dish) => d.category === 'ana_yemek' && hasAnyTag(d, cfg.carbHeavyTags);
      const isRiceOrPasta = (d: Dish) => hasAnyTag(d, cfg.riceOrPastaTags);
      return mealDishes(currentMeal(ctx)).every(
        (other) =>
          !(isCarbMain(dish) && isRiceOrPasta(other)) && !(isCarbMain(other) && isRiceOrPasta(dish)),
      );
    },
  },
  {
    id: 'INTRA_DOMINANT_INGREDIENT',
    description: 'Aynı öğündeki yemeklerin baskın bileşenleri (mainIngredients) kesişemez.',
    allows(dish, ctx) {
      const mine = new Set((dish.mainIngredients ?? []).map(norm));
      if (mine.size === 0) return true;
      return mealDishes(currentMeal(ctx)).every(
        (other) => !(other.mainIngredients ?? []).some((i) => mine.has(norm(i))),
      );
    },
  },

  // 2) AYNI GÜN İÇİ ----------------------------------------------------------
  {
    id: 'DAY_DUPLICATE_ITEM',
    description: 'Aynı yemek aynı günün iki öğününde birden yer alamaz (hafta sonu senkron kategorileri hariç).',
    allows(dish, ctx) {
      const synced =
        isWeekend(currentDay(ctx)) && ctx.config.weekendSyncCategories.includes(dish.category);
      if (synced) return true;
      return !otherMealDishes(ctx).some((d) => d.id === dish.id);
    },
  },
  {
    id: 'DAY_PROTEIN_REPEAT',
    description: 'Aynı günün öbür öğününde kullanılan protein grubu (tavuk/kırmızı et/...) tekrar edemez.',
    allows(dish, ctx) {
      // Aynı yemeğin kendisi (hafta sonu senkronu) kendi proteinini "tekrar etmiş" sayılmaz.
      const used = proteinsOf(
        otherMealDishes(ctx).filter((d) => d.id !== dish.id),
        ctx.config,
      );
      return !dish.tags.some((t) => ctx.config.proteinTags.includes(t) && used.has(t));
    },
  },
  {
    id: 'DAY_LEGUME_THEN_LIGHT',
    description: 'Öğle yemeğinde bakliyat varsa akşam menüsü bakliyatsız olmalı ve ana yemek hafif/sebze ağırlıklı olmalı.',
    allows(dish, ctx) {
      if (ctx.slot !== 'aksam') return true;
      const cfg = ctx.config;
      const lunchHasLegume = mealDishes(currentDay(ctx).meals.ogle).some(
        (d) => cfg.legumeTriggerCategories.includes(d.category) && hasAnyTag(d, cfg.legumeTags),
      );
      if (!lunchHasLegume) return true;
      if (hasAnyTag(dish, cfg.legumeTags)) return false;
      if (dish.category === 'ana_yemek' && !hasAnyTag(dish, cfg.lightTags)) return false;
      return true;
    },
  },

  // 3) HAFTA SONU ------------------------------------------------------------
  {
    id: 'WEEKEND_LUNCH_PRACTICAL',
    description: "Cumartesi/Pazar öğle yemeğinde ana yemek 'pratik' etiketli olmalı.",
    allows(dish, ctx) {
      if (ctx.slot !== 'ogle' || !isWeekend(currentDay(ctx))) return true;
      if (!ctx.config.weekendLunchPracticalCategories.includes(dish.category)) return true;
      return dish.tags.includes(ctx.config.practicalTag);
    },
  },

  // 4) SIKLIK / TEKRAR -------------------------------------------------------
  {
    id: 'COOLDOWN_MAIN_DISH',
    description: 'Aynı ana yemek, kullanıldıktan sonra mainCooldownDays gün boyunca (ve aynı gün içinde) tekrar edemez.',
    allows(dish, ctx) {
      if (dish.category !== 'ana_yemek') return true;
      const window = [...previousDays(ctx, ctx.config.mainCooldownDays), currentDay(ctx)];
      return !window.some((day) => MEAL_SLOTS.some((s) => day.meals[s].ana_yemek?.id === dish.id));
    },
  },
  {
    id: 'COOLDOWN_PROTEIN_STREAK',
    description: 'Aynı protein türü en fazla maxConsecutiveProteinDays gün üst üste seçilebilir.',
    allows(dish, ctx) {
      const { proteinTags, maxConsecutiveProteinDays: max } = ctx.config;
      const prev = previousDays(ctx, max);
      if (prev.length < max) return true;
      return !dish.tags.some((t) => proteinTags.includes(t) && prev.every((day) => dayHasTag(day, t)));
    },
  },
];

/** İlk çiğnenen kuralı döner; hiçbiri çiğnenmiyorsa undefined. */
export function findViolation(dish: Dish, ctx: RuleContext): Rule | undefined {
  return RULES.find((rule) => !rule.allows(dish, ctx));
}
