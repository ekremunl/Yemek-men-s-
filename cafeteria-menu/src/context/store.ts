// src/context/store.ts
'use client';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { FoodItem, DailyMenu, CategoryKey, ConflictWarning, PlannerMealKey, MealCourseField, FourCourseMeal, MainMealKey } from '@/types';
import { SEED_DATA } from '@/lib/seedData';
import { generateId, getMonthDayEntries, isSameWeek, MONTH_NAMES_TR, parseDate } from '@/lib/utils';
import { COURSE_TO_CATEGORY_KEY, createEmptyDailyMenu, createEmptyFourCourseMeal, getAllMenuItemIds, MAIN_MEAL_KEYS, MEAL_COURSE_FIELDS } from '@/lib/menu';

interface Toast {
  id: string;
  type: 'warning' | 'error' | 'success' | 'info';
  title: string;
  message: string;
}

interface AppState {
  // Food pools
  foodItems: FoodItem[];
  addFoodItem: (name: string, category: CategoryKey) => void;
  removeFoodItem: (id: string) => void;

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

function moveFoodItemToEnd(foodItems: FoodItem[], itemId: string): FoodItem[] {
  const selectedItem = foodItems.find((item) => item.id === itemId);
  if (!selectedItem) return foodItems;

  return [...foodItems.filter((item) => item.id !== itemId), selectedItem];
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

function normalizeFoodItems(foodItems: FoodItem[] | undefined): FoodItem[] {
  const existing = foodItems ?? [];
  if (existing.length === 0) return SEED_DATA;

  const snackSeedItems = SEED_DATA.filter((item) => item.category === 'snacks');
  const missingSnackItems = snackSeedItems.filter(
    (seedItem) =>
      !existing.some(
        (item) => item.category === 'snacks' && item.name.toLowerCase() === seedItem.name.toLowerCase()
      )
  );

  return [...existing, ...missingSnackItems];
}

const CATEGORY_KEYS: CategoryKey[] = ['soups', 'mainCourses', 'sideDishes', 'complements', 'snacks'];

type CategoryPools = Record<CategoryKey, FoodItem[]>;

interface GenerationStats {
  itemUsage: Record<string, number>;
  itemLastUsedDay: Record<string, number>;
  categoryTagUsage: Record<CategoryKey, Record<string, number>>;
  recentByCategory: Record<CategoryKey, string[]>;
  weeklyMainUsage: Record<string, Set<string>>;
  selectionSequence: string[];
}

interface CandidateOptions {
  date: string;
  dayIndex: number;
  slotKey: string;
  excludeIds?: Set<string>;
  distinctFromId?: string | null;
  preferredDifferentTags?: string[];
}

function createCategoryPools(foodItems: FoodItem[]): CategoryPools {
  return {
    soups: foodItems.filter((item) => item.category === 'soups'),
    mainCourses: foodItems.filter((item) => item.category === 'mainCourses'),
    sideDishes: foodItems.filter((item) => item.category === 'sideDishes'),
    complements: foodItems.filter((item) => item.category === 'complements'),
    snacks: foodItems.filter((item) => item.category === 'snacks'),
  };
}

function createGenerationStats(): GenerationStats {
  return {
    itemUsage: {},
    itemLastUsedDay: {},
    categoryTagUsage: {
      soups: {},
      mainCourses: {},
      sideDishes: {},
      complements: {},
      snacks: {},
    },
    recentByCategory: {
      soups: [],
      mainCourses: [],
      sideDishes: [],
      complements: [],
      snacks: [],
    },
    weeklyMainUsage: {},
    selectionSequence: [],
  };
}

function getStringHash(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getWeekKey(dateStr: string): string {
  const date = parseDate(dateStr);
  const startOfWeek = new Date(date);
  const day = startOfWeek.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  startOfWeek.setDate(startOfWeek.getDate() + diff);

  const year = startOfWeek.getFullYear();
  const month = String(startOfWeek.getMonth() + 1).padStart(2, '0');
  const dayOfMonth = String(startOfWeek.getDate()).padStart(2, '0');
  return `${year}-${month}-${dayOfMonth}`;
}

function isWeekendDate(dateStr: string): boolean {
  const day = parseDate(dateStr).getDay();
  return day === 0 || day === 6;
}

function countTagOverlap(tagsA: string[] | undefined, tagsB: string[] | undefined): number {
  if (!tagsA?.length || !tagsB?.length) return 0;
  const tagSet = new Set(tagsB);
  return tagsA.filter((tag) => tagSet.has(tag)).length;
}

function getRecentLimit(category: CategoryKey): number {
  if (category === 'mainCourses') return 5;
  if (category === 'snacks') return 3;
  return 4;
}

function registerItemSelection(
  stats: GenerationStats,
  category: CategoryKey,
  itemId: string | null,
  dayIndex: number,
  itemMap: Record<string, FoodItem>,
  weekKey?: string
) {
  if (!itemId) return;

  stats.selectionSequence.push(itemId);
  stats.itemUsage[itemId] = (stats.itemUsage[itemId] ?? 0) + 1;
  stats.itemLastUsedDay[itemId] = dayIndex;

  for (const tag of itemMap[itemId]?.tags ?? []) {
    stats.categoryTagUsage[category][tag] = (stats.categoryTagUsage[category][tag] ?? 0) + 1;
  }

  stats.recentByCategory[category] = [...stats.recentByCategory[category], itemId].slice(
    -getRecentLimit(category)
  );

  if (category === 'mainCourses' && weekKey) {
    if (!stats.weeklyMainUsage[weekKey]) {
      stats.weeklyMainUsage[weekKey] = new Set<string>();
    }
    stats.weeklyMainUsage[weekKey].add(itemId);
  }
}

function scoreCandidate(
  item: FoodItem,
  category: CategoryKey,
  stats: GenerationStats,
  options: CandidateOptions
): number {
  const usageCount = stats.itemUsage[item.id] ?? 0;
  const lastUsedDay = stats.itemLastUsedDay[item.id];
  const dayGap = lastUsedDay === undefined ? options.dayIndex + 3 : options.dayIndex - lastUsedDay;
  const recentIndex = stats.recentByCategory[category].lastIndexOf(item.id);
  const recentPenalty =
    recentIndex === -1 ? 0 : (stats.recentByCategory[category].length - recentIndex) * 26;
  const tagPenalty = (item.tags ?? []).reduce(
    (sum, tag) => sum + (stats.categoryTagUsage[category][tag] ?? 0),
    0
  );
  const overlapPenalty = countTagOverlap(item.tags, options.preferredDifferentTags) * 18;
  const unusedBonus = usageCount === 0 ? 48 : 0;
  const gapBonus = Math.min(dayGap, 10) * (category === 'mainCourses' ? 12 : 8);
  const usagePenaltyWeight =
    category === 'mainCourses' ? 42 : category === 'snacks' ? 26 : 20;
  const tagPenaltyWeight = category === 'mainCourses' ? 10 : 4;
  const tieBreaker = getStringHash(`${options.date}-${options.slotKey}-${item.id}`) % 11;

  return (
    unusedBonus +
    gapBonus -
    usageCount * usagePenaltyWeight -
    recentPenalty -
    tagPenalty * tagPenaltyWeight -
    overlapPenalty +
    tieBreaker
  );
}

function pickBalancedItem(
  pool: FoodItem[],
  category: CategoryKey,
  stats: GenerationStats,
  options: CandidateOptions
): string | null {
  if (pool.length === 0) return null;

  let candidates = [...pool];
  const applyFilterIfPossible = (predicate: (item: FoodItem) => boolean) => {
    const filtered = candidates.filter(predicate);
    if (filtered.length > 0) {
      candidates = filtered;
    }
  };

  if (options.excludeIds?.size) {
    applyFilterIfPossible((item) => !options.excludeIds?.has(item.id));
  }

  if (options.distinctFromId) {
    applyFilterIfPossible((item) => item.id !== options.distinctFromId);
  }

  const recentIds = new Set(
    stats.recentByCategory[category].slice(-getRecentLimit(category))
  );
  if (recentIds.size > 0) {
    applyFilterIfPossible((item) => !recentIds.has(item.id));
  }

  return [...candidates]
    .sort(
      (left, right) =>
        scoreCandidate(right, category, stats, options) -
          scoreCandidate(left, category, stats, options) ||
        left.name.localeCompare(right.name, 'tr')
    )[0]
    ?.id ?? null;
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

      removeFoodItem: (id) => {
        // Also clear from menus
        set((state) => ({
          foodItems: state.foodItems.filter((f) => f.id !== id),
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
          const nextFoodItems = itemId ? moveFoodItemToEnd(state.foodItems, itemId) : state.foodItems;

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
          const nextFoodItems = itemId ? moveFoodItemToEnd(state.foodItems, itemId) : state.foodItems;

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

        const itemMap = Object.fromEntries(foodItems.map((item) => [item.id, item])) as Record<
          string,
          FoodItem
        >;
        const stats = createGenerationStats();
        const monthEntries = getMonthDayEntries(year, month);

        const generatedMenus = monthEntries.map(({ dateStr }, dayIndex) => {
          const menu = createEmptyDailyMenu(dateStr);
          const weekKey = getWeekKey(dateStr);
          const weekend = isWeekendDate(dateStr);

          menu.lunch.soup = pickBalancedItem(pools.soups, 'soups', stats, {
            date: dateStr,
            dayIndex,
            slotKey: 'lunch-soup',
          });
          registerItemSelection(stats, 'soups', menu.lunch.soup, dayIndex, itemMap);

          menu.lunch.mainCourse = pickBalancedItem(pools.mainCourses, 'mainCourses', stats, {
            date: dateStr,
            dayIndex,
            slotKey: 'lunch-main',
            excludeIds: stats.weeklyMainUsage[weekKey],
          });
          registerItemSelection(
            stats,
            'mainCourses',
            menu.lunch.mainCourse,
            dayIndex,
            itemMap,
            weekKey
          );

          menu.lunch.sideDish = pickBalancedItem(pools.sideDishes, 'sideDishes', stats, {
            date: dateStr,
            dayIndex,
            slotKey: 'lunch-side',
          });
          registerItemSelection(stats, 'sideDishes', menu.lunch.sideDish, dayIndex, itemMap);

          menu.lunch.complement = pickBalancedItem(pools.complements, 'complements', stats, {
            date: dateStr,
            dayIndex,
            slotKey: 'lunch-complement',
          });
          registerItemSelection(stats, 'complements', menu.lunch.complement, dayIndex, itemMap);

          if (weekend) {
            menu.dinner.soup = menu.lunch.soup;
            menu.dinner.sideDish = menu.lunch.sideDish;
            menu.dinner.complement = menu.lunch.complement;

            registerItemSelection(stats, 'soups', menu.dinner.soup, dayIndex, itemMap);
            registerItemSelection(stats, 'sideDishes', menu.dinner.sideDish, dayIndex, itemMap);
            registerItemSelection(stats, 'complements', menu.dinner.complement, dayIndex, itemMap);
          } else {
            menu.dinner.soup = pickBalancedItem(pools.soups, 'soups', stats, {
              date: dateStr,
              dayIndex,
              slotKey: 'dinner-soup',
              distinctFromId: menu.lunch.soup,
            });
            registerItemSelection(stats, 'soups', menu.dinner.soup, dayIndex, itemMap);

            menu.dinner.sideDish = pickBalancedItem(pools.sideDishes, 'sideDishes', stats, {
              date: dateStr,
              dayIndex,
              slotKey: 'dinner-side',
              distinctFromId: menu.lunch.sideDish,
            });
            registerItemSelection(stats, 'sideDishes', menu.dinner.sideDish, dayIndex, itemMap);

            menu.dinner.complement = pickBalancedItem(pools.complements, 'complements', stats, {
              date: dateStr,
              dayIndex,
              slotKey: 'dinner-complement',
              distinctFromId: menu.lunch.complement,
            });
            registerItemSelection(stats, 'complements', menu.dinner.complement, dayIndex, itemMap);
          }

          menu.dinner.mainCourse = pickBalancedItem(pools.mainCourses, 'mainCourses', stats, {
            date: dateStr,
            dayIndex,
            slotKey: 'dinner-main',
            excludeIds: stats.weeklyMainUsage[weekKey],
            distinctFromId: menu.lunch.mainCourse,
            preferredDifferentTags: menu.lunch.mainCourse
              ? itemMap[menu.lunch.mainCourse]?.tags
              : undefined,
          });
          registerItemSelection(
            stats,
            'mainCourses',
            menu.dinner.mainCourse,
            dayIndex,
            itemMap,
            weekKey
          );

          menu.snack = pickBalancedItem(pools.snacks, 'snacks', stats, {
            date: dateStr,
            dayIndex,
            slotKey: 'snack',
          });
          registerItemSelection(stats, 'snacks', menu.snack, dayIndex, itemMap);

          return menu;
        });

        const rotatedFoodItems = rotateFoodItemsBySelectionSequence(
          foodItems,
          stats.selectionSequence
        );
        const preservedMenus = menus
          .map((menu) => normalizeMenu(menu))
          .filter((menu) => {
            const menuDate = parseDate(menu.date);
            return !(menuDate.getFullYear() === year && menuDate.getMonth() === month);
          });

        set({
          foodItems: rotatedFoodItems,
          menus: [...preservedMenus, ...generatedMenus].sort((left, right) =>
            left.date.localeCompare(right.date)
          ),
        });

        get().addToast({
          type: 'success',
          title: 'Aylık Menü Oluşturuldu',
          message: `${MONTH_NAMES_TR[month]} ${year} için dengeli ve çeşitli aylık menü hazırlandı.`,
        });
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
      version: 1,
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
