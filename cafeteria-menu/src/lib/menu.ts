import {
  CategoryKey,
  DailyMenu,
  FoodItem,
  FourCourseMeal,
  MainMealKey,
  MealCourseField,
  PlannerMealKey,
  RuleSettings,
} from '@/types';
import { SEED_DATA } from './seedData';
import { createLocalDate, formatDate, formatShortDateTR } from './utils';
import { generateMonthlyMenu, MenuGenerationError, RULES, validateMonthlyMenu, findViolation } from './menu-generator';
import { resolveConfig } from './menu-generator/config';
import { rankCandidates } from './menu-generator/scoring';
import type {
  DayMenu,
  Dish,
  DishCategory,
  GeneratorOptions,
  Meal,
  MealSlot,
  RuleViolation,
} from './menu-generator';

export const MAIN_MEAL_KEYS: MainMealKey[] = ['lunch', 'dinner'];
export const PLANNER_MEAL_KEYS: PlannerMealKey[] = ['lunch', 'dinner', 'snack'];
export const MEAL_COURSE_FIELDS: MealCourseField[] = ['soup', 'mainCourse', 'sideDish', 'complement'];

export const MEAL_LABELS_TR: Record<PlannerMealKey, string> = {
  lunch: 'Öğle Yemeği',
  dinner: 'Akşam Yemeği',
  snack: 'Ara Öğün',
};

export const MEAL_SHORT_LABELS_TR: Record<PlannerMealKey, string> = {
  lunch: 'Öğle',
  dinner: 'Akşam',
  snack: 'Ara',
};

export const COURSE_LABELS_TR: Record<MealCourseField, string> = {
  soup: 'Çorba',
  mainCourse: 'Ana Yemek',
  sideDish: 'Yan Yemek',
  complement: 'Tamamlayıcı',
};

export const COURSE_TO_CATEGORY_KEY: Record<MealCourseField, Exclude<CategoryKey, 'snacks'>> = {
  soup: 'soups',
  mainCourse: 'mainCourses',
  sideDish: 'sideDishes',
  complement: 'complements',
};

export const CATEGORY_TO_COURSE_FIELD: Record<Exclude<CategoryKey, 'snacks'>, MealCourseField> = {
  soups: 'soup',
  mainCourses: 'mainCourse',
  sideDishes: 'sideDish',
  complements: 'complement',
};

export const EMPTY_FOUR_COURSE_MEAL: FourCourseMeal = {
  soup: null,
  mainCourse: null,
  sideDish: null,
  complement: null,
};

export function createEmptyFourCourseMeal(): FourCourseMeal {
  return { ...EMPTY_FOUR_COURSE_MEAL };
}

export function createEmptyDailyMenu(date: string): DailyMenu {
  return {
    date,
    lunch: createEmptyFourCourseMeal(),
    dinner: createEmptyFourCourseMeal(),
    snack: null,
  };
}

export function countMealCourses(meal: FourCourseMeal | undefined): number {
  if (!meal) return 0;
  return MEAL_COURSE_FIELDS.filter((field) => Boolean(meal[field])).length;
}

export function isMealComplete(meal: FourCourseMeal | undefined): boolean {
  return countMealCourses(meal) === MEAL_COURSE_FIELDS.length;
}

export function countDayEntries(menu: DailyMenu | undefined): number {
  if (!menu) return 0;
  return countMealCourses(menu.lunch) + countMealCourses(menu.dinner) + (menu.snack ? 1 : 0);
}

export function isDayComplete(menu: DailyMenu | undefined): boolean {
  return Boolean(menu && isMealComplete(menu.lunch) && isMealComplete(menu.dinner) && menu.snack);
}

export function hasAnyPlannedItems(menu: DailyMenu | undefined): boolean {
  return countDayEntries(menu) > 0;
}

export function getAllMenuItemIds(menu: DailyMenu): string[] {
  return [
    ...MAIN_MEAL_KEYS.flatMap((mealKey) => MEAL_COURSE_FIELDS.map((field) => menu[mealKey][field])),
    menu.snack,
  ].filter((value): value is string => Boolean(value));
}

// ===========================================================================
// OTOMATİK MENÜ MOTORU KÖPRÜSÜ
// ---------------------------------------------------------------------------
// Uygulamanın veri modeli (FoodItem / DailyMenu) ile kısıt-bazlı motor
// (src/lib/menu-generator: Dish / DayMenu) arasındaki çeviri katmanı.
// Store ve bileşenler eski yapıyı kullanmaya devam eder; motor sadece burada görünür.
//
// Motorun kategori adları uygulamanınkinden farklıdır:
//   soups → 'çorba' · mainCourses → 'ana_yemek' · sideDishes → 'yan_urun'
//   complements → 'tatli_meyve' (4. çeşit: ayran, yoğurt, salata, meyve, tatlı...)
// Ara öğün (snacks) motorun konusu değildir; burada ayrıca seçilir.
// ===========================================================================

const COURSE_TO_DISH_CATEGORY: Record<MealCourseField, DishCategory> = {
  soup: 'çorba',
  mainCourse: 'ana_yemek',
  sideDish: 'yan_urun',
  complement: 'tatli_meyve',
};

const CATEGORY_KEY_TO_DISH_CATEGORY: Partial<Record<CategoryKey, DishCategory>> = {
  soups: 'çorba',
  mainCourses: 'ana_yemek',
  sideDishes: 'yan_urun',
  complements: 'tatli_meyve',
};

const MEAL_KEY_TO_SLOT: Record<MainMealKey, MealSlot> = { lunch: 'ogle', dinner: 'aksam' };

// --- Etiket sözlüğü: uygulamadaki İngilizce etiketler → motorun etiketleri ---

const ENGLISH_TO_ENGINE_TAGS: Record<string, string[]> = {
  poultry: ['tavuk'],
  beef: ['kirmizi_et'],
  fish: ['balik'],
  legume: ['bakliyat'],
  vegetable: ['sebze'],
  light: ['hafif'],
  dough: ['hamur_isi'],
  carb_heavy: ['karbonhidrat_agirlikli'],
  practical: ['pratik'],
};

/** Pilav/makarna grubundan sayılan yan yemek etiketleri. */
const STARCH_SIDE_TAGS = ['rice', 'pasta', 'bulgur', 'noodle', 'couscous'] as const;

/**
 * Etiketi hiç olmayan (kullanıcının havuza elle eklediği) yemekler için
 * isimden etiket çıkarımı. Etiketi olan yemeklere dokunulmaz.
 */
export function inferTagsFromName(item: FoodItem): string[] {
  const name = item.name.toLocaleLowerCase('tr-TR');
  const tags: string[] = [];

  if (item.category === 'sideDishes') {
    if (/bulgur/.test(name)) tags.push('bulgur');
    else if (/makarna|spagetti|penne/.test(name)) tags.push('pasta');
    else if (/erişte|şehriye/.test(name)) tags.push('noodle');
    else if (/kuskus/.test(name)) tags.push('couscous');
    else if (/pirinç|pilav/.test(name)) tags.push('rice');
    return tags;
  }

  if (/mantı|börek|pide|lahmacun|gözleme|pizza/.test(name)) {
    tags.push('dough', 'carb_heavy', 'practical');
  } else if (/dürüm|hamburger|tost|döner/.test(name)) {
    tags.push('practical');
  }
  if (/tavuk/.test(name)) tags.push('poultry');
  if (/balık|hamsi|mezgit|levrek|somon|çupra/.test(name)) tags.push('fish');

  const isLegume = /fasulye|nohut|mercimek|barbunya|bezelye|börülce/.test(name);
  if (isLegume) tags.push('legume');
  // "Mercimek Köftesi" gibi baklagil yemekleri kırmızı et sayılmasın.
  if (!isLegume && /kıyma|köfte|kebap|kebab|biftek|kuzu|dana|etli|(^|\s)et(\s|$)/.test(name)) {
    tags.push('beef');
  }
  if (/sebze|türlü|kabak|patlıcan|ıspanak|enginar|lahana|kapuska|brokoli|havuç|biber|domates/.test(name)) {
    tags.push('vegetable');
  }
  return tags;
}

/**
 * Motorun bir yemek için gerçekte kullandığı etiketler: kayıtlı etiket varsa o,
 * yoksa isimden tahmin edilenler. (Arayüz de aynı bilgiyi gösterir.)
 */
export function getEffectiveTags(item: FoodItem): string[] {
  return item.tags?.length ? item.tags : inferTagsFromName(item);
}

/** İsimden baskın bileşen çıkarımı (aynı öğünde çakışmasın diye). */
const INGREDIENT_KEYWORDS: ReadonlyArray<readonly [RegExp, string]> = [
  [/mercimek/, 'mercimek'],
  [/nohut/, 'nohut'],
  [/fasulye|barbunya/, 'fasulye'],
  [/bezelye/, 'bezelye'],
  [/tavuk/, 'tavuk'],
  [/domates/, 'domates'],
  [/patates/, 'patates'],
  [/yayla|yoğurt|ayran|cacık|tarator/, 'yoğurt'],
  [/patlıcan|musakka/, 'patlıcan'],
  [/kabak/, 'kabak'],
  [/lahana|kapuska/, 'lahana'],
  [/mantar/, 'mantar'],
  [/ıspanak/, 'ıspanak'],
];

/** Düzenleyicide öneri olarak sunulan bilinen baskın bileşenler. */
export const INGREDIENT_SUGGESTIONS: string[] = INGREDIENT_KEYWORDS.map(([, ingredient]) => ingredient);

function inferIngredients(item: FoodItem): string[] {
  const name = item.name.toLocaleLowerCase('tr-TR');
  return INGREDIENT_KEYWORDS.filter(([pattern]) => pattern.test(name)).map(([, ingredient]) => ingredient);
}

/**
 * Kuru fasulye / nohut yalnızca pilavla, yeşil mercimek / barbunya yalnızca
 * makarnayla servis edilir (önceki sürümdeki eşleşme kuralı, isim bazlı).
 */
function getMainSideRule(item: FoodItem): 'rice' | 'pasta' | null {
  if (item.category !== 'mainCourses') return null;
  const name = item.name.toLocaleLowerCase('tr-TR');
  if (name.includes('kuru fasulye') || name.includes('nohut')) return 'rice';
  if (name.includes('yeşil mercimek') || name.includes('barbunya')) return 'pasta';
  return null;
}

/** Yan yemeklere motor tarafında ayrı "tür" etiketleri verilir (çorba/tamamlayıcıyı etkilemesin). */
const SIDE_KINDS = ['rice', 'pasta', 'bulgur', 'noodle', 'couscous', 'non_starch'] as const;

function getSideKind(baseTags: string[]): (typeof SIDE_KINDS)[number] {
  return SIDE_KINDS.find((kind) => baseTags.includes(kind)) ?? 'non_starch';
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

// --- ADAPTER: FoodItem → Dish -----------------------------------------------

/** Tek bir yemeği motorun `Dish` tipine çevirir. Ara öğünler (snacks) için null döner. */
export function foodItemToDish(item: FoodItem): Dish | null {
  const category = CATEGORY_KEY_TO_DISH_CATEGORY[item.category];
  if (!category) return null;

  const baseTags = getEffectiveTags(item);
  const engineTags = baseTags.flatMap((tag) => ENGLISH_TO_ENGINE_TAGS[tag] ?? []);
  const incompatible: string[] = [...(item.incompatibleWithTags ?? [])];

  if (item.category === 'sideDishes') {
    const kind = getSideKind(baseTags);
    engineTags.push(`side_${kind}`);
    if (STARCH_SIDE_TAGS.some((tag) => baseTags.includes(tag))) engineTags.push('pilav_makarna');
  }

  // Aynı öğünde en fazla bir baklagil yemeği olsun (mercimek çorbası + kuru fasulye gibi).
  if (baseTags.includes('legume')) incompatible.push('bakliyat');

  const sideRule = getMainSideRule(item);
  if (sideRule) {
    const allowed = `side_${sideRule}`;
    incompatible.push(...SIDE_KINDS.map((kind) => `side_${kind}`).filter((tag) => tag !== allowed));
  }

  return {
    id: item.id,
    name: item.name,
    category,
    tags: unique([...baseTags, ...engineTags]),
    incompatibleWithTags: unique(incompatible),
    mainIngredients: unique([...(item.mainIngredients ?? []), ...inferIngredients(item)]),
    suggestedCompanionIds: item.suggestedCompanions?.length ? [...item.suggestedCompanions] : undefined,
  };
}

/** Bir yemek listesini (havuz) motorun `Dish` listesine çevirir; ara öğünler atlanır. */
export function foodItemsToDishes(items: FoodItem[]): Dish[] {
  const categoryById = new Map<string, DishCategory>();
  for (const item of items) {
    const category = CATEGORY_KEY_TO_DISH_CATEGORY[item.category];
    if (category) categoryById.set(item.id, category);
  }

  return items.flatMap((item) => {
    const dish = foodItemToDish(item);
    if (!dish) return [];
    if (dish.category === 'ana_yemek' && dish.suggestedCompanionIds) {
      // Eşlikçiler kategoriye göre ayrılır; havuzda olmayan / ana yemek olan kimlikler yok sayılır.
      const byCategory: Partial<Record<DishCategory, string[]>> = {};
      for (const id of dish.suggestedCompanionIds) {
        const category = categoryById.get(id);
        if (!category || category === 'ana_yemek') continue;
        (byCategory[category] ??= []).push(id);
      }
      if (Object.keys(byCategory).length > 0) dish.companionsByCategory = byCategory;
    }
    return [dish];
  });
}

/** seedData.ts'teki varsayılan havuzu motorun `Dish` listesine çevirir. */
export function adaptSeedDataToDishes(): Dish[] {
  return foodItemsToDishes(SEED_DATA);
}

// --- DÖNÜŞTÜRÜCÜLER: Dish tabanlı motor çıktısı ↔ DailyMenu ------------------

function mealToFourCourseMeal(meal: Meal): FourCourseMeal {
  return {
    soup: meal[COURSE_TO_DISH_CATEGORY.soup]?.id ?? null,
    mainCourse: meal[COURSE_TO_DISH_CATEGORY.mainCourse]?.id ?? null,
    sideDish: meal[COURSE_TO_DISH_CATEGORY.sideDish]?.id ?? null,
    complement: meal[COURSE_TO_DISH_CATEGORY.complement]?.id ?? null,
  };
}

/** Motorun tek günlük çıktısını uygulamanın `DailyMenu` yapısına çevirir. */
export function dayMenuToDailyMenu(day: DayMenu, snack: string | null = null): DailyMenu {
  return {
    date: day.date,
    lunch: mealToFourCourseMeal(day.meals[MEAL_KEY_TO_SLOT.lunch]),
    dinner: mealToFourCourseMeal(day.meals[MEAL_KEY_TO_SLOT.dinner]),
    snack,
  };
}

function fourCourseMealToMeal(meal: FourCourseMeal, dishById: Map<string, Dish>): Meal {
  const result: Meal = {};
  for (const field of MEAL_COURSE_FIELDS) {
    const id = meal[field];
    const dish = id ? dishById.get(id) : undefined;
    if (dish) result[COURSE_TO_DISH_CATEGORY[field]] = dish;
  }
  return result;
}

/** Kayıtlı bir `DailyMenu`'yü motorun `DayMenu` yapısına çevirir (bekleme kuralları için geçmiş). */
export function dailyMenuToDayMenu(menu: DailyMenu, dishById: Map<string, Dish>): DayMenu {
  const [year, month, day] = menu.date.split('-').map(Number);
  return {
    date: menu.date,
    weekday: createLocalDate(year, month - 1, day).getDay(),
    meals: {
      ogle: fourCourseMealToMeal(menu.lunch, dishById),
      aksam: fourCourseMealToMeal(menu.dinner, dishById),
    },
  };
}

// --- MOTOR AYARLARI ----------------------------------------------------------

/** Uygulamaya özel motor ayarları (etiket adları, hafta sonu senkronu, yumuşak eşleşmeler). */
export const MENU_ENGINE_OPTIONS: GeneratorOptions = {
  // Hafta sonu: akşamın çorba / yan yemek / tamamlayıcısı öğleyle aynı (store'daki senkronla uyumlu).
  weekendSyncCategories: ['çorba', 'yan_urun', 'tatli_meyve'],
  // Öğlen baklagil yendiyse akşam ana yemeği "hafif" sayılan etiketlerden birini taşımalı.
  lightTags: ['sebze', 'hafif', 'balik'],
  softPairings: [
    { a: ['noodle'], b: ['noodle'], weight: 2 }, // şehriye çorbası + erişte
    { a: ['pasta'], b: ['pasta'], weight: 2 },
    { a: ['rice', 'pasta', 'bulgur'], b: ['bread'], weight: 3.5 }, // pilav/makarna + ekmek
    { a: ['fish'], b: ['pickled'], weight: 2 }, // balık + turşu
    { a: ['dairy'], b: ['dessert'], weight: 1.5 }, // sütlü çorba + tatlı
  ],
};

// --- KALORİ ---------------------------------------------------------------

export interface CalorieSummary {
  lunch: number;
  dinner: number;
  snack: number;
  total: number;
  /** Menüde seçili olup kalori bilgisi girilmemiş yemek sayısı. */
  missing: number;
}

/** Günün öğün başına ve toplam kalorisi (yalnızca kalorisi girilmiş yemekler sayılır). */
export function summarizeCalories(menu: DailyMenu | undefined, itemById: Map<string, FoodItem>): CalorieSummary {
  const out: CalorieSummary = { lunch: 0, dinner: 0, snack: 0, total: 0, missing: 0 };
  if (!menu) return out;
  const add = (id: string | null | undefined, key: 'lunch' | 'dinner' | 'snack') => {
    if (!id) return;
    const kcal = itemById.get(id)?.calories;
    if (kcal) out[key] += kcal;
    else out.missing += 1;
  };
  for (const mealKey of MAIN_MEAL_KEYS) {
    for (const field of MEAL_COURSE_FIELDS) add(menu[mealKey][field], mealKey);
  }
  add(menu.snack, 'snack');
  out.total = out.lunch + out.dinner + out.snack;
  return out;
}

/** Arayüzdeki kural ayarlarını motor seçeneklerine çevirir. */
export function ruleSettingsToOptions(settings: RuleSettings): GeneratorOptions {
  return {
    mainCooldownDays: settings.mainCooldownDays,
    maxConsecutiveProteinDays: settings.maxConsecutiveProteinDays,
    weekendSyncCategories: settings.weekendSync ? ['çorba', 'yan_urun', 'tatli_meyve'] : [],
    requireCompanions: settings.requireCompanions,
    weekdayBans: Object.fromEntries(
      Object.entries(settings.weekdayBans ?? {})
        .map(([day, tags]) => [Number(day), tags.flatMap((tag) => ENGLISH_TO_ENGINE_TAGS[tag] ?? [])] as const)
        .filter(([, tags]) => tags.length > 0),
    ),
  };
}

const HISTORY_DAYS = 10;

/** Ayın ilk gününden önceki HISTORY_DAYS günü (boş günlerle tamamlanmış, ardışık) hazırlar. */
function buildPreviousDays(
  existingMenus: DailyMenu[],
  year: number,
  month: number,
  dishById: Map<string, Dish>,
): { days: DayMenu[]; snackIds: (string | null)[] } {
  const byDate = new Map(existingMenus.map((menu) => [menu.date, menu]));
  const days: DayMenu[] = [];
  const snackIds: (string | null)[] = [];

  for (let offset = HISTORY_DAYS; offset >= 1; offset -= 1) {
    const date = createLocalDate(year, month, 1 - offset);
    const dateStr = formatDate(date);
    const existing = byDate.get(dateStr);
    days.push(
      existing
        ? dailyMenuToDayMenu(existing, dishById)
        : { date: dateStr, weekday: date.getDay(), meals: { ogle: {}, aksam: {} } },
    );
    snackIds.push(existing?.snack ?? null);
  }
  return { days, snackIds };
}

// --- ARA ÖĞÜN SEÇİMİ ---------------------------------------------------------

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

/** Az kullanılanı seçer; son 2 günde geleni ve aynı gün başka çeşitle aynı isimde olanı (Sütlaç) atlar. */
function pickSnacks(
  snackPool: FoodItem[],
  days: DayMenu[],
  previousSnackIds: (string | null)[],
  seed: number,
): (string | null)[] {
  if (snackPool.length === 0) return days.map(() => null);

  const usage = new Map<string, number>();
  const recent = previousSnackIds.slice(-2).filter((id): id is string => Boolean(id));
  const picks: (string | null)[] = [];

  for (const day of days) {
    const dishNamesToday = new Set(
      [day.meals.ogle, day.meals.aksam].flatMap((meal) =>
        Object.values(meal).map((dish) => dish.name.toLocaleLowerCase('tr-TR')),
      ),
    );

    let candidates = snackPool;
    const narrow = (predicate: (item: FoodItem) => boolean) => {
      const filtered = candidates.filter(predicate);
      if (filtered.length > 0) candidates = filtered;
    };
    narrow((item) => !recent.includes(item.id));
    narrow((item) => !dishNamesToday.has(item.name.toLocaleLowerCase('tr-TR')));

    const best = [...candidates].sort(
      (a, b) =>
        (usage.get(a.id) ?? 0) - (usage.get(b.id) ?? 0) ||
        hashString(`${seed}-${day.date}-${a.id}`) - hashString(`${seed}-${day.date}-${b.id}`),
    )[0];

    picks.push(best.id);
    usage.set(best.id, (usage.get(best.id) ?? 0) + 1);
    recent.push(best.id);
    if (recent.length > 2) recent.shift();
  }
  return picks;
}

// --- ANA GİRİŞ NOKTASI -------------------------------------------------------

export interface GeneratedMonth {
  /** Store'a doğrudan yazılabilecek, eski yapıdaki günlük menüler. */
  menus: DailyMenu[];
  /** Seçim sırası (store, havuz listesini "son kullanılan sona" döndürmek için kullanır). */
  selectionSequence: string[];
  warnings: string[];
  seed: number;
}

/**
 * Bir ayın menüsünü kısıt-bazlı motorla üretir ve uygulamanın `DailyMenu[]` yapısında döner.
 *
 * @param foodItems     Güncel havuz (kullanıcının eklediği yemekler dahil)
 * @param year          Örn. 2026
 * @param month         0-11 (Ocak = 0) — uygulamanın diğer yerleriyle aynı; motora +1 ile verilir
 * @param existingMenus Mevcut tüm menüler: önceki ayın son günleri bekleme kurallarına dahil edilir
 * @throws MenuGenerationError Kısıtlar bu havuzla sağlanamıyorsa (mesajı `formatMenuGenerationError` ile gösterin)
 */
export function generateAutoMonthMenus(
  foodItems: FoodItem[],
  year: number,
  month: number,
  existingMenus: DailyMenu[] = [],
  options: GeneratorOptions = {},
  /** Dondurulacak günler (YYYY-MM-DD): kilitli günler ve kapsam dışındaki günler. İçerikleri aynen korunur. */
  frozenDates: string[] = [],
): GeneratedMonth {
  const dishes = foodItemsToDishes(foodItems);
  const dishById = new Map(dishes.map((dish) => [dish.id, dish]));
  const history = buildPreviousDays(existingMenus, year, month, dishById);
  const frozen = new Set(frozenDates);
  const byDate = new Map(existingMenus.map((menu) => [menu.date, menu]));

  const fixedDays: DayMenu[] = frozenDates.map((date) => {
    const existing = byDate.get(date);
    if (existing) return dailyMenuToDayMenu(existing, dishById);
    const [y, m, d] = date.split('-').map(Number);
    return { date, weekday: createLocalDate(y, m - 1, d).getDay(), meals: { ogle: {}, aksam: {} } };
  });

  const result = generateMonthlyMenu(dishes, month + 1, year, {
    ...MENU_ENGINE_OPTIONS,
    previousDays: history.days,
    ...options,
    fixedDays,
  });

  const freeDays = result.days.filter((day) => !frozen.has(day.date));
  const snackPicks = pickSnacks(
    foodItems.filter((item) => item.category === 'snacks'),
    freeDays,
    history.snackIds,
    result.seed,
  );
  const snackByDate = new Map(freeDays.map((day, index) => [day.date, snackPicks[index]]));

  const menus: DailyMenu[] = result.days.flatMap((day) => {
    if (frozen.has(day.date)) {
      const existing = byDate.get(day.date);
      return existing ? [existing] : [];
    }
    return [dayMenuToDailyMenu(day, snackByDate.get(day.date) ?? null)];
  });

  const generatedMenus = menus.filter((menu) => !frozen.has(menu.date));
  const selectionSequence = generatedMenus.flatMap((menu) => [
    ...MAIN_MEAL_KEYS.flatMap((mealKey) => MEAL_COURSE_FIELDS.map((field) => menu[mealKey][field])),
    menu.snack,
  ]).filter((id): id is string => Boolean(id));

  return { menus, selectionSequence, warnings: result.warnings, seed: result.seed };
}

// --- TEK YEMEK DEĞİŞTİRME / UYGUNLUK -----------------------------------------

export interface CandidateEvaluation {
  /** Sert kurallara uyan adaylar, en iyiden başlayarak (mevcut seçim hariç). */
  ranked: string[];
  /** Kural çiğneyen adayların kimliği → çiğnenen kuralın açıklaması. */
  violations: Record<string, string>;
}

/**
 * Bir günün tek bir yemek yuvası (öğün + kurs) için havuzdaki adayları değerlendirir.
 * Menü motoruyla aynı sert kuralları kullanır; komşu günler (±10 gün) bağlam olarak alınır.
 */
export function evaluateCandidates(
  foodItems: FoodItem[],
  menus: DailyMenu[],
  date: string,
  mealKey: MainMealKey,
  field: MealCourseField,
  options: GeneratorOptions = {},
  seed = Date.now() % 100000,
): CandidateEvaluation {
  const dishes = foodItemsToDishes(foodItems);
  const dishById = new Map(dishes.map((dish) => [dish.id, dish]));
  const byDate = new Map(menus.map((menu) => [menu.date, menu]));
  const center = parseISODate(date);
  const category = COURSE_TO_DISH_CATEGORY[field];
  const slot = MEAL_KEY_TO_SLOT[mealKey];

  const timeline: DayMenu[] = [];
  let dayIndex = 0;
  for (let delta = -HISTORY_DAYS; delta <= HISTORY_DAYS; delta += 1) {
    const d = createLocalDate(center.getFullYear(), center.getMonth(), center.getDate() + delta);
    const dateStr = formatDate(d);
    const existing = byDate.get(dateStr);
    const day: DayMenu = existing
      ? dailyMenuToDayMenu(existing, dishById)
      : { date: dateStr, weekday: d.getDay(), meals: { ogle: {}, aksam: {} } };
    if (delta === 0) {
      day.meals = { ogle: { ...day.meals.ogle }, aksam: { ...day.meals.aksam } };
      delete day.meals[slot][category]; // değiştirilecek yemeği çıkar
      dayIndex = timeline.length;
    }
    timeline.push(day);
  }

  const config = resolveConfig({ ...MENU_ENGINE_OPTIONS, ...options, seed });
  const ctx = { config, timeline, dayIndex, slot, category };
  const currentId = byDate.get(date)?.[mealKey][field] ?? null;

  const usage = new Map<string, number>();
  for (const menu of menus) {
    for (const id of getAllMenuItemIds(menu)) usage.set(id, (usage.get(id) ?? 0) + 1);
  }

  const violations: Record<string, string> = {};
  const allowed: Dish[] = [];
  for (const dish of dishes.filter((d) => d.category === category)) {
    const rule = findViolation(dish, ctx);
    if (rule) violations[dish.id] = rule.description;
    else if (dish.id !== currentId) allowed.push(dish);
  }

  let state = seed >>> 0;
  const rng = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const ranked = rankCandidates(allowed, ctx, usage, rng).map((dish) => dish.id);
  return { ranked, violations };
}

function parseISODate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return createLocalDate(y, m - 1, d);
}

/** Hazır menüleri (ör. elle düzenlenmiş ay) motorun kurallarıyla denetler; boş dizi = ihlal yok. */
export function validateDailyMenus(
  menus: DailyMenu[],
  foodItems: FoodItem[],
  options: GeneratorOptions = {},
): RuleViolation[] {
  const dishById = new Map(foodItemsToDishes(foodItems).map((dish) => [dish.id, dish]));
  const days = [...menus]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((menu) => dailyMenuToDayMenu(menu, dishById));
  return validateMonthlyMenu({ days }, { ...MENU_ENGINE_OPTIONS, ...options });
}

const COURSE_LABEL_BY_DISH_CATEGORY: Record<DishCategory, string> = {
  çorba: 'çorba',
  ana_yemek: 'ana yemek',
  yan_urun: 'yan yemek',
  tatli_meyve: 'tamamlayıcı',
};

/** Motor hatasını kullanıcıya gösterilecek Türkçe bir mesaja çevirir. */
export function formatMenuGenerationError(error: unknown): string {
  if (error instanceof MenuGenerationError && error.diagnostics) {
    const { date, slot, category, rejectedBy } = error.diagnostics;
    const reasons = Object.keys(rejectedBy)
      .map((id) => RULES.find((rule) => rule.id === id)?.description)
      .filter(Boolean)
      .join(' • ');
    return (
      `${formatShortDateTR(date)} ${slot === 'ogle' ? 'öğle' : 'akşam'} öğünü için uygun ` +
      `${COURSE_LABEL_BY_DISH_CATEGORY[category]} bulunamadı. Engelleyen kurallar: ${reasons}. ` +
      `Havuza yemek ekleyerek tekrar deneyin.`
    );
  }
  if (error instanceof MenuGenerationError && /pratik/i.test(error.message)) {
    return `${error.message} Mantı, börek, pide, dürüm, hamburger gibi yemekleri "Ana Yemekler" havuzuna ekleyin.`;
  }
  return error instanceof Error ? error.message : 'Menü oluşturulurken beklenmeyen bir hata oluştu.';
}
