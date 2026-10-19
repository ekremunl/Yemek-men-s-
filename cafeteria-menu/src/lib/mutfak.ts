// src/lib/mutfak.ts
//
// Eski Mutfaktakip (https://github.com/ekremunl/Mutfaktakip) ve sipariş uygulamasından veri alma.
//
// Mutfaktakip tek dosyalı bir uygulamadır ve verisini tarayıcının localStorage'ında şu anahtarlarla tutar:
//   kt_recipes : [{ id, name, cat, ings: [{ name, amt, unit }] }]   (amt = KİŞİ BAŞI miktar)
//   kt_days    : { 'YYYY-MM-DD': { lunch, dinner, basis, meals: { kahvalti, ogle, aksam, ara: [reçeteId] }, firin, direkt, report } }
// Yedek dosyası biçimi: { app: 'mutfak-rapor', version: 1, exportedAt, recipes, days }
//
// İki uygulama AYNI alan adında yayınlanıyorsa (ör. kullanici.github.io) localStorage ortaktır ve doğrudan okunur/yazılır.
// Aksi halde yedek (.json) dosyası üzerinden taşınır.
import type { FoodItem, LinkedRecipe } from '@/types';

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
// Eski sipariş uygulaması (Order Manager): ürün havuzu `om_pool` anahtarında
// ---------------------------------------------------------------------------

export const ORDER_POOL_KEY = 'om_pool';

/** Aynı alan adında çalışan eski sipariş uygulamasının ürün adlarını okur; yoksa null. */
export function readLiveOrderPool(): string[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = parseStored<unknown[]>(window.localStorage.getItem(ORDER_POOL_KEY));
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string' && x.trim().length > 0) : null;
  } catch {
    return null;
  }
}

/** Satır sonu / virgül / noktalı virgülle ayrılmış ürün adlarını ayrıştırır. */
export function parseNameList(text: string): string[] {
  return Array.from(new Set(text.split(/[\n,;]+/).map((n) => n.trim()).filter(Boolean)));
}
