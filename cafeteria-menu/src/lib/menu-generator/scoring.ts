// lib/menu-generator/scoring.ts
//
// YUMUŞAK KISITLAR (skorlama). Sert kuralları geçmiş adaylar arasından
// "en iyi görüneni" öne çıkarır. Buradaki hiçbir şey kural çiğnetmez;
// sadece çeşitliliği, dengeyi ve tekrar hissini iyileştirir.
import {
  currentMeal,
  dayDishes,
  mealDishes,
  norm,
  otherMealDishes,
  previousDays,
  proteinsOf,
  type RuleContext,
} from './rules';
import { MEAL_SLOTS, type Dish } from './types';

export function scoreCandidate(
  dish: Dish,
  ctx: RuleContext,
  usage: ReadonlyMap<string, number>,
  rng: () => number,
): number {
  const cfg = ctx.config;
  const w = cfg.weights;
  let score = 0;

  // 1) Ay içinde dengeli dağılım: az kullanılan yemek öne geçer.
  score -= w.usage * (usage.get(dish.id) ?? 0);

  // 2) Yumuşak bekleme: yakın zamanda geldiyse ne kadar yakınsa o kadar ceza.
  const window = cfg.softCooldownDays[dish.category] ?? 0;
  if (window > 0) {
    const prev = previousDays(ctx, window); // eskiden yeniye
    for (let daysAgo = 1; daysAgo <= prev.length; daysAgo++) {
      const day = prev[prev.length - daysAgo];
      if (dayDishes(day).some((d) => d.id === dish.id)) {
        score -= w.softRecency * (window - daysAgo + 1);
        break;
      }
    }
  }

  // 3) Dünle aynı "tip" ana yemek (ör. iki gün üst üste hamur işi) istenmez.
  if (dish.category === 'ana_yemek') {
    const yesterday = ctx.timeline[ctx.dayIndex - 1];
    if (yesterday) {
      const yTags = new Set(
        MEAL_SLOTS.flatMap((s) => yesterday.meals[s].ana_yemek?.tags ?? []),
      );
      const shared = dish.tags.filter((t) => t !== cfg.practicalTag && yTags.has(t)).length;
      score -= w.yesterdayTagRepeat * shared;
    }
  }

  // 4) Öğle ve akşam aynı baskın bileşeni paylaşmasın (ör. iki öğünde de mercimek).
  const otherIngredients = new Set(
    otherMealDishes(ctx).flatMap((d) => d.mainIngredients ?? []).map(norm),
  );
  const overlap = (dish.mainIngredients ?? []).map(norm).filter((i) => otherIngredients.has(i)).length;
  score -= w.sameDayIngredientOverlap * overlap;

  // 5) Aynı öğünde iki yemek aynı proteini taşımasın (tavuk çorbası + tavuk sote).
  const mealProteins = proteinsOf(mealDishes(currentMeal(ctx)), cfg);
  const dup = dish.tags.filter((t) => mealProteins.has(t)).length;
  score -= w.sameMealProteinDup * dup;

  // 6) Tercih puanı + çeşitlilik için gürültü.
  score += w.popularity * (dish.popularity ?? 0);
  score += rng() * w.randomness;

  return score;
}

/** Adayları skora göre iyiden kötüye sıralar. */
export function rankCandidates(
  candidates: readonly Dish[],
  ctx: RuleContext,
  usage: ReadonlyMap<string, number>,
  rng: () => number,
): Dish[] {
  return candidates
    .map((dish) => ({ dish, score: scoreCandidate(dish, ctx, usage, rng) }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.dish);
}
