// lib/menu-generator/config.ts
import type { DayMenu, DishCategory, MealSlot, Tag } from './types';

/** Skorlama ağırlıkları (yalnızca SIRALAMAYI etkiler, hiçbir zaman kural çiğnetmez). */
export interface ScoringWeights {
  /** Ay içinde daha önce kaç kez kullanıldıysa, kullanım başına ceza. */
  usage: number;
  /** Yumuşak bekleme penceresi içinde tekrar gelirse verilen ceza çarpanı. */
  softRecency: number;
  /** Dünkü ana yemeklerle paylaşılan etiket başına ceza (ör. iki gün üst üste 'hamur_isi'). */
  yesterdayTagRepeat: number;
  /** Aynı gün öğle/akşam arasında ortak baskın bileşen başına ceza. */
  sameDayIngredientOverlap: number;
  /** Aynı öğünde iki yemeğin aynı protein etiketini taşıması cezası (ör. tavuk çorbası + tavuk sote). */
  sameMealProteinDup: number;
  /** `popularity` alanı için bonus çarpanı. */
  popularity: number;
  /** Çeşitlilik için rastgele gürültü büyüklüğü. */
  randomness: number;
}

export interface SoftPairing {
  a: Tag[];
  b: Tag[];
  weight: number;
}

export interface GeneratorConfig {
  /** Hangi öğünde hangi kategoriler bulunsun. */
  mealTemplate: Record<MealSlot, DishCategory[]>;

  // --- Etiket sözlüğü (kendi etiket adlarınıza göre değiştirebilirsiniz) ---
  proteinTags: Tag[];
  lightTags: Tag[];
  legumeTags: Tag[];
  /** Öğle öğününde bu kategorilerdeki bakliyat, akşamı "hafif" olmaya zorlar. */
  legumeTriggerCategories: DishCategory[];
  /** Bu etiketlere sahip ANA YEMEK yanında pilav/makarna gelemez. */
  carbHeavyTags: Tag[];
  riceOrPastaTags: Tag[];
  practicalTag: Tag;

  // --- Hafta sonu kuralı ---
  /** Cumartesi/Pazar öğle öğününde 'pratik' şartı aranan kategoriler. */
  weekendLunchPracticalCategories: DishCategory[];

  // --- Sıklık / tekrar ---
  /** Aynı ana yemek, kullanıldığı günden sonraki bu kadar gün boyunca tekrar edemez. */
  mainCooldownDays: number;
  /** Aynı protein en fazla bu kadar gün üst üste seçilebilir. */
  maxConsecutiveProteinDays: number;
  /** Sert olmayan (skorlama) bekleme pencereleri. */
  softCooldownDays: Partial<Record<DishCategory, number>>;

  // --- Hafta sonu senkronu ---
  /**
   * Cumartesi/Pazar günlerinde AKŞAM öğününde, öğle öğünüyle AYNI olacak kategoriler.
   * (Ör. ['çorba','yan_urun','tatli_meyve']). Boş bırakılırsa senkron yoktur.
   * Senkron yemekler, aynı-gün tekrar ve protein-tekrar kurallarından muaftır.
   */
  weekendSyncCategories: DishCategory[];

  // --- Yumuşak eşleşme cezaları (skorlama; kural çiğnetmez) ---
  /** Aynı öğünde bir yemekte `a`, diğerinde `b` etiketlerinden biri varsa `weight` kadar ceza. */
  softPairings: SoftPairing[];

  weights: ScoringWeights;

  // --- Çözücü ayarları ---
  /** Tekrarlanabilirlik için. Verilmezse rastgele üretilir ve sonuçta döner. */
  seed: number;
  /** Her deneme farklı rastgele sıralamayla başlar. */
  maxAttempts: number;
  /** Bir denemede izin verilen geri izleme (backtrack) sayısı. */
  maxBacktracksPerAttempt: number;
  /** Önceki ayın son günleri (eskiden yeniye). Bekleme kurallarının ay sınırını aşması için. */
  previousDays: DayMenu[];
}

export type GeneratorOptions = Partial<Omit<GeneratorConfig, 'weights'>> & {
  weights?: Partial<ScoringWeights>;
};

export const DEFAULT_CONFIG: Omit<GeneratorConfig, 'seed'> = {
  mealTemplate: {
    ogle: ['ana_yemek', 'yan_urun', 'çorba', 'tatli_meyve'],
    aksam: ['ana_yemek', 'yan_urun', 'çorba', 'tatli_meyve'],
  },
  proteinTags: ['tavuk', 'kirmizi_et', 'balik'],
  lightTags: ['sebze', 'hafif'],
  legumeTags: ['bakliyat'],
  legumeTriggerCategories: ['ana_yemek', 'yan_urun'],
  carbHeavyTags: ['hamur_isi', 'karbonhidrat_agirlikli'],
  riceOrPastaTags: ['pilav_makarna'],
  practicalTag: 'pratik',
  weekendLunchPracticalCategories: ['ana_yemek'],
  mainCooldownDays: 5,
  maxConsecutiveProteinDays: 2,
  softCooldownDays: { ana_yemek: 10, çorba: 3, yan_urun: 2, tatli_meyve: 2 },
  weekendSyncCategories: [],
  softPairings: [],
  weights: {
    usage: 1,
    softRecency: 1.5,
    yesterdayTagRepeat: 1.5,
    sameDayIngredientOverlap: 3,
    sameMealProteinDup: 3,
    popularity: 1,
    randomness: 2,
  },
  maxAttempts: 8,
  maxBacktracksPerAttempt: 20_000,
  previousDays: [],
};

export function resolveConfig(options: GeneratorOptions = {}): GeneratorConfig {
  return {
    ...DEFAULT_CONFIG,
    ...options,
    mealTemplate: { ...DEFAULT_CONFIG.mealTemplate, ...options.mealTemplate },
    softCooldownDays: { ...DEFAULT_CONFIG.softCooldownDays, ...options.softCooldownDays },
    weights: { ...DEFAULT_CONFIG.weights, ...options.weights },
    previousDays: options.previousDays ?? [],
    seed: options.seed ?? Math.floor(Math.random() * 0x7fffffff),
  };
}
