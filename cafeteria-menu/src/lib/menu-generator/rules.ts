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
  /** Bu ayki kullanım sayıları (yemek kimliği → adet). Yoksa aylık sınır denetlenmez. */
  usage?: ReadonlyMap<string, number>;
  /** Kategori başına aylık azami kullanım (config.monthlyCapSlack açıksa hesaplanır). */
  monthlyCap?: Partial<Record<DishCategory, number>>;
}

export type RuleId =
  | 'INTRA_INCOMPATIBLE_TAGS'
  | 'INTRA_CARB_MAIN_WITH_RICE_PASTA'
  | 'INTRA_DOMINANT_INGREDIENT'
  | 'SERVING_TIME'
  | 'WEEKDAY_BAN'
  | 'COMPANION_REQUIRED'
  | 'DAY_DUPLICATE_ITEM'
  | 'DAY_PROTEIN_REPEAT'
  | 'DAY_LEGUME_THEN_LIGHT'
  | 'WEEKEND_LUNCH_PRACTICAL'
  | 'COOLDOWN_MAIN_DISH'
  | 'COOLDOWN_CATEGORY'
  | 'MONTHLY_CAP'
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

/** Bugünden sonraki n gün (sabit/kilitli günler için ileriye dönük kontrol). */
export const nextDays = (ctx: RuleContext, n: number): DayMenu[] =>
  ctx.timeline.slice(ctx.dayIndex + 1, ctx.dayIndex + 1 + n);

export const dayDishes = (day: DayMenu): Dish[] =>
  MEAL_SLOTS.flatMap((s) => mealDishes(day.meals[s]));

export const dayHasTag = (day: DayMenu, tag: Tag): boolean =>
  dayDishes(day).some((d) => d.tags.includes(tag));

export const isWeekend = (day: DayMenu): boolean => day.weekday === 0 || day.weekday === 6;

/**
 * Servis zamanı etiketlerine göre yemek bu öğün + gün türünde yer alabilir mi?
 * (Etiketsiz yemek her zaman uygundur.)
 */
export function servingAllows(dish: Dish, slot: MealSlot, weekend: boolean, cfg: GeneratorConfig): boolean {
  const t = cfg.servingTags;
  const mealTags = [t.ogle, t.aksam].filter((tag) => dish.tags.includes(tag));
  if (mealTags.length > 0 && !mealTags.includes(t[slot])) return false;
  const dayTags = [t.weekend, t.weekday].filter((tag) => dish.tags.includes(tag));
  if (dayTags.length > 0 && !dayTags.includes(weekend ? t.weekend : t.weekday)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Kurallar
// ---------------------------------------------------------------------------

export const RULES: readonly Rule[] = [
  // 1) AYNI ÖĞÜN İÇİ ---------------------------------------------------------
  {
    id: 'INTRA_INCOMPATIBLE_TAGS',
    description: 'Aynı öğündeki başka bir yemekle uyumsuz (ör. hamur işi ana yemekle pilav/makarna, ya da uyumsuz etiketli yemekler).',
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
  {
    id: 'SERVING_TIME',
    description:
      'Öğle / akşam / hafta sonu / hafta içi etiketi olan yemek yalnızca etiketli öğünde ve gün türünde yer alabilir.',
    allows(dish, ctx) {
      const cfg = ctx.config;
      const weekend = isWeekend(currentDay(ctx));
      if (!servingAllows(dish, ctx.slot, weekend, cfg)) return false;
      // Hafta sonu öğlesindeki senkron kategoriler akşama da kopyalanır; akşamda da servis edilebilmeli.
      if (ctx.slot === 'ogle' && weekend && cfg.weekendSyncCategories.includes(dish.category)) {
        return servingAllows(dish, 'aksam', true, cfg);
      }
      return true;
    },
  },
  {
    id: 'WEEKDAY_BAN',
    description: "Bu günün yasak listesindeki bir etiketi taşıyor (Ayarlar → Menü Kuralları → Gün yasakları; ör. Pazartesi günleri tavuk yok).",
    allows(dish, ctx) {
      const banned = ctx.config.weekdayBans[currentDay(ctx).weekday] ?? [];
      return !dish.tags.some((t) => banned.includes(t));
    },
  },
  {
    id: 'COMPANION_REQUIRED',
    description:
      'Ana yemeğin ilgili kategoride eşlikçisi tanımlıysa, aynı öğündeki çorba / yan yemek / tamamlayıcı bu eşlikçilerden biri olmalıdır.',
    allows(dish, ctx) {
      const cfg = ctx.config;
      if (!cfg.requireCompanions) return true;
      const day = currentDay(ctx);
      // Hafta sonu akşamında senkron kategoriler öğleden kopyalanır; eşlikçi şartından muaftır.
      const syncedHere = (category: DishCategory) =>
        ctx.slot === 'aksam' && isWeekend(day) && cfg.weekendSyncCategories.includes(category);
      const meal = currentMeal(ctx);

      if (dish.category === 'ana_yemek') {
        // Aday ana yemek, öğüne daha önce yerleşmiş (ör. senkron) yemekleri de eşlikçi olarak kabul etmeli.
        return mealDishes(meal).every((other) => {
          if (other.category === 'ana_yemek' || syncedHere(other.category)) return true;
          const list = dish.companionsByCategory?.[other.category];
          return !list?.length || list.includes(other.id);
        });
      }

      if (syncedHere(dish.category)) return true;
      const list = meal.ana_yemek?.companionsByCategory?.[dish.category];
      return !list?.length || list.includes(dish.id);
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
    description: 'Ana yemek, kullanıldıktan sonra kendi tekrar aralığı (yoksa genel bekleme süresi) dolmadan tekrar edemez.',
    allows(dish, ctx) {
      if (dish.category !== 'ana_yemek') return true;
      const { dishCooldownScale: scale, mainCooldownDays } = ctx.config;
      // Yemeğe özel aralık varsa o, yoksa genel süre.
      const n = dish.cooldownDays !== undefined && scale > 0 ? Math.floor(dish.cooldownDays * scale) : mainCooldownDays;
      const window = [...previousDays(ctx, n), currentDay(ctx), ...nextDays(ctx, n)];
      return !window.some((day) => MEAL_SLOTS.some((s) => day.meals[s].ana_yemek?.id === dish.id));
    },
  },
  {
    id: 'COOLDOWN_CATEGORY',
    description: 'Çorba, yan yemek ve tamamlayıcı da kısa süre içinde tekrar edemez (Ayarlar → Menü Kuralları → Yan ürün bekleme süresi).',
    allows(dish, ctx) {
      if (dish.category === 'ana_yemek') return true; // ana yemek kendi kuralıyla yönetilir
      const n = ctx.config.categoryCooldownDays[dish.category] ?? 0;
      if (n <= 0) return true;
      // Aynı gün (öğle/akşam) ayrı kuralla (DAY_DUPLICATE_ITEM / hafta sonu senkronu) yönetilir.
      const window = [...previousDays(ctx, n), ...nextDays(ctx, n)];
      return !window.some((day) => MEAL_SLOTS.some((s) => day.meals[s][dish.category]?.id === dish.id));
    },
  },
  {
    id: 'MONTHLY_CAP',
    description: 'Bu yemek bu ay zaten adil payından fazla kullanıldı (Ayarlar → Menü Kuralları → Adil dağıtım).',
    allows(dish, ctx) {
      const cap = ctx.monthlyCap?.[dish.category];
      if (cap === undefined || !ctx.usage) return true;
      return (ctx.usage.get(dish.id) ?? 0) < cap;
    },
  },
  {
    id: 'COOLDOWN_PROTEIN_STREAK',
    description: 'Aynı protein türü en fazla maxConsecutiveProteinDays gün üst üste seçilebilir.',
    allows(dish, ctx) {
      const { proteinTags, maxConsecutiveProteinDays: max } = ctx.config;
      // (max + 1) günlük her pencerede, bugün dahil hepsi aynı proteini taşıyorsa ihlaldir.
      // Normal üretimde gelecek günler boştur; yalnızca kilitli günler ileriye dönük etki eder.
      return !dish.tags.some((t) => {
        if (!proteinTags.includes(t)) return false;
        for (let before = 0; before <= max; before++) {
          const start = ctx.dayIndex - before;
          const end = start + max; // dahil
          if (start < 0 || end >= ctx.timeline.length) continue;
          const others = ctx.timeline.slice(start, end + 1).filter((_, k) => start + k !== ctx.dayIndex);
          if (others.every((day) => dayHasTag(day, t))) return true;
        }
        return false;
      });
    },
  },
];

/** İlk çiğnenen kuralı döner; hiçbiri çiğnenmiyorsa undefined. */
export function findViolation(dish: Dish, ctx: RuleContext): Rule | undefined {
  return RULES.find((rule) => !rule.allows(dish, ctx));
}
