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

  const requiredDefaultSeedItems = SEED_DATA.filter(
    (item) => item.category === 'snacks' || item.id === 'm19' || item.id === 'm20'
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

interface GenerationStats {
  itemUsage: Record<string, number>;
  itemLastUsedDay: Record<string, number>;
  categoryTagUsage: Record<CategoryKey, Record<string, number>>;
  recentByCategory: Record<CategoryKey, string[]>;
  weeklyMainUsage: Record<string, Set<string>>;
  weeklyMealSignatures: Record<string, Set<string>>;
  monthlyMealSignatures: Record<MainMealKey, Set<string>>;
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
    weeklyMealSignatures: {},
    monthlyMealSignatures: {
      lunch: new Set<string>(),
      dinner: new Set<string>(),
    },
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

function getMainCourseSideRule(mainItem: FoodItem | undefined): 'rice' | 'pasta' | null {
  if (!mainItem) return null;

  const normalizedName = mainItem.name.toLocaleLowerCase('tr-TR');
  if (normalizedName.includes('kuru fasulye') || normalizedName.includes('nohut')) {
    return 'rice';
  }

  if (normalizedName.includes('yeşil mercimek') || normalizedName.includes('barbunya')) {
    return 'pasta';
  }

  return null;
}

function getCompatibleSidePool(mainItem: FoodItem | undefined, sidePool: FoodItem[]): FoodItem[] {
  const rule = getMainCourseSideRule(mainItem);
  if (rule === 'rice') {
    return sidePool.filter((item) => item.name === 'Pirinç Pilavı');
  }

  if (rule === 'pasta') {
    return sidePool.filter((item) => item.tags?.includes('pasta'));
  }

  return sidePool;
}

function hasProtectedTagOverlap(
  firstTags: string[] | undefined,
  secondTags: string[] | undefined,
  protectedTags: string[]
): boolean {
  if (!firstTags?.length || !secondTags?.length) return false;
  const protectedTagSet = new Set(protectedTags);
  const first = new Set(firstTags.filter((tag) => protectedTagSet.has(tag)));
  return secondTags.some((tag) => first.has(tag));
}

function getMealSignature(meal: FourCourseMeal): string {
  return [
    meal.soup ?? '-',
    meal.mainCourse ?? '-',
    meal.sideDish ?? '-',
    meal.complement ?? '-',
  ].join('|');
}

function hasMealSignatureConflict(
  stats: GenerationStats,
  mealKey: MainMealKey,
  weekKey: string,
  signature: string
): boolean {
  const weeklyKey = `${mealKey}:${weekKey}`;
  return (
    Boolean(stats.weeklyMealSignatures[weeklyKey]?.has(signature)) ||
    stats.monthlyMealSignatures[mealKey].has(signature)
  );
}

function registerMealSignature(
  stats: GenerationStats,
  mealKey: MainMealKey,
  weekKey: string,
  signature: string
) {
  const weeklyKey = `${mealKey}:${weekKey}`;
  if (!stats.weeklyMealSignatures[weeklyKey]) {
    stats.weeklyMealSignatures[weeklyKey] = new Set<string>();
  }

  stats.weeklyMealSignatures[weeklyKey].add(signature);
  stats.monthlyMealSignatures[mealKey].add(signature);
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

function rankCandidates(
  pool: FoodItem[],
  category: CategoryKey,
  stats: GenerationStats,
  options: CandidateOptions
): FoodItem[] {
  if (pool.length === 0) return [];

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

  return [...candidates].sort(
    (left, right) =>
      scoreCandidate(right, category, stats, options) -
        scoreCandidate(left, category, stats, options) ||
      left.name.localeCompare(right.name, 'tr')
  );
}

function getMealCompatibilityPenalty(
  meal: FourCourseMeal,
  itemMap: Record<string, FoodItem>
): number {
  const soup = meal.soup ? itemMap[meal.soup] : undefined;
  const main = meal.mainCourse ? itemMap[meal.mainCourse] : undefined;
  const side = meal.sideDish ? itemMap[meal.sideDish] : undefined;
  const complement = meal.complement ? itemMap[meal.complement] : undefined;

  let penalty = 0;

  if (!soup || !main || !side || !complement) {
    return 900;
  }

  if (getMainCourseSideRule(main) === 'rice' && side.name !== 'Pirinç Pilavı') {
    return 1000;
  }

  if (getMainCourseSideRule(main) === 'pasta' && !side.tags?.includes('pasta')) {
    return 1000;
  }

  if (hasProtectedTagOverlap(soup.tags, main.tags, ['legume', 'beef', 'poultry', 'fish'])) {
    penalty += 220;
  }

  if (hasProtectedTagOverlap(main.tags, side.tags, ['legume'])) {
    penalty += 260;
  }

  if (hasProtectedTagOverlap(soup.tags, side.tags, ['noodle', 'pasta'])) {
    penalty += 80;
  }

  if ((side.tags?.includes('rice') || side.tags?.includes('pasta') || side.tags?.includes('bulgur')) && complement.tags?.includes('bread')) {
    penalty += 140;
  }

  if (main.tags?.includes('fish') && complement.tags?.includes('pickled')) {
    penalty += 80;
  }

  if (complement.tags?.includes('dessert') && soup.tags?.includes('dairy')) {
    penalty += 60;
  }

  return penalty;
}

function pickBalancedItem(
  pool: FoodItem[],
  category: CategoryKey,
  stats: GenerationStats,
  options: CandidateOptions
): string | null {
  return rankCandidates(pool, category, stats, options)[0]?.id ?? null;
}

function registerGeneratedMeal(
  stats: GenerationStats,
  mealKey: MainMealKey,
  weekKey: string,
  meal: FourCourseMeal,
  dayIndex: number,
  itemMap: Record<string, FoodItem>
) {
  registerItemSelection(stats, 'soups', meal.soup, dayIndex, itemMap);
  registerItemSelection(stats, 'mainCourses', meal.mainCourse, dayIndex, itemMap, weekKey);
  registerItemSelection(stats, 'sideDishes', meal.sideDish, dayIndex, itemMap);
  registerItemSelection(stats, 'complements', meal.complement, dayIndex, itemMap);
  registerMealSignature(stats, mealKey, weekKey, getMealSignature(meal));
}

function buildGeneratedMeal(
  mealKey: MainMealKey,
  dateStr: string,
  dayIndex: number,
  weekKey: string,
  pools: CategoryPools,
  stats: GenerationStats,
  itemMap: Record<string, FoodItem>,
  options?: {
    distinctFromMeal?: FourCourseMeal;
    lockedFields?: Partial<FourCourseMeal>;
  }
): FourCourseMeal {
  const lockedFields = options?.lockedFields ?? {};
  const distinctFromMeal = options?.distinctFromMeal;

  const mainCandidates = rankCandidates(
    pools.mainCourses,
    'mainCourses',
    stats,
    {
      date: dateStr,
      dayIndex,
      slotKey: `${mealKey}-main`,
      excludeIds: stats.weeklyMainUsage[weekKey],
      distinctFromId: distinctFromMeal?.mainCourse,
      preferredDifferentTags: distinctFromMeal?.mainCourse
        ? itemMap[distinctFromMeal.mainCourse]?.tags
        : undefined,
    }
  ).slice(0, 12);

  const findBestMeal = (allowRepeatedSignature: boolean): FourCourseMeal | null => {
    let bestMeal: FourCourseMeal | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const mainItem of mainCandidates) {
      const sidePool = lockedFields.sideDish
        ? getCompatibleSidePool(mainItem, pools.sideDishes).filter(
            (item) => item.id === lockedFields.sideDish
          )
        : getCompatibleSidePool(mainItem, pools.sideDishes);

      if (sidePool.length === 0) continue;

      const sideCandidates = (lockedFields.sideDish
        ? sidePool
        : rankCandidates(sidePool, 'sideDishes', stats, {
            date: dateStr,
            dayIndex,
            slotKey: `${mealKey}-side`,
            distinctFromId: distinctFromMeal?.sideDish,
            preferredDifferentTags: mainItem.tags,
          }).slice(0, 6));

      const soupCandidates = (lockedFields.soup
        ? pools.soups.filter((item) => item.id === lockedFields.soup)
        : rankCandidates(pools.soups, 'soups', stats, {
            date: dateStr,
            dayIndex,
            slotKey: `${mealKey}-soup`,
            distinctFromId: distinctFromMeal?.soup,
            preferredDifferentTags: mainItem.tags,
          }).slice(0, 6));

      const complementCandidates = (lockedFields.complement
        ? pools.complements.filter((item) => item.id === lockedFields.complement)
        : rankCandidates(pools.complements, 'complements', stats, {
            date: dateStr,
            dayIndex,
            slotKey: `${mealKey}-complement`,
            distinctFromId: distinctFromMeal?.complement,
            preferredDifferentTags: mainItem.tags,
          }).slice(0, 6));

      const mainScore = scoreCandidate(mainItem, 'mainCourses', stats, {
        date: dateStr,
        dayIndex,
        slotKey: `${mealKey}-main`,
        excludeIds: stats.weeklyMainUsage[weekKey],
        distinctFromId: distinctFromMeal?.mainCourse,
        preferredDifferentTags: distinctFromMeal?.mainCourse
          ? itemMap[distinctFromMeal.mainCourse]?.tags
          : undefined,
      });

      for (const sideItem of sideCandidates) {
        const sideScore = scoreCandidate(sideItem, 'sideDishes', stats, {
          date: dateStr,
          dayIndex,
          slotKey: `${mealKey}-side`,
          distinctFromId: distinctFromMeal?.sideDish,
          preferredDifferentTags: mainItem.tags,
        });

        for (const soupItem of soupCandidates) {
          const soupScore = scoreCandidate(soupItem, 'soups', stats, {
            date: dateStr,
            dayIndex,
            slotKey: `${mealKey}-soup`,
            distinctFromId: distinctFromMeal?.soup,
            preferredDifferentTags: mainItem.tags,
          });

          for (const complementItem of complementCandidates) {
            const complementScore = scoreCandidate(complementItem, 'complements', stats, {
              date: dateStr,
              dayIndex,
              slotKey: `${mealKey}-complement`,
              distinctFromId: distinctFromMeal?.complement,
              preferredDifferentTags: mainItem.tags,
            });

            const meal: FourCourseMeal = {
              soup: soupItem.id,
              mainCourse: mainItem.id,
              sideDish: sideItem.id,
              complement: complementItem.id,
            };

            const signature = getMealSignature(meal);
            if (!allowRepeatedSignature && hasMealSignatureConflict(stats, mealKey, weekKey, signature)) {
              continue;
            }

            const compatibilityPenalty = getMealCompatibilityPenalty(meal, itemMap);
            if (compatibilityPenalty >= 1000) continue;

            const totalScore =
              mainScore + sideScore + soupScore + complementScore - compatibilityPenalty;

            if (totalScore > bestScore) {
              bestScore = totalScore;
              bestMeal = meal;
            }
          }
        }
      }
    }

    return bestMeal;
  };

  return (
    findBestMeal(false) ??
    findBestMeal(true) ?? {
      soup: lockedFields.soup ?? pools.soups[0]?.id ?? null,
      mainCourse: mainCandidates[0]?.id ?? null,
      sideDish:
        lockedFields.sideDish ??
        getCompatibleSidePool(
          mainCandidates[0],
          pools.sideDishes
        )[0]?.id ??
        null,
      complement: lockedFields.complement ?? pools.complements[0]?.id ?? null,
    }
  );
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

        const itemMap = Object.fromEntries(foodItems.map((item) => [item.id, item])) as Record<
          string,
          FoodItem
        >;
        const stats = createGenerationStats();
        const monthEntries = getMonthDayEntries(year, month);

        const generatedMenus = monthEntries.map(({ dateStr }, dayIndex) => {
          const weekKey = getWeekKey(dateStr);
          const weekend = isWeekendDate(dateStr);
          const menu = createEmptyDailyMenu(dateStr);

          menu.lunch = buildGeneratedMeal(
            'lunch',
            dateStr,
            dayIndex,
            weekKey,
            pools,
            stats,
            itemMap
          );
          registerGeneratedMeal(stats, 'lunch', weekKey, menu.lunch, dayIndex, itemMap);

          menu.dinner = buildGeneratedMeal(
            'dinner',
            dateStr,
            dayIndex,
            weekKey,
            pools,
            stats,
            itemMap,
            weekend
              ? {
                  distinctFromMeal: menu.lunch,
                  lockedFields: {
                    soup: menu.lunch.soup,
                    sideDish: menu.lunch.sideDish,
                    complement: menu.lunch.complement,
                  },
                }
              : { distinctFromMeal: menu.lunch }
          );
          registerGeneratedMeal(stats, 'dinner', weekKey, menu.dinner, dayIndex, itemMap);

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
      version: 2,
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
