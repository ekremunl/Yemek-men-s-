// lib/menu-generator/generator.ts
//
// Yaklaşım: KISIT TABANLI ARAMA (constraint-based search)
//   • Ay, sıralı "karar"lara bölünür: her gün → her öğün → her kategori.
//   • Her karar için havuz SERT KURALLARLA süzülür (filtering).
//   • Kalan adaylar SKORLA sıralanır (en iyi aday önce denenir).
//   • Aday tükenirse bir önceki karara dönülür (chronological backtracking).
//   • Takılırsa farklı rastgele sıralamayla yeniden başlanır (random restart).
import { resolveConfig, type GeneratorConfig, type GeneratorOptions } from './config';
import { RULES, findViolation, type RuleContext, type RuleId } from './rules';
import { rankCandidates } from './scoring';
import {
  CATEGORY_ORDER,
  MEAL_SLOTS,
  type DayMenu,
  type Dish,
  type DishCategory,
  type MealSlot,
  type MonthlyMenu,
} from './types';

// ---------------------------------------------------------------------------
// Hata tipleri
// ---------------------------------------------------------------------------

export interface FailureDiagnostics {
  date: string;
  slot: MealSlot;
  category: DishCategory;
  /** İlk çiğnenen kurala göre elenen aday sayıları. */
  rejectedBy: Partial<Record<RuleId, number>>;
}

export class MenuGenerationError extends Error {
  constructor(
    message: string,
    public readonly diagnostics?: FailureDiagnostics,
  ) {
    super(message);
    this.name = 'MenuGenerationError';
  }
}

// ---------------------------------------------------------------------------
// Küçük yardımcılar
// ---------------------------------------------------------------------------

/** Tekrarlanabilir rastgele sayı üreteci. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** month: 1-12. Saat dilimi kaymasın diye UTC kullanılır. */
const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

function createDay(year: number, month: number, day: number): DayMenu {
  return {
    date: `${year}-${pad(month)}-${pad(day)}`,
    weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
    meals: { ogle: {}, aksam: {} },
  };
}

const cloneDay = (d: DayMenu): DayMenu => ({
  ...d,
  meals: { ogle: { ...d.meals.ogle }, aksam: { ...d.meals.aksam } },
});

const SLOT_LABEL: Record<MealSlot, string> = { ogle: 'öğle', aksam: 'akşam' };

interface Decision {
  dayOffset: number; // bu ayın kaçıncı günü (0 tabanlı)
  slot: MealSlot;
  category: DishCategory;
  /** true → aday aranmaz; öğle öğünündeki yemek aynen kopyalanır (hafta sonu senkronu). */
  syncFromLunch?: boolean;
}

// ---------------------------------------------------------------------------
// Ön kontroller (imkânsız durumları aramaya girmeden yakala)
// ---------------------------------------------------------------------------

function groupByCategory(pool: readonly Dish[]): Record<DishCategory, Dish[]> {
  const out: Record<DishCategory, Dish[]> = { çorba: [], ana_yemek: [], yan_urun: [], tatli_meyve: [] };
  const ids = new Set<string>();
  for (const dish of pool) {
    if (ids.has(dish.id)) throw new MenuGenerationError(`Havuzda tekrar eden yemek id'si var: "${dish.id}".`);
    ids.add(dish.id);
    if (!(dish.category in out)) {
      throw new MenuGenerationError(`"${dish.name}" için geçersiz kategori: "${dish.category}".`);
    }
    out[dish.category].push(dish);
  }
  return out;
}

function preflight(config: GeneratorConfig, byCategory: Record<DishCategory, Dish[]>) {
  const warnings: string[] = [];

  // Havuzda hiç yemeği olmayan isteğe bağlı kategoriler şablondan düşer; ana yemek zorunlu.
  const template = {} as Record<MealSlot, DishCategory[]>;
  for (const slot of MEAL_SLOTS) {
    template[slot] = config.mealTemplate[slot].filter((cat) => {
      if (byCategory[cat].length > 0) return true;
      if (cat === 'ana_yemek') {
        throw new MenuGenerationError('Havuzda hiç ana yemek yok.');
      }
      warnings.push(`Havuzda "${cat}" kategorisinde yemek yok; ${SLOT_LABEL[slot]} öğününden çıkarıldı.`);
      return false;
    });
  }

  // Bekleme kuralı sayısal alt sınırı: cooldown+1 ardışık günde tüm ana yemekler birbirinden farklı olmalı.
  const mainSlotsPerDay = MEAL_SLOTS.filter((s) => template[s].includes('ana_yemek')).length;
  const mainsNeeded = mainSlotsPerDay * (config.mainCooldownDays + 1);
  const mains = byCategory.ana_yemek;
  if (mains.length < mainsNeeded) {
    throw new MenuGenerationError(
      `Ana yemek havuzu yetersiz: ${config.mainCooldownDays} günlük bekleme kuralı için en az ` +
        `${mainsNeeded} farklı ana yemek gerekir, havuzda ${mains.length} var.`,
    );
  }

  // Hafta sonu öğle kuralı: Cumartesi ve Pazar farklı 'pratik' ana yemek ister.
  if (template.ogle.includes('ana_yemek') && config.weekendLunchPracticalCategories.includes('ana_yemek')) {
    const practical = mains.filter((m) => m.tags.includes(config.practicalTag)).length;
    if (practical < 2) {
      throw new MenuGenerationError(
        `Hafta sonu öğle kuralı için en az 2 '${config.practicalTag}' ana yemek gerekir, havuzda ${practical} var.`,
      );
    }
    if (practical < 4) {
      warnings.push(`Az sayıda '${config.practicalTag}' ana yemek (${practical}); hafta sonları sık tekrar edebilir.`);
    }
  }

  return { template, warnings };
}

function buildDecisions(
  year: number,
  month: number,
  dayCount: number,
  template: Record<MealSlot, DishCategory[]>,
  config: GeneratorConfig,
): Decision[] {
  const decisions: Decision[] = [];
  for (let dayOffset = 0; dayOffset < dayCount; dayOffset++) {
    const weekday = new Date(Date.UTC(year, month - 1, dayOffset + 1)).getUTCDay();
    const weekend = weekday === 0 || weekday === 6;

    for (const slot of MEAL_SLOTS) {
      const categories = CATEGORY_ORDER.filter((c) => template[slot].includes(c));

      // Hafta sonu akşamında senkron kategoriler ÖNCE (zorunlu karar olarak) yerleşir;
      // böylece ana yemek adayları bu yemeklere göre süzülür.
      const synced =
        weekend && slot === 'aksam'
          ? categories.filter(
              (c) => config.weekendSyncCategories.includes(c) && template.ogle.includes(c),
            )
          : [];

      for (const category of synced) decisions.push({ dayOffset, slot, category, syncFromLunch: true });
      for (const category of categories) {
        if (!synced.includes(category)) decisions.push({ dayOffset, slot, category });
      }
    }
  }
  return decisions;
}

function filterCandidates(pool: readonly Dish[], ctx: RuleContext) {
  const allowed: Dish[] = [];
  const rejectedBy: Partial<Record<RuleId, number>> = {};
  for (const dish of pool) {
    const violated = findViolation(dish, ctx);
    if (violated) rejectedBy[violated.id] = (rejectedBy[violated.id] ?? 0) + 1;
    else allowed.push(dish);
  }
  return { allowed, rejectedBy };
}

// ---------------------------------------------------------------------------
// Ana fonksiyon
// ---------------------------------------------------------------------------

/**
 * Bir ayın öğle + akşam menüsünü, tüm sert kuralları sağlayacak şekilde üretir.
 *
 * @param dishPool Yemek havuzu
 * @param month    1-12 (1 = Ocak). NOT: JS Date'in 0 tabanlı ay değeri DEĞİL.
 * @param year     Örn. 2026
 * @param options  Kural/ağırlık/seed ayarları (hepsi isteğe bağlı)
 * @throws MenuGenerationError Kısıtlar bu havuzla sağlanamıyorsa (diagnostics ile nedenini söyler)
 */
export function generateMonthlyMenu(
  dishPool: readonly Dish[],
  month: number,
  year: number,
  options: GeneratorOptions = {},
): MonthlyMenu {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError(`month 1-12 arasında olmalı (1 = Ocak), gelen: ${month}`);
  }
  if (!Number.isInteger(year)) throw new RangeError(`Geçersiz yıl: ${year}`);

  const config = resolveConfig(options);
  const byCategory = groupByCategory(dishPool);
  const { template, warnings } = preflight(config, byCategory);

  const dayCount = daysInMonth(year, month);
  const decisions = buildDecisions(year, month, dayCount, template, config);
  const offset = config.previousDays.length;

  let deepest: { index: number; diagnostics: FailureDiagnostics } | undefined;

  for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
    const timeline: DayMenu[] = [
      ...config.previousDays.map(cloneDay),
      ...Array.from({ length: dayCount }, (_, i) => createDay(year, month, i + 1)),
    ];
    const rng = mulberry32(config.seed + attempt * 104_729);
    const usage = new Map<string, number>();
    let backtracks = 0;
    let aborted = false;

    const solve = (i: number): boolean => {
      if (i === decisions.length) return true;

      const d = decisions[i];
      const { dayOffset, slot, category } = d;
      const dayIndex = offset + dayOffset;
      const ctx: RuleContext = { config, timeline, dayIndex, slot, category };
      const day = timeline[dayIndex];

      // Hafta sonu senkronu: aday yok, öğledeki yemek kopyalanır ve yine kurallara sokulur.
      if (d.syncFromLunch) {
        const forced = day.meals.ogle[category];
        if (!forced) return solve(i + 1);
        const violated = findViolation(forced, ctx);
        if (violated) {
          if (!deepest || i > deepest.index) {
            deepest = {
              index: i,
              diagnostics: { date: day.date, slot, category, rejectedBy: { [violated.id]: 1 } },
            };
          }
          return false;
        }
        day.meals[slot][category] = forced;
        usage.set(forced.id, (usage.get(forced.id) ?? 0) + 1);
        if (solve(i + 1)) return true;
        delete day.meals[slot][category];
        usage.set(forced.id, (usage.get(forced.id) ?? 1) - 1);
        return false;
      }

      const { allowed, rejectedBy } = filterCandidates(byCategory[category], ctx);
      if (allowed.length === 0) {
        if (!deepest || i > deepest.index) {
          deepest = {
            index: i,
            diagnostics: { date: timeline[dayIndex].date, slot, category, rejectedBy },
          };
        }
        return false;
      }

      const meal = timeline[dayIndex].meals[slot];
      for (const dish of rankCandidates(allowed, ctx, usage, rng)) {
        meal[category] = dish;
        usage.set(dish.id, (usage.get(dish.id) ?? 0) + 1);

        if (solve(i + 1)) return true;

        delete meal[category];
        usage.set(dish.id, (usage.get(dish.id) ?? 1) - 1);

        if (++backtracks > config.maxBacktracksPerAttempt) aborted = true;
        if (aborted) return false;
      }
      return false;
    };

    if (solve(0)) {
      return {
        year,
        month,
        seed: config.seed,
        attempts: attempt + 1,
        days: timeline.slice(offset),
        warnings,
      };
    }
  }

  const d = deepest?.diagnostics;
  const reasons = d
    ? Object.entries(d.rejectedBy)
        .map(([rule, n]) => `${rule}: ${n}`)
        .join(', ')
    : '';
  throw new MenuGenerationError(
    d
      ? `Menü oluşturulamadı. En ilerideki tıkanma: ${d.date} ${SLOT_LABEL[d.slot]} (${d.category}). ` +
          `Elenme nedenleri → ${reasons || 'havuz boş'}. Havuzu genişletmeyi veya kuralları gevşetmeyi deneyin.`
      : 'Menü oluşturulamadı.',
    d,
  );
}

// ---------------------------------------------------------------------------
// Hazır bir menüyü doğrulama (elle düzenlenen menüler için de kullanışlı)
// ---------------------------------------------------------------------------

export interface RuleViolation {
  date: string;
  slot: MealSlot;
  category: DishCategory;
  dishId: string;
  dishName: string;
  ruleId: RuleId;
  description: string;
}

/**
 * Menüyü kronolojik sırayla yeniden oynatır ve her yemeği çözücüdeki aynı
 * kurallarla kontrol eder. Boş dizi = menü tüm sert kurallara uyuyor.
 * (Önceki ayın son günleri için options.previousDays verin.)
 */
export function validateMonthlyMenu(
  menu: Pick<MonthlyMenu, 'days'>,
  options: GeneratorOptions = {},
): RuleViolation[] {
  const config = resolveConfig(options);
  const timeline: DayMenu[] = config.previousDays.map(cloneDay);
  const violations: RuleViolation[] = [];

  for (const day of menu.days) {
    timeline.push({ date: day.date, weekday: day.weekday, meals: { ogle: {}, aksam: {} } });
    const dayIndex = timeline.length - 1;

    for (const slot of MEAL_SLOTS) {
      for (const category of CATEGORY_ORDER) {
        const dish = day.meals[slot][category];
        if (!dish) continue;
        const rule = findViolation(dish, { config, timeline, dayIndex, slot, category });
        if (rule) {
          violations.push({
            date: day.date,
            slot,
            category,
            dishId: dish.id,
            dishName: dish.name,
            ruleId: rule.id,
            description: rule.description,
          });
        }
        timeline[dayIndex].meals[slot][category] = dish;
      }
    }
  }
  return violations;
}

export { RULES };
