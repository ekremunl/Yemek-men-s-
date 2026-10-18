// src/lib/mutfak.ts
//
// Mutfaktakip (https://github.com/ekremunl/Mutfaktakip) ile bağlantı.
//
// Mutfaktakip tek dosyalı bir uygulamadır ve verisini tarayıcının localStorage'ında şu anahtarlarla tutar:
//   kt_recipes : [{ id, name, cat, ings: [{ name, amt, unit }] }]   (amt = KİŞİ BAŞI miktar)
//   kt_days    : { 'YYYY-MM-DD': { lunch, dinner, basis, meals: { kahvalti, ogle, aksam, ara: [reçeteId] }, firin, direkt, report } }
// Yedek dosyası biçimi: { app: 'mutfak-rapor', version: 1, exportedAt, recipes, days }
//
// İki uygulama AYNI alan adında yayınlanıyorsa (ör. kullanici.github.io) localStorage ortaktır ve doğrudan okunur/yazılır.
// Aksi halde yedek (.json) dosyası üzerinden taşınır.
import type { DailyMenu, FoodItem, LinkedRecipe, PersonCounts } from '@/types';
import { MAIN_MEAL_KEYS, MEAL_COURSE_FIELDS } from '@/lib/menu';

export const MUTFAK_RECIPES_KEY = 'kt_recipes';
export const MUTFAK_DAYS_KEY = 'kt_days';
export const MUTFAK_APP_ID = 'mutfak-rapor';

export interface MutfakDay {
  lunch?: number;
  dinner?: number;
  basis?: Record<string, string>;
  meals?: Partial<Record<'kahvalti' | 'ogle' | 'aksam' | 'ara', string[]>>;
  firin?: unknown[];
  direkt?: unknown[];
  report?: Record<string, unknown>;
  [extra: string]: unknown;
}

export interface MutfakData {
  recipes: LinkedRecipe[];
  days: Record<string, MutfakDay>;
}

// ---------------------------------------------------------------------------
// Okuma
// ---------------------------------------------------------------------------

function toRecipe(raw: unknown): LinkedRecipe | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || typeof r.name !== 'string' || !Array.isArray(r.ings)) return null;
  return {
    id: r.id,
    name: r.name,
    cat: typeof r.cat === 'string' ? r.cat : undefined,
    ings: r.ings
      .map((ing) => {
        const i = (ing ?? {}) as Record<string, unknown>;
        return { name: String(i.name ?? '').trim(), amt: Number(i.amt) || 0, unit: String(i.unit ?? 'g') };
      })
      .filter((ing) => ing.name && ing.amt > 0),
  };
}

function parseStored<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Aynı tarayıcıda (aynı alan adı) çalışan Mutfaktakip verisini okur; yoksa null. */
export function readLiveMutfak(): MutfakData | null {
  if (typeof window === 'undefined') return null;
  try {
    const rawRecipes = parseStored<unknown[]>(window.localStorage.getItem(MUTFAK_RECIPES_KEY));
    if (!Array.isArray(rawRecipes)) return null;
    const recipes = rawRecipes.map(toRecipe).filter((r): r is LinkedRecipe => r !== null);
    const days = parseStored<Record<string, MutfakDay>>(window.localStorage.getItem(MUTFAK_DAYS_KEY)) ?? {};
    return { recipes, days: days && typeof days === 'object' && !Array.isArray(days) ? days : {} };
  } catch {
    return null;
  }
}

/** Mutfaktakip yedek dosyasını doğrular ve okur. Geçersizse Error fırlatır. */
export function parseMutfakBackup(text: string): MutfakData {
  const parsed = JSON.parse(text) as Record<string, unknown>;
  if (!parsed || !Array.isArray(parsed.recipes) || !parsed.days || typeof parsed.days !== 'object' || Array.isArray(parsed.days)) {
    throw new Error('Bu dosya bir Mutfaktakip yedeği değil.');
  }
  const recipes = parsed.recipes.map(toRecipe).filter((r): r is LinkedRecipe => r !== null);
  return { recipes, days: parsed.days as Record<string, MutfakDay> };
}

// ---------------------------------------------------------------------------
// Eşleştirme (yemek adı ↔ reçete adı)
// ---------------------------------------------------------------------------

/** Karşılaştırma için sadeleştirir: küçük harf (tr), noktalama yok, tek boşluk. */
export function normalizeName(value: string): string {
  return value
    .toLocaleLowerCase('tr-TR')
    .replace(/[^a-z0-9çğıöşüâîû\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const tokens = (value: string) => new Set(normalizeName(value).split(' ').filter((t) => t.length > 1));

/** İki ad arasındaki benzerlik (0-1): ortak sözcüklerin Jaccard oranı. */
export function nameSimilarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  ta.forEach((t) => {
    if (tb.has(t)) shared += 1;
  });
  return shared / (ta.size + tb.size - shared);
}

export interface RecipeMatch {
  itemId: string;
  /** Adı birebir eşleşen reçete. */
  exact?: LinkedRecipe;
  /** Benzer adlı öneriler, en iyiden başlayarak. */
  suggestions: LinkedRecipe[];
}

export function matchRecipes(items: FoodItem[], recipes: LinkedRecipe[]): RecipeMatch[] {
  const byNormalized = new Map<string, LinkedRecipe>();
  recipes.forEach((r) => {
    const key = normalizeName(r.name);
    if (!byNormalized.has(key)) byNormalized.set(key, r);
  });

  return items.map((item) => {
    const exact = byNormalized.get(normalizeName(item.name));
    const suggestions = exact
      ? []
      : recipes
          .map((recipe) => ({ recipe, score: nameSimilarity(item.name, recipe.name) }))
          .filter((entry) => entry.score >= 0.34)
          .sort((a, b) => b.score - a.score)
          .slice(0, 3)
          .map((entry) => entry.recipe);
    return { itemId: item.id, exact, suggestions };
  });
}

// ---------------------------------------------------------------------------
// Menüyü Mutfaktakip günlerine aktarma
// ---------------------------------------------------------------------------

export interface MenuToMutfakResult {
  days: Record<string, MutfakDay>;
  /** Yazılan (yeni veya güncellenen) gün sayısı. */
  touchedDays: number;
  /** Mutfaktakip'te raporu kesinleşmiş olduğu için dokunulmayan öğün sayısı. */
  skippedMeals: number;
  /** Menüde olup reçetesi bağlı olmadığı için aktarılamayan yemek adları. */
  unlinked: string[];
}

/**
 * Seçilen aralıktaki menüleri Mutfaktakip günlerine yazar (birleştirir, silmez):
 *  - Öğle yemeği → `meals.ogle`, akşam → `meals.aksam`, ara öğün → `meals.ara`
 *  - Gün zaten varsa kişi sayıları ve diğer alanlar korunur; yoksa `persons` ile oluşturulur.
 *  - O öğün için Mutfaktakip'te kaydedilmiş (düzenlenmiş) bir rapor varsa o öğüne dokunulmaz.
 */
export function mergeMenusIntoMutfak(
  existing: Record<string, MutfakDay>,
  menus: DailyMenu[],
  items: FoodItem[],
  recipeIds: Set<string>,
  persons: PersonCounts,
  from: string,
  to: string
): MenuToMutfakResult {
  const days: Record<string, MutfakDay> = JSON.parse(JSON.stringify(existing));
  const itemById = new Map(items.map((i) => [i.id, i]));
  const unlinked = new Set<string>();
  let touchedDays = 0;
  let skippedMeals = 0;

  const idsFor = (ids: (string | null)[]): string[] => {
    const out: string[] = [];
    ids.forEach((id) => {
      if (!id) return;
      const item = itemById.get(id);
      if (!item) return;
      if (item.recipeId && recipeIds.has(item.recipeId)) {
        if (!out.includes(item.recipeId)) out.push(item.recipeId);
      } else {
        unlinked.add(item.name);
      }
    });
    return out;
  };

  menus
    .filter((menu) => menu.date >= from && menu.date <= to)
    .forEach((menu) => {
      const planned: Record<'ogle' | 'aksam' | 'ara', string[]> = {
        ogle: idsFor(MEAL_COURSE_FIELDS.map((f) => menu.lunch[f])),
        aksam: idsFor(MEAL_COURSE_FIELDS.map((f) => menu.dinner[f])),
        ara: idsFor([menu.snack]),
      };
      if (planned.ogle.length + planned.aksam.length + planned.ara.length === 0) return;

      const day: MutfakDay = days[menu.date] ?? {
        lunch: persons.lunch,
        dinner: persons.dinner,
        basis: { kahvalti: 'lunch', ogle: 'lunch', aksam: 'dinner', ara: 'lunch' },
        meals: { kahvalti: [], ogle: [], aksam: [], ara: [] },
        firin: [],
        direkt: [],
        report: {},
      };
      day.meals = day.meals ?? { kahvalti: [], ogle: [], aksam: [], ara: [] };
      day.report = day.report ?? {};

      let changed = false;
      (['ogle', 'aksam', 'ara'] as const).forEach((key) => {
        if (planned[key].length === 0) return;
        if (day.report && day.report[key]) {
          skippedMeals += 1; // kesinleşmiş rapor korunur
          return;
        }
        day.meals![key] = planned[key];
        changed = true;
      });
      if (changed) {
        days[menu.date] = day;
        touchedDays += 1;
      }
    });

  // MAIN_MEAL_KEYS yalnızca tip bütünlüğü için kullanılıyor (derleyici uyarısı çıkmasın).
  void MAIN_MEAL_KEYS;
  return { days, touchedDays, skippedMeals, unlinked: Array.from(unlinked).sort((a, b) => a.localeCompare(b, 'tr')) };
}

/** Aynı tarayıcıdaki Mutfaktakip'e doğrudan yazar. */
export function writeLiveMutfakDays(days: Record<string, MutfakDay>): void {
  window.localStorage.setItem(MUTFAK_DAYS_KEY, JSON.stringify(days));
}

/** Mutfaktakip "Yedek Yükle" ile geri yüklenebilecek yedek dosyasının içeriği. */
export function buildMutfakBackup(recipes: LinkedRecipe[], days: Record<string, MutfakDay>): string {
  return JSON.stringify({ app: MUTFAK_APP_ID, version: 1, exportedAt: new Date().toISOString(), recipes, days }, null, 2);
}
