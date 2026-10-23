// src/types/index.ts

export type CategoryKey = 'soups' | 'mainCourses' | 'sideDishes' | 'complements' | 'snacks';

export type MainMealKey = 'lunch' | 'dinner';
export type PlannerMealKey = MainMealKey | 'snack';
export type MealCourseField = 'soup' | 'mainCourse' | 'sideDish' | 'complement';

export interface FoodItem {
  id: string;
  name: string;
  category: CategoryKey;
  tags?: string[];
  /** Aynı öğünde bu etiketleri taşıyan yemeklerle birlikte seçilmez (otomatik menü motoru). */
  incompatibleWithTags?: string[];
  /** Baskın bileşenler (ör. ['mercimek']). Aynı öğünde çakışan bileşen engellenir. */
  mainIngredients?: string[];
  /**
   * Yalnızca ana yemekler için: yanına önerilen çorba / yan yemek / tamamlayıcıların kimlikleri.
   * Otomatik menü, her kategoride bu listeden birini tercih eder (kurallara aykırı değilse).
   */
  suggestedCompanions?: string[];
  /** Porsiyon başına kalori (kcal). Elle girilir. */
  calories?: number;
  /**
   * Yalnızca ana yemekler: bu yemek en az kaç gün arayla çıksın (ör. 14 = iki haftada bir).
   * Boşsa genel ana yemek aralığı (Ayarlar → Menü Kuralları) geçerlidir.
   */
  repeatGapDays?: number;
  /** Mutfaktakip reçete kimliği (varsa malzeme listesi bu reçeteden hesaplanır). */
  recipeId?: string;
}

/** Mutfaktakip reçetesindeki bir malzeme (miktar KİŞİ BAŞI). */
export interface RecipeIngredient {
  name: string;
  amt: number;
  unit: string;
}

/** Mutfaktakip'ten alınan reçetenin yerel kopyası. */
export interface LinkedRecipe {
  id: string;
  name: string;
  cat?: string;
  ings: RecipeIngredient[];
}

/** Menü üretici kural ayarları (arayüzden değiştirilebilir). */
export interface RuleSettings {
  /** Aynı ana yemek kaç gün tekrar edemez. */
  mainCooldownDays: number;
  /** Aynı protein en fazla kaç gün üst üste. */
  maxConsecutiveProteinDays: number;
  /** Hafta sonu akşam çorba/yan/tamamlayıcı öğleyle aynı olsun. */
  weekendSync: boolean;
  /** Ana yemeğin eşlikçi listesi zorunlu olsun. */
  requireCompanions: boolean;
  /**
   * Haftanın günlerine göre yasaklı etiketler. Anahtar: 0 = Pazar … 6 = Cumartesi.
   * Ör. { "1": ["tavuk"] } → Pazartesi günleri tavuklu yemek çıkmaz. Eski kayıtlarda alan olmayabilir.
   */
  weekdayBans?: Record<string, string[]>;
  /** Adil dağıtım: bir yemek ayda ortalamanın çok üstünde çıkmasın. Varsayılan kapalı. */
  fairRotation?: boolean;
  /** Adil paydan kaç fazla tekrara izin verilsin (0 = tam eşit dağıtım). */
  rotationSlack?: number;
  /** Çorba / yan yemek / tamamlayıcı için bekleme süresi (gün); 0 = kapalı. */
  sideCooldownDays?: number;
}

export const DEFAULT_RULE_SETTINGS: RuleSettings = {
  mainCooldownDays: 5,
  maxConsecutiveProteinDays: 2,
  weekendSync: true,
  requireCompanions: true,
  weekdayBans: {},
  fairRotation: false,
  rotationSlack: 1,
  sideCooldownDays: 0,
};

/** Malzeme / üretim listesi için kişi sayıları. */
export interface PersonCounts {
  lunch: number;
  dinner: number;
}

export interface FourCourseMeal {
  soup: string | null;
  mainCourse: string | null;
  sideDish: string | null;
  complement: string | null;
}

export interface DailyMenu {
  date: string; // ISO date string YYYY-MM-DD
  lunch: FourCourseMeal;
  dinner: FourCourseMeal;
  snack: string | null; // FoodItem id
}

export interface ConflictEntry {
  date: string;
  mealKey: MainMealKey;
}

export interface ConflictWarning {
  itemId: string;
  itemName: string;
  conflictType: 'daily' | 'weekly' | 'monthly';
  conflicts: ConflictEntry[];
}

export interface CategoryMeta {
  key: CategoryKey;
  label: string;
  labelTR: string;
  color: string;
  accent: string;
  icon: string;
}

export type ViewMode = 'calendar' | 'list';
export type ActiveTab = 'planner' | 'pool' | 'kitchen' | 'order' | 'settings';

// --- MUTFAK (günlük tüketim raporu) -----------------------------------------

export type KitchenMealKey = 'kahvalti' | 'ogle' | 'aksam' | 'ara';
export type KitchenCardKey = KitchenMealKey | 'firin';

/** Raporda / günlük hesapta bir malzeme satırı. */
export interface KitchenLine {
  name: string;
  qty: number;
  unit: string;
}

/** Mutfaktakip `kt_days` kaydıyla uyumludur (içe aktarma doğrudan çalışır). */
export interface KitchenDay {
  lunch: number;
  dinner: number;
  /** Her öğünün hangi kişi sayısını kullandığı. */
  basis: Record<KitchenMealKey, 'lunch' | 'dinner'>;
  /** Menüden gelenlere EK olarak elle seçilen reçeteler. */
  meals: Record<KitchenMealKey, string[]>;
  /** Fırın ürünleri (ekmek, simit…). */
  firin: { name: string; amt: number; unit: string }[];
  /** Öğüne eklenen doğrudan tüketim ürünleri (süt, meyve suyu…). */
  direkt: { name: string; amt: number; unit: string; meal?: KitchenMealKey }[];
  /** Elle düzenlenen rapor kartları (yoksa menüden hesaplanır). */
  report: Partial<Record<KitchenCardKey, KitchenLine[]>>;
}

// --- SİPARİŞ ------------------------------------------------------------------

export const ORDER_UNITS = ['Adet', 'kg', 'L', 'Paket', 'Kutu', 'Koli', 'Çuval'] as const;
export type OrderUnit = (typeof ORDER_UNITS)[number];

export interface OrderItem {
  name: string;
  qty: number;
  unit: string;
}
