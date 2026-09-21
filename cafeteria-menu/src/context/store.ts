// src/context/store.ts
'use client';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { FoodItem, DailyMenu, CategoryKey, ConflictWarning, PlannerMealKey, MealCourseField, FourCourseMeal, MainMealKey } from '@/types';
import { SEED_DATA } from '@/lib/seedData';
import { generateId, isSameWeek, MONTH_NAMES_TR, parseDate } from '@/lib/utils';
import {
  createEmptyDailyMenu,
  createEmptyFourCourseMeal,
  formatMenuGenerationError,
  generateAutoMonthMenus,
  getAllMenuItemIds,
  MAIN_MEAL_KEYS,
  MEAL_COURSE_FIELDS,
  type GeneratedMonth,
} from '@/lib/menu';

interface Toast {
  id: string;
  type: 'warning' | 'error' | 'success' | 'info';
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
  addFoodItem: (name: string, category: CategoryKey) => void;
  removeFoodItem: (id: string) => void;
  updateFoodItem: (id: string, changes: FoodItemMetadataChanges) => void;

  // Monthly menus
  menus: DailyMenu[];
  setMealCourse: (date: string, mealKey: MainMealKey, field: MealCourseField, itemId: string | null) => void;
  setSnack: (date: string, itemId: string | null) => void;
  clearMenuDay: (date: string, mealKey?: PlannerMealKey) => void;
  generateBalancedMonthMenus: (year: number, month: number) => void;

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
  activeTab: 'planner' | 'pool' | 'export';
  setActiveTab: (tab: 'planner' | 'pool' | 'export') => void;
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
  itemId: string | null
): DailyMenu {
  const updatedMenu: DailyMenu = {
    ...menu,
    [mealKey]: {
      ...menu[mealKey],
      [field]: itemId,
    },
  };

  if (mealKey === 'lunch' && WEEKEND_SYNC_FIELDS.includes(field) && isWeekendDate(date)) {
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

      addFoodItem: (name, category) => {
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
        set((state) => ({
          foodItems: [
            ...state.foodItems,
            { id: generateId(), name: trimmed, category },
          ],
        }));
        get().addToast({ type: 'success', title: 'Eklendi', message: `"${trimmed}" başarıyla eklendi.` });
      },

      updateFoodItem: (id, changes) => {
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
        get().addToast({
          type: 'success',
          title: 'Kaydedildi',
          message: `"${target.name}" için etiketler ve eşlikçiler güncellendi.`,
        });
      },

      removeFoodItem: (id) => {
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
                  ? buildUpdatedMenu(normalizeMenu(m), date, mealKey, field, itemId)
                  : normalizeMenu(m)
              ),
            };
          }
          const newMenu = buildUpdatedMenu(createEmptyDailyMenu(date), date, mealKey, field, itemId);
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

      generateBalancedMonthMenus: (year, month) => {
        const { foodItems, menus } = get();
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

          get().addToast({
            type: 'error',
            title: 'Eksik Ürün Havuzu',
            message: `"${missingLabels[missingCategory]}" kategorisinde ürün olmadığı için otomatik menü oluşturulamadı.`,
          });
          return;
        }

        let generated: GeneratedMonth;
        try {
          generated = generateAutoMonthMenus(
            foodItems,
            year,
            month,
            menus.map((menu) => normalizeMenu(menu))
          );
        } catch (error) {
          console.error('Otomatik menü oluşturulamadı:', error);
          get().addToast({
            type: 'error',
            title: 'Menü Oluşturulamadı',
            message: formatMenuGenerationError(error),
          });
          return;
        }

        const rotatedFoodItems = rotateFoodItemsBySelectionSequence(
          foodItems,
          generated.selectionSequence
        );
        const preservedMenus = menus
          .map((menu) => normalizeMenu(menu))
          .filter((menu) => {
            const menuDate = parseDate(menu.date);
            return !(menuDate.getFullYear() === year && menuDate.getMonth() === month);
          });

        set({
          foodItems: rotatedFoodItems,
          menus: [...preservedMenus, ...generated.menus].sort((left, right) =>
            left.date.localeCompare(right.date)
          ),
        });

        get().addToast({
          type: 'success',
          title: 'Aylık Menü Oluşturuldu',
          message: `${MONTH_NAMES_TR[month]} ${year} için dengeli ve çeşitli aylık menü hazırlandı.`,
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
        }, 5000);
      },

      removeToast: (id) => {
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
      },

      setActiveTab: (tab) => set({ activeTab: tab }),
    }),
    {
      name: 'cafeteria-menu-store',
      version: 3,
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
      }),
    }
  )
);
