import { generateMonthlyMenu, type Dish } from './menu-generator';
import * as SeedDataModule from './seedData';

// 1. Arayüz ve Store'un Beklediği Sabitler
export const COURSE_LABELS_TR: Record<string, string> = {
  corba: 'Çorba',
  ana_yemek: 'Ana Yemek',
  yan_urun: 'Yan Ürün',
  tatli_meyve: 'Tatlı / Meyve',
  main: 'Ana Yemek',
  side: 'Yan Yemek',
  soup: 'Çorba',
  dessert: 'Tatlı'
};

export const MEAL_LABELS_TR: Record<string, string> = {
  lunch: 'Öğle Yemeği',
  dinner: 'Akşam Yemeği'
};

export const MEAL_SHORT_LABELS_TR: Record<string, string> = {
  lunch: 'Öğle',
  dinner: 'Akşam'
};

export const MAIN_MEAL_KEYS = ['lunch', 'dinner'] as const;
export const PLANNER_MEAL_KEYS = ['lunch', 'dinner'] as const;
export const MEAL_COURSE_FIELDS = ['soup', 'mainCourse', 'sideDish', 'complement'] as const;

export const COURSE_TO_CATEGORY_KEY: Record<string, string> = {
  soup: 'soups',
  mainCourse: 'mainCourses',
  sideDish: 'sideDishes',
  complement: 'complements',
  snack: 'snacks'
};

// 2. Nesne Oluşturucular (Store & Component Fonksiyonları)

export function createEmptyFourCourseMeal() {
  return {
    soup: null,
    mainCourse: null,
    sideDish: null,
    complement: null
  };
}

export function createEmptyDailyMenu(dateStr?: string) {
  return {
    date: dateStr || '',
    lunch: createEmptyFourCourseMeal(),
    dinner: createEmptyFourCourseMeal(),
    snack: null
  };
}

// 3. Yardımcı Fonksiyonlar

export function getAllMenuItemIds(dayMenu: any): string[] {
  if (!dayMenu) return [];
  const ids: string[] = [];

  const checkAndAdd = (val: any) => {
    if (!val) return;
    if (typeof val === 'string') {
      ids.push(val);
    } else if (typeof val === 'object' && val.id) {
      ids.push(val.id);
    }
  };

  if (dayMenu.lunch) {
    Object.values(dayMenu.lunch).forEach(checkAndAdd);
  }
  if (dayMenu.dinner) {
    Object.values(dayMenu.dinner).forEach(checkAndAdd);
  }
  if (dayMenu.snack) {
    checkAndAdd(dayMenu.snack);
  }

  return ids;
}

export function countDayEntries(dayMenu: any): number {
  return getAllMenuItemIds(dayMenu).length;
}

export function isDayComplete(dayMenu: any): boolean {
  return countDayEntries(dayMenu) > 0;
}

// 4. SeedData Adapter
function getSeedDishes(): any[] {
  const seed = SeedDataModule as any;
  return seed.SEED_DATA || seed.initialDishes || seed.SEED_DISHES || seed.dishes || seed.default || [];
}

export function adaptSeedDataToDishes(): Dish[] {
  const rawDishes = getSeedDishes();
  
  return rawDishes.map((dish: any) => {
    const tags: string[] = dish.tags || [];
    const cat = dish.category || dish.type || '';
    const nameLower = (dish.name || '').toLowerCase();

    if ((cat === 'mainCourses' || cat === 'main' || cat === 'ana_yemek') && tags.length === 0) {
      if (nameLower.includes('tavuk')) tags.push('tavuk', 'kümes');
      else if (nameLower.includes('köfte') || nameLower.includes('et') || nameLower.includes('kıyma')) tags.push('kırmızı_et');
      else if (nameLower.includes('balık')) tags.push('balık');
      else if (nameLower.includes('kuru fasulye') || nameLower.includes('nohut') || nameLower.includes('mercimek')) tags.push('bakliyat');
      else if (nameLower.includes('manti') || nameLower.includes('mantı') || nameLower.includes('makarna') || nameLower.includes('börek') || nameLower.includes('pide')) tags.push('hamur_isi');
      else tags.push('sebze');
    }

    return {
      id: dish.id || String(Math.random()),
      name: dish.name || 'İsimsiz Yemek',
      category: cat,
      tags: tags,
      incompatibleWithTags: [],
      popularity: 3,
      isWeekendSuitable: true
    };
  });
}

// 5. Menü Jeneratörü
export function generateMenu(year?: number, month?: number) {
  const currentDate = new Date();
  const targetYear = year || currentDate.getFullYear();
  const targetMonth = month || currentDate.getMonth() + 1;

  const dishes = adaptSeedDataToDishes();
  
  try {
    const generatedMenu = generateMonthlyMenu(dishes, targetMonth, targetYear);
    return {
      success: true,
      data: generatedMenu
    };
  } catch (error: any) {
    console.error('Menü oluşturma hatası:', error);
    return {
      success: false,
      error: error.message || 'Menü oluşturulurken bir hata oluştu.'
    };
  }
}
