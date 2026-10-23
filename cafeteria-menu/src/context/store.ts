// src/context/store.ts
'use client';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  FoodItem, DailyMenu, CategoryKey, ConflictWarning, PlannerMealKey, MealCourseField, FourCourseMeal, MainMealKey,
  LinkedRecipe, RuleSettings, DEFAULT_RULE_SETTINGS, PersonCounts, ActiveTab, KitchenDay, OrderItem,
} from '@/types';
import { emptyKitchenDay, normalizeKitchenDay } from '@/lib/kitchen';
import { SEED_DATA } from '@/lib/seedData';
import { isTagAllowedForCategory } from '@/lib/tags';
import { generateId, isSameWeek, MONTH_NAMES_TR, parseDate } from '@/lib/utils';
import {
  createEmptyDailyMenu,
  createEmptyFourCourseMeal,
  formatMenuGenerationError,
  generateAutoMonthMenus,
  getAllMenuItemIds,
  evaluateCandidates,
  ruleSettingsToOptions,
  getEffectiveTags,
  inferTagsFromName,
  MAIN_MEAL_KEYS,
  MEAL_COURSE_FIELDS,
  type GeneratedMonth,
} from '@/lib/menu';

interface Toast {
  id: string;
  type: 'warning' | 'error' | 'success' | 'info';
  title: string;
  message: string;
  /** Örn. "Geri al" düğmesi. Eylemli bildirimler daha uzun kalır. */
  action?: { label: string; run: () => void };
}

export interface GenerationScope {
  from: string;
  to: string;
}

export interface GenerationError {
  title: string;
  message: string;
}

/** Yemeğin motor tarafından kullanılan metadata alanları. */
export interface FoodItemMetadataChanges {
  tags?: string[];
  mainIngredients?: string[];
  /** Ana yemekler için önerilen eşlikçi yemeklerin kimlikleri. */
  suggestedCompanions?: string[];
}

const cleanList = (values: string[]): string[] =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

interface AppState {
  // Food pools
  foodItems: FoodItem[];
  addFoodItem: (name: string, category: CategoryKey, extra?: FoodItemMetadataChanges) => void;
  removeFoodItem: (id: string) => void;
  /** `silent`: otomatik kaydetmelerde "Kaydedildi" bildirimi çıkmaz. */
  updateFoodItem: (id: string, changes: FoodItemMetadataChanges, options?: { silent?: boolean }) => void;
  /** Seçili yemeklere etiket ekler / çıkarır. Değişen yemek sayısını döndürür. */
  bulkUpdateTags: (ids: string[], addTags: string[], removeTags: string[]) => number;
  /**
   * Seçili ANA YEMEKLERE eşlikçi ekler / çıkarır; `replace: true` ise mevcut listeyi `addIds` ile değiştirir.
   * Yalnızca çorba / yan yemek / tamamlayıcı kimlikleri kabul edilir. Değişen yemek sayısını döndürür.
   */
  bulkUpdateCompanions: (ids: string[], addIds: string[], removeIds: string[], options?: { replace?: boolean }) => number;
  /** Kayıtlı etiketi olmayan yemeklerin isimden tahmin edilen etiketlerini kalıcı yapar. Etkilenen sayıyı döndürür. */
  confirmInferredTags: () => number;
  /** Porsiyon kalorisi (kcal); null/0 temizler. */
  setCalories: (id: string, kcal: number | null) => void;
  /** Ana yemeğin tekrar aralığı (en az kaç gün arayla); null = genel aralığı kullan. */
  setRepeatGap: (id: string, days: number | null) => void;
  /** Mutfaktakip reçetesine bağlar (null = bağı kaldırır). */
  linkRecipe: (id: string, recipeId: string | null) => void;
  /** Mutfaktakip reçete kopyaları (kimlik → reçete). */
  recipes: Record<string, LinkedRecipe>;
  setRecipes: (recipes: Record<string, LinkedRecipe>) => void;
  /** Reçete ekler/günceller (id yoksa üretir). Kaydedilen reçeteyi döndürür. */
  saveRecipe: (recipe: Omit<LinkedRecipe, 'id'> & { id?: string }) => LinkedRecipe;
  /** Reçeteyi siler; yemeklerdeki bağlantı ve mutfak günlerindeki seçimler de temizlenir. */
  deleteRecipe: (id: string) => void;

  // Mutfak günlük rapor
  kitchenDays: Record<string, KitchenDay>;
  /** Günü kopyalayıp `mutate` ile değiştirir ve kaydeder (gün yoksa varsayılan kişi sayılarıyla oluşturur). */
  updateKitchenDay: (date: string, mutate: (day: KitchenDay) => void) => void;
  setKitchenDays: (days: Record<string, KitchenDay>) => void;

  // Sipariş
  orderItems: OrderItem[];
  orderPool: string[];
  addOrderItems: (items: OrderItem[]) => void;
  removeOrderItem: (index: number) => void;
  clearOrder: () => void;
  addToOrderPool: (names: string[]) => void;
  removeFromOrderPool: (index: number) => void;

  // Monthly menus
  menus: DailyMenu[];
  setMealCourse: (date: string, mealKey: MainMealKey, field: MealCourseField, itemId: string | null) => void;
  setSnack: (date: string, itemId: string | null) => void;
  clearMenuDay: (date: string, mealKey?: PlannerMealKey) => void;
  /** `scope` verilirse yalnızca o tarih aralığı (ör. bir hafta) yeniden üretilir; kilitli günler her zaman korunur. */
  generateBalancedMonthMenus: (year: number, month: number, scope?: GenerationScope) => void;
  /** Tek bir yemeği kurallara uygun bir başkasıyla değiştirir. Yeni yemeğin kimliğini döndürür. */
  replaceCourse: (date: string, mealKey: MainMealKey, field: MealCourseField) => string | null;
  lockedDates: string[];
  toggleLockDay: (date: string) => void;
  generationError: GenerationError | null;
  clearGenerationError: () => void;

  // Ayarlar
  ruleSettings: RuleSettings;
  setRuleSettings: (changes: Partial<RuleSettings>) => void;
  persons: PersonCounts;
  setPersons: (changes: Partial<PersonCounts>) => void;

  // Current month navigation
  currentYear: number;
  currentMonth: number;
  setCurrentMonth: (year: number, month: number) => void;

  // Conflict detection
  checkConflicts: (date: string, mealKey: MainMealKey, mainCourseId: string) => ConflictWarning[];

  // Toasts
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;

  // Active tab
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}

type LegacyDailyMenu = {
  date: string;
  soup?: string | null;
  mainCourse?: string | null;
  sideDish?: string | null;
  complement?: string | null;
};

const WEEKEND_SYNC_FIELDS: MealCourseField[] = ['soup', 'sideDish', 'complement'];

function isWeekendDate(date: string): boolean {
  const dayOfWeek = parseDate(date).getDay();
  return dayOfWeek === 0 || dayOfWeek === 6;
}

function buildUpdatedMenu(
  menu: DailyMenu,
  date: string,
  mealKey: MainMealKey,
  field: MealCourseField,
  itemId: string | null,
  weekendSync = true
): DailyMenu {
  const updatedMenu: DailyMenu = {
    ...menu,
    [mealKey]: {
      ...menu[mealKey],
      [field]: itemId,
    },
  };

  if (weekendSync && mealKey === 'lunch' && WEEKEND_SYNC_FIELDS.includes(field) && isWeekendDate(date)) {
    updatedMenu.dinner = {
      ...updatedMenu.dinner,
      [field]: itemId,
    };
  }

  return updatedMenu;
}

function isFourCourseMeal(value: unknown): value is FourCourseMeal {
  if (!value || typeof value !== 'object') return false;
  return MEAL_COURSE_FIELDS.every((field) => field in (value as Record<string, unknown>));
}

function isCurrentDailyMenu(menu: DailyMenu | LegacyDailyMenu): menu is DailyMenu {
  return 'lunch' in menu && isFourCourseMeal(menu.lunch);
}

function normalizeMenu(menu: DailyMenu | LegacyDailyMenu): DailyMenu {
  if (isCurrentDailyMenu(menu)) {
    const dinner = 'dinner' in menu && isFourCourseMeal(menu.dinner) ? menu.dinner : createEmptyFourCourseMeal();
    return {
      date: menu.date,
      lunch: {
        soup: menu.lunch.soup ?? null,
        mainCourse: menu.lunch.mainCourse ?? null,
        sideDish: menu.lunch.sideDish ?? null,
        complement: menu.lunch.complement ?? null,
      },
      dinner: {
        soup: dinner.soup ?? null,
        mainCourse: dinner.mainCourse ?? null,
        sideDish: dinner.sideDish ?? null,
        complement: dinner.complement ?? null,
      },
      snack: 'snack' in menu ? menu.snack ?? null : null,
    };
  }

  const legacyMenu = menu as LegacyDailyMenu;
  return {
    date: legacyMenu.date,
    lunch: {
      soup: legacyMenu.soup ?? null,
      mainCourse: legacyMenu.mainCourse ?? null,
      sideDish: legacyMenu.sideDish ?? null,
      complement: legacyMenu.complement ?? null,
    },
    dinner: createEmptyFourCourseMeal(),
    snack: null,
  };
}

/**
 * Sonradan varsayılan havuza eklenen yemekler. Kayıtlı (localStorage) havuzu eski olan
 * kullanıcılara da eklenir: pratik ana yemekler (hafta sonu öğle kuralı) ve
 * hamur işlerine eşlik edebilen pilav/makarna dışı yan yemekler.
 */
const REQUIRED_DEFAULT_SEED_IDS = new Set([
  'm19', 'm20',
  'm21', 'm22', 'm23', 'm24', 'm25', 'm26', 'm27',
  'd11', 'd12', 'd13', 'd14',
]);

function normalizeFoodItems(foodItems: FoodItem[] | undefined): FoodItem[] {
  const existing = foodItems ?? [];
  if (existing.length === 0) return SEED_DATA;

  const requiredDefaultSeedItems = SEED_DATA.filter(
    (item) => item.category === 'snacks' || REQUIRED_DEFAULT_SEED_IDS.has(item.id)
  );
  const missingDefaultItems = requiredDefaultSeedItems.filter(
    (seedItem) =>
      !existing.some(
        (item) =>
          item.category === seedItem.category &&
          item.name.toLowerCase() === seedItem.name.toLowerCase()
      )
  );

  return [...existing, ...missingDefaultItems];
}

const CATEGORY_KEYS: CategoryKey[] = ['soups', 'mainCourses', 'sideDishes', 'complements', 'snacks'];

type CategoryPools = Record<CategoryKey, FoodItem[]>;

function createCategoryPools(foodItems: FoodItem[]): CategoryPools {
  return {
    soups: foodItems.filter((item) => item.category === 'soups'),
    mainCourses: foodItems.filter((item) => item.category === 'mainCourses'),
    sideDishes: foodItems.filter((item) => item.category === 'sideDishes'),
    complements: foodItems.filter((item) => item.category === 'complements'),
    snacks: foodItems.filter((item) => item.category === 'snacks'),
  };
}

function moveItemToCategoryEnd(foodItems: FoodItem[], itemId: string): FoodItem[] {
  const targetItem = foodItems.find((item) => item.id === itemId);
  if (!targetItem) return foodItems;

  const categoryItems = foodItems.filter((item) => item.category === targetItem.category);
  const otherItems = foodItems.filter((item) => item.category !== targetItem.category);
  const reorderedCategoryItems = [
    ...categoryItems.filter((item) => item.id !== itemId),
    targetItem,
  ];

  return CATEGORY_KEYS.flatMap((category) =>
    category === targetItem.category
      ? reorderedCategoryItems
      : otherItems.filter((item) => item.category === category)
  );
}

function rotateFoodItemsBySelectionSequence(foodItems: FoodItem[], selectionSequence: string[]): FoodItem[] {
  return selectionSequence.reduce(
    (currentFoodItems, itemId) => moveItemToCategoryEnd(currentFoodItems, itemId),
    foodItems
  );
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      foodItems: SEED_DATA,
      menus: [],
      currentYear: new Date().getFullYear(),
      currentMonth: new Date().getMonth(),
      toasts: [],
      activeTab: 'planner',
      recipes: {},
      kitchenDays: {},
      orderItems: [],
      orderPool: [],
      lockedDates: [],
      generationError: null,
      ruleSettings: DEFAULT_RULE_SETTINGS,
      persons: { lunch: 100, dinner: 100 },

      addFoodItem: (name, category, extra) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        // Prevent duplicate names in the same category
        const exists = get().foodItems.some(
          (f) => f.category === category && f.name.toLowerCase() === trimmed.toLowerCase()
        );
        if (exists) {
          get().addToast({ type: 'error', title: 'Zaten Mevcut', message: `"${trimmed}" bu kategoride zaten var.` });
          return;
        }
        const tags = extra?.tags ? cleanList(extra.tags) : [];
        const mainIngredients = extra?.mainIngredients ? cleanList(extra.mainIngredients) : [];
        set((state) => ({
          foodItems: [
            ...state.foodItems,
            {
              id: generateId(),
              name: trimmed,
              category,
              ...(tags.length > 0 ? { tags } : {}),
              ...(mainIngredients.length > 0 ? { mainIngredients } : {}),
            },
          ],
        }));
        get().addToast({ type: 'success', title: 'Eklendi', message: `"${trimmed}" başarıyla eklendi.` });
      },

      updateFoodItem: (id, changes, options) => {
        const target = get().foodItems.find((item) => item.id === id);
        if (!target) return;
        set((state) => ({
          foodItems: state.foodItems.map((item) =>
            item.id === id
              ? {
                  ...item,
                  ...(changes.tags !== undefined ? { tags: cleanList(changes.tags) } : {}),
                  ...(changes.mainIngredients !== undefined
                    ? { mainIngredients: cleanList(changes.mainIngredients) }
                    : {}),
                  ...(changes.suggestedCompanions !== undefined
                    ? { suggestedCompanions: cleanList(changes.suggestedCompanions) }
                    : {}),
                }
              : item
          ),
        }));
        if (!options?.silent) {
          get().addToast({
            type: 'success',
            title: 'Kaydedildi',
            message: `"${target.name}" için etiketler ve eşlikçiler güncellendi.`,
          });
        }
      },

      bulkUpdateTags: (ids, addTags, removeTags) => {
        const idSet = new Set(ids);
        const toAdd = cleanList(addTags);
        const toRemove = new Set(cleanList(removeTags));
        let changed = 0;
        set((state) => ({
          foodItems: state.foodItems.map((item) => {
            if (!idSet.has(item.id) || item.category === 'snacks') return item;
            const base = getEffectiveTags(item);
            const next = cleanList([
              ...base.filter((tag) => !toRemove.has(tag)),
              ...toAdd.filter((tag) => isTagAllowedForCategory(tag, item.category)),
            ]);
            const unchanged =
              item.tags !== undefined &&
              item.tags.length === next.length &&
              next.every((tag) => item.tags!.includes(tag));
            if (unchanged) return item;
            changed += 1;
            return { ...item, tags: next };
          }),
        }));
        return changed;
      },

      bulkUpdateCompanions: (ids, addIds, removeIds, options) => {
        const idSet = new Set(ids);
        const COMPANION_CATEGORIES: CategoryKey[] = ['soups', 'sideDishes', 'complements'];
        const validIds = new Set(
          get().foodItems.filter((f) => COMPANION_CATEGORIES.includes(f.category)).map((f) => f.id)
        );
        const toAdd = cleanList(addIds).filter((id) => validIds.has(id));
        const toRemove = new Set(cleanList(removeIds));
        let changed = 0;
        set((state) => ({
          foodItems: state.foodItems.map((item) => {
            if (!idSet.has(item.id) || item.category !== 'mainCourses') return item;
            const current = (item.suggestedCompanions ?? []).filter((id) => validIds.has(id));
            const base = options?.replace ? [] : current.filter((id) => !toRemove.has(id));
            const next = cleanList([...base, ...toAdd]);
            const unchanged =
              (item.suggestedCompanions ?? []).length === next.length &&
              next.every((id) => item.suggestedCompanions!.includes(id));
            if (unchanged) return item;
            changed += 1;
            return { ...item, suggestedCompanions: next };
          }),
        }));
        return changed;
      },

      confirmInferredTags: () => {
        let confirmed = 0;
        set((state) => ({
          foodItems: state.foodItems.map((item) => {
            if (item.category === 'snacks' || item.tags?.length) return item;
            const inferred = inferTagsFromName(item);
            if (inferred.length === 0) return item;
            confirmed += 1;
            return { ...item, tags: inferred };
          }),
        }));
        return confirmed;
      },

      setCalories: (id, kcal) => {
        const value = kcal && Number.isFinite(kcal) && kcal > 0 ? Math.round(kcal) : undefined;
        set((state) => ({
          foodItems: state.foodItems.map((item) => {
            if (item.id !== id) return item;
            const { calories: _old, ...rest } = item;
            void _old;
            return value ? { ...rest, calories: value } : rest;
          }),
        }));
      },

      setRepeatGap: (id, days) => {
        const value = days && Number.isFinite(days) && days >= 1 ? Math.min(60, Math.round(days)) : undefined;
        set((state) => ({
          foodItems: state.foodItems.map((item) => {
            if (item.id !== id) return item;
            const { repeatGapDays: _old, ...rest } = item;
            void _old;
            return value ? { ...rest, repeatGapDays: value } : rest;
          }),
        }));
      },

      linkRecipe: (id, recipeId) => {
        set((state) => ({
          foodItems: state.foodItems.map((item) => {
            if (item.id !== id) return item;
            const { recipeId: _old, ...rest } = item;
            void _old;
            return recipeId ? { ...rest, recipeId } : rest;
          }),
        }));
      },

      saveRecipe: (input) => {
        const id = input.id ?? `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        const recipe: LinkedRecipe = { id, name: input.name, cat: input.cat, ings: input.ings };
        set((state) => ({ recipes: { ...state.recipes, [id]: recipe } }));
        return recipe;
      },

      deleteRecipe: (id) =>
        set((state) => {
          const { [id]: _removed, ...rest } = state.recipes;
          void _removed;
          const kitchenDays = Object.fromEntries(
            Object.entries(state.kitchenDays).map(([date, day]) => {
              const d = normalizeKitchenDay(day, state.persons);
              (Object.keys(d.meals) as (keyof KitchenDay['meals'])[]).forEach((k) => {
                d.meals[k] = d.meals[k].filter((x) => x !== id);
              });
              return [date, d];
            })
          );
          return {
            recipes: rest,
            kitchenDays,
            foodItems: state.foodItems.map((item) => {
              if (item.recipeId !== id) return item;
              const { recipeId: _r, ...others } = item;
              void _r;
              return others;
            }),
          };
        }),

      updateKitchenDay: (date, mutate) =>
        set((state) => {
          const current = state.kitchenDays[date];
          const day: KitchenDay = current
            ? (JSON.parse(JSON.stringify(normalizeKitchenDay(current, state.persons))) as KitchenDay)
            : emptyKitchenDay(state.persons);
          mutate(day);
          return { kitchenDays: { ...state.kitchenDays, [date]: day } };
        }),

      setKitchenDays: (days) => set({ kitchenDays: days }),

      addOrderItems: (items) =>
        set((state) => {
          const list = state.orderItems.map((o) => ({ ...o }));
          const pool = [...state.orderPool];
          items.forEach((item) => {
            const name = item.name.trim();
            if (!name || !(item.qty > 0)) return;
            const found = list.find((o) => o.name.toLocaleLowerCase('tr-TR') === name.toLocaleLowerCase('tr-TR') && o.unit === item.unit);
            if (found) found.qty += item.qty;
            else list.push({ name, qty: item.qty, unit: item.unit });
            if (!pool.some((p) => p.toLocaleLowerCase('tr-TR') === name.toLocaleLowerCase('tr-TR'))) pool.push(name);
          });
          return { orderItems: list, orderPool: pool.sort((a, b) => a.localeCompare(b, 'tr')) };
        }),

      removeOrderItem: (index) => set((state) => ({ orderItems: state.orderItems.filter((_, i) => i !== index) })),

      clearOrder: () => set({ orderItems: [] }),

      addToOrderPool: (names) =>
        set((state) => {
          const pool = [...state.orderPool];
          names.forEach((raw) => {
            const name = raw.trim();
            if (name && !pool.some((p) => p.toLocaleLowerCase('tr-TR') === name.toLocaleLowerCase('tr-TR'))) pool.push(name);
          });
          return { orderPool: pool.sort((a, b) => a.localeCompare(b, 'tr')) };
        }),

      removeFromOrderPool: (index) => set((state) => ({ orderPool: state.orderPool.filter((_, i) => i !== index) })),

      setRecipes: (recipes) => set({ recipes }),

      toggleLockDay: (date) =>
        set((state) => ({
          lockedDates: state.lockedDates.includes(date)
            ? state.lockedDates.filter((d) => d !== date)
            : [...state.lockedDates, date].sort(),
        })),

      clearGenerationError: () => set({ generationError: null }),

      setRuleSettings: (changes) =>
        set((state) => ({ ruleSettings: { ...state.ruleSettings, ...changes } })),

      setPersons: (changes) => set((state) => ({ persons: { ...state.persons, ...changes } })),

      replaceCourse: (date, mealKey, field) => {
        const { foodItems, menus, ruleSettings } = get();
        const { ranked } = evaluateCandidates(
          foodItems,
          menus.map((menu) => normalizeMenu(menu)),
          date,
          mealKey,
          field,
          ruleSettingsToOptions(ruleSettings)
        );
        if (ranked.length === 0) {
          get().addToast({
            type: 'warning',
            title: 'Uygun alternatif yok',
            message: 'Bu yuva için kurallara uyan başka bir yemek bulunamadı. Havuza yemek ekleyin veya kuralları gevşetin.',
          });
          return null;
        }
        // En iyi 3 aday arasından seç: art arda basınca farklı öneriler gelsin.
        const pick = ranked[Math.floor(Math.random() * Math.min(3, ranked.length))];
        get().setMealCourse(date, mealKey, field, pick);
        return pick;
      },

      removeFoodItem: (id) => {
        const before = { foodItems: get().foodItems, menus: get().menus.map((m) => normalizeMenu(m)) };
        const target = before.foodItems.find((f) => f.id === id);
        const targetIndex = before.foodItems.findIndex((f) => f.id === id);
        // Also clear from menus
        set((state) => ({
          // Silinen yemeği öneri listelerinden de çıkar (boşta kalan kimlik kalmasın).
          foodItems: state.foodItems
            .filter((f) => f.id !== id)
            .map((f) =>
              f.suggestedCompanions?.includes(id)
                ? { ...f, suggestedCompanions: f.suggestedCompanions.filter((companionId) => companionId !== id) }
                : f
            ),
          menus: state.menus.map((menu) => {
            const normalizedMenu = normalizeMenu(menu);
            if (!getAllMenuItemIds(normalizedMenu).includes(id)) return normalizedMenu;

            return {
              ...normalizedMenu,
              lunch: {
                soup: normalizedMenu.lunch.soup === id ? null : normalizedMenu.lunch.soup,
                mainCourse: normalizedMenu.lunch.mainCourse === id ? null : normalizedMenu.lunch.mainCourse,
                sideDish: normalizedMenu.lunch.sideDish === id ? null : normalizedMenu.lunch.sideDish,
                complement: normalizedMenu.lunch.complement === id ? null : normalizedMenu.lunch.complement,
              },
              dinner: {
                soup: normalizedMenu.dinner.soup === id ? null : normalizedMenu.dinner.soup,
                mainCourse: normalizedMenu.dinner.mainCourse === id ? null : normalizedMenu.dinner.mainCourse,
                sideDish: normalizedMenu.dinner.sideDish === id ? null : normalizedMenu.dinner.sideDish,
                complement: normalizedMenu.dinner.complement === id ? null : normalizedMenu.dinner.complement,
              },
              snack: normalizedMenu.snack === id ? null : normalizedMenu.snack,
            };
          }),
        }));

        if (!target) return;
        get().addToast({
          type: 'info',
          title: 'Silindi',
          message: `"${target.name}" havuzdan ve menülerden kaldırıldı.`,
          action: {
            label: 'Geri al',
            run: () => {
              set((state) => {
                if (state.foodItems.some((f) => f.id === id)) return {};
                const restored = [...state.foodItems];
                restored.splice(Math.min(targetIndex, restored.length), 0, target);
                const withCompanions = restored.map((f) => {
                  const was = before.foodItems.find((b) => b.id === f.id);
                  return was?.suggestedCompanions?.includes(id) && !f.suggestedCompanions?.includes(id)
                    ? { ...f, suggestedCompanions: [...(f.suggestedCompanions ?? []), id] }
                    : f;
                });
                const byDate = new Map(state.menus.map((m) => [m.date, normalizeMenu(m)]));
                for (const old of before.menus) {
                  if (!getAllMenuItemIds(old).includes(id)) continue;
                  const current = byDate.get(old.date) ?? createEmptyDailyMenu(old.date);
                  const next: DailyMenu = {
                    ...current,
                    lunch: { ...current.lunch },
                    dinner: { ...current.dinner },
                  };
                  for (const mealKey of MAIN_MEAL_KEYS) {
                    for (const field of MEAL_COURSE_FIELDS) {
                      if (old[mealKey][field] === id && !next[mealKey][field]) next[mealKey][field] = id;
                    }
                  }
                  if (old.snack === id && !next.snack) next.snack = id;
                  byDate.set(old.date, next);
                }
                return {
                  foodItems: withCompanions,
                  menus: Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date)),
                };
              });
            },
          },
        });
      },

      setMealCourse: (date, mealKey, field, itemId) => {
        set((state) => {
          const existing = state.menus.find((m) => m.date === date);
          const nextFoodItems = itemId ? moveItemToCategoryEnd(state.foodItems, itemId) : state.foodItems;

          if (existing) {
            return {
              foodItems: nextFoodItems,
              menus: state.menus.map((m) =>
                m.date === date
                  ? buildUpdatedMenu(normalizeMenu(m), date, mealKey, field, itemId, get().ruleSettings.weekendSync)
                  : normalizeMenu(m)
              ),
            };
          }
          const newMenu = buildUpdatedMenu(createEmptyDailyMenu(date), date, mealKey, field, itemId, get().ruleSettings.weekendSync);
          return {
            foodItems: nextFoodItems,
            menus: [...state.menus, newMenu],
          };
        });

        // Check conflicts for main course
        if (field === 'mainCourse' && itemId) {
          const conflicts = get().checkConflicts(date, mealKey, itemId);
          if (conflicts.length > 0) {
            const c = conflicts[0];
            const scopeText =
              c.conflictType === 'daily'
                ? 'aynı günde'
                : c.conflictType === 'weekly'
                ? 'aynı haftada'
                : 'aynı ayda';
            const conflictDates = c.conflicts
              .map((entry) => `${entry.date} (${entry.mealKey === 'lunch' ? 'Öğle' : 'Akşam'})`)
              .join(', ');
            get().addToast({
              type: 'warning',
              title:
                c.conflictType === 'daily'
                  ? '⚠️ Tekrar Uyarısı: Aynı Gün'
                  : c.conflictType === 'weekly'
                  ? '⚠️ Tekrar Uyarısı: Aynı Hafta'
                  : '⚠️ Tekrar Uyarısı: Aynı Ay',
              message: `"${c.itemName}" ${scopeText} zaten planlandı: ${conflictDates}`,
            });
          }
        }
      },

      setSnack: (date, itemId) => {
        set((state) => {
          const existing = state.menus.find((m) => m.date === date);
          const nextFoodItems = itemId ? moveItemToCategoryEnd(state.foodItems, itemId) : state.foodItems;

          if (existing) {
            return {
              foodItems: nextFoodItems,
              menus: state.menus.map((m) =>
                m.date === date ? { ...normalizeMenu(m), snack: itemId } : normalizeMenu(m)
              ),
            };
          }
          const newMenu = createEmptyDailyMenu(date);
          newMenu.snack = itemId;
          return {
            foodItems: nextFoodItems,
            menus: [...state.menus, newMenu],
          };
        });
      },

      clearMenuDay: (date, mealKey) => {
        set((state) => ({
          menus: state.menus
            .map((menu) => normalizeMenu(menu))
            .flatMap((menu) => {
              if (menu.date !== date) return [menu];

              if (!mealKey) return [];

              const cleared: DailyMenu =
                mealKey === 'snack'
                  ? { ...menu, snack: null }
                  : { ...menu, [mealKey]: createEmptyFourCourseMeal() };

              const stillHasItems = getAllMenuItemIds(cleared).length > 0;
              return stillHasItems ? [cleared] : [];
            }),
        }));
      },

      generateBalancedMonthMenus: (year, month, scope) => {
        const { foodItems, menus, lockedDates, ruleSettings } = get();
        const pools = createCategoryPools(foodItems);
        const missingCategory = CATEGORY_KEYS.find((category) => pools[category].length === 0);

        if (missingCategory) {
          const missingLabels: Record<CategoryKey, string> = {
            soups: 'Çorbalar',
            mainCourses: 'Ana Yemekler',
            sideDishes: 'Yan Yemekler',
            complements: 'Tamamlayıcılar',
            snacks: 'Ara Öğünler',
          };
          const error = {
            title: 'Eksik Ürün Havuzu',
            message: `"${missingLabels[missingCategory]}" kategorisinde ürün olmadığı için otomatik menü oluşturulamadı.`,
          };
          set({ generationError: error });
          get().addToast({ type: 'error', ...error });
          return;
        }

        const normalized = menus.map((menu) => normalizeMenu(menu));
        const daysInThisMonth = new Date(year, month + 1, 0).getDate();
        const monthDates = Array.from({ length: daysInThisMonth }, (_, i) => {
          const d = new Date(year, month, i + 1, 12);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        });
        // Dondurulacak günler: kilitli günler + (kapsam verildiyse) kapsam dışındaki günler.
        const frozenDates = monthDates.filter(
          (date) => lockedDates.includes(date) || (scope ? date < scope.from || date > scope.to : false)
        );

        let generated: GeneratedMonth;
        try {
          generated = generateAutoMonthMenus(
            foodItems,
            year,
            month,
            normalized,
            ruleSettingsToOptions(ruleSettings),
            frozenDates
          );
        } catch (error) {
          console.error('Otomatik menü oluşturulamadı:', error);
          const failure = { title: 'Menü Oluşturulamadı', message: formatMenuGenerationError(error) };
          set({ generationError: failure });
          get().addToast({ type: 'error', ...failure });
          return;
        }

        const rotatedFoodItems = rotateFoodItemsBySelectionSequence(
          foodItems,
          generated.selectionSequence
        );
        const preservedMenus = normalized.filter((menu) => {
          const menuDate = parseDate(menu.date);
          return !(menuDate.getFullYear() === year && menuDate.getMonth() === month);
        });

        set({
          foodItems: rotatedFoodItems,
          generationError: null,
          menus: [...preservedMenus, ...generated.menus].sort((left, right) =>
            left.date.localeCompare(right.date)
          ),
        });

        const lockedInMonth = frozenDates.filter((d) => lockedDates.includes(d)).length;
        get().addToast({
          type: 'success',
          title: scope ? 'Seçili Aralık Yenilendi' : 'Aylık Menü Oluşturuldu',
          message: scope
            ? `${scope.from} – ${scope.to} aralığı yeniden oluşturuldu${lockedInMonth ? `; ${lockedInMonth} kilitli gün korundu` : ''}.`
            : `${MONTH_NAMES_TR[month]} ${year} için dengeli ve çeşitli aylık menü hazırlandı${lockedInMonth ? `; ${lockedInMonth} kilitli gün korundu` : ''}.`,
        });

        if (generated.warnings.length > 0) {
          get().addToast({
            type: 'info',
            title: 'Menü Hakkında Not',
            message: generated.warnings.join(' '),
          });
        }
      },

      setCurrentMonth: (year, month) => set({ currentYear: year, currentMonth: month }),

      checkConflicts: (date, mealKey, mainCourseId) => {
        const { menus, foodItems } = get();
        const item = foodItems.find((f) => f.id === mainCourseId);
        if (!item) return [];

        const conflicts: ConflictWarning[] = [];
        const targetDate = parseDate(date);
        const targetMonth = targetDate.getMonth();
        const targetYear = targetDate.getFullYear();

        const allConflicts = menus
          .map((menu) => normalizeMenu(menu))
          .flatMap((menu) =>
            MAIN_MEAL_KEYS.flatMap((candidateMealKey) =>
              menu[candidateMealKey].mainCourse === mainCourseId &&
              !(menu.date === date && candidateMealKey === mealKey)
                ? [{ date: menu.date, mealKey: candidateMealKey }]
                : []
            )
          );

        const dailyConflicts = allConflicts.filter((entry) => entry.date === date);
        const weeklyConflicts = allConflicts.filter((entry) => isSameWeek(date, entry.date));
        const monthlyConflicts = allConflicts.filter((entry) => {
          const d = parseDate(entry.date);
          return d.getMonth() === targetMonth && d.getFullYear() === targetYear;
        });

        if (dailyConflicts.length > 0) {
          conflicts.push({
            itemId: mainCourseId,
            itemName: item.name,
            conflictType: 'daily',
            conflicts: dailyConflicts,
          });
        } else if (weeklyConflicts.length > 0) {
          conflicts.push({
            itemId: mainCourseId,
            itemName: item.name,
            conflictType: 'weekly',
            conflicts: weeklyConflicts,
          });
        } else if (monthlyConflicts.length > 0) {
          conflicts.push({
            itemId: mainCourseId,
            itemName: item.name,
            conflictType: 'monthly',
            conflicts: monthlyConflicts,
          });
        }

        return conflicts;
      },

      addToast: (toast) => {
        const id = generateId();
        set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
        setTimeout(() => {
          get().removeToast(id);
        }, toast.action ? 9000 : 5000);
      },

      removeToast: (id) => {
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
      },

      setActiveTab: (tab) => set({ activeTab: tab }),
    }),
    {
      name: 'cafeteria-menu-store',
      version: 4,
      storage: createJSONStorage(() => (typeof window !== 'undefined' ? localStorage : { getItem: () => null, setItem: () => {}, removeItem: () => {} })),
      migrate: (persistedState: unknown) => {
        if (!persistedState || typeof persistedState !== 'object') return persistedState;

        const state = persistedState as {
          foodItems?: FoodItem[];
          menus?: (DailyMenu | LegacyDailyMenu)[];
          currentYear?: number;
          currentMonth?: number;
        };

        return {
          ...state,
          foodItems: normalizeFoodItems(state.foodItems),
          menus: (state.menus ?? []).map((menu) => normalizeMenu(menu)),
        };
      },
      partialize: (state) => ({
        foodItems: state.foodItems,
        menus: state.menus,
        currentYear: state.currentYear,
        currentMonth: state.currentMonth,
        recipes: state.recipes,
        kitchenDays: state.kitchenDays,
        orderItems: state.orderItems,
        orderPool: state.orderPool,
        lockedDates: state.lockedDates,
        ruleSettings: state.ruleSettings,
        persons: state.persons,
      }),
    }
  )
);
