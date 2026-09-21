// lib/menu-generator/types.ts

/** Yemeğin menüdeki rolü. */
export type DishCategory = 'çorba' | 'ana_yemek' | 'yan_urun' | 'tatli_meyve';

/** Günün öğünleri. */
export type MealSlot = 'ogle' | 'aksam';

/**
 * Bilinen etiketler (otomatik tamamlama için). `(string & {})` sayesinde
 * havuza kendi etiketlerinizi de serbestçe ekleyebilirsiniz.
 */
export type KnownTag =
  | 'tavuk'
  | 'kirmizi_et'
  | 'balik'
  | 'bakliyat'
  | 'sebze'
  | 'hafif'
  | 'hamur_isi'
  | 'karbonhidrat_agirlikli'
  | 'pilav_makarna'
  | 'pratik';
export type Tag = KnownTag | (string & {});

export interface Dish {
  id: string;
  name: string;
  category: DishCategory;
  tags: Tag[];
  /**
   * Aynı öğünde bu etiketlere sahip bir yemekle birlikte SEÇİLEMEZ.
   * Kural iki yönlüdür (A, B'yi yasaklıyorsa B'nin de A'yla gelmesi engellenir).
   */
  incompatibleWithTags?: Tag[];
  /**
   * Baskın bileşenler (ör. ['mercimek']). Aynı öğündeki yemeklerin baskın
   * bileşenleri kesişemez: Mercimek Çorbası + Mercimekli Köfte engellenir.
   */
  mainIngredients?: string[];
  /** 0..1 arası isteğe bağlı tercih puanı; skorlamada küçük bir bonus verir. */
  popularity?: number;
  /**
   * Bu yemekle aynı öğünde tercih edilen yemeklerin id'leri (ör. bir ana yemeğin
   * önerilen çorba/yan/tamamlayıcıları). Sert kural değildir; skorlamada güçlü bonus verir.
   */
  suggestedCompanionIds?: string[];
}

/** Bir öğün: kategori başına en fazla bir yemek. */
export type Meal = Partial<Record<DishCategory, Dish>>;

export interface DayMenu {
  /** YYYY-MM-DD */
  date: string;
  /** 0 = Pazar, 1 = Pazartesi, ... 6 = Cumartesi */
  weekday: number;
  meals: Record<MealSlot, Meal>;
}

export interface MonthlyMenu {
  year: number;
  /** 1-12 (1 = Ocak) */
  month: number;
  /** Aynı seed + aynı havuz + aynı seçenekler = birebir aynı menü. */
  seed: number;
  /** Çözüm kaçıncı denemede bulundu (1 = ilk deneme). */
  attempts: number;
  days: DayMenu[];
  warnings: string[];
}

export const MEAL_SLOTS: readonly MealSlot[] = ['ogle', 'aksam'];

/**
 * Karar sırası: en kısıtlı kategori önce (fail-first). Ana yemek diğer tüm
 * kuralların merkezinde olduğu için önce o seçilir.
 */
export const CATEGORY_ORDER: readonly DishCategory[] = [
  'ana_yemek',
  'yan_urun',
  'çorba',
  'tatli_meyve',
];
