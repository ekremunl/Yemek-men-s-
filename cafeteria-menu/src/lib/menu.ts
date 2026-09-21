import { generateMonthlyMenu, type Dish, type DayMenu } from './menu-generator';
import * as SeedDataModule from './seedData';

// 1. Proje bileşenlerinin (CalendarView, ExportPanel, Store) beklediği sabitler ve tipler
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

// 2. Eksik Yardımcı Fonksiyonlar

// Boş günlük menü nesnesi oluşturur
export function createEmptyDailyMenu(): any {
  return {
    lunch: { soup: null, main: null, side: null, dessert: null },
    dinner: { soup: null, main: null, side: null, dessert: null }
  };
}

// Bir günde kaç öğün/yemek girişi yapıldığını sayar
export function countDayEntries(dayMenu: any): number {
  if (!dayMenu) return 0;
  let count = 0;
  const meals = ['lunch', 'dinner'];
  for (const meal of meals) {
    if (dayMenu[meal]) {
      Object.values(dayMenu[meal]).forEach(item => {
        if (item) count++;
      });
    }
  }
  return count;
}

// Günün eksiksiz olup olmadığını kontrol eder
export function isDayComplete(dayMenu: any): boolean {
  return countDayEntries(dayMenu) > 0;
}

// 3. SeedData Verilerini Güvenli Çekme (export isminden bağımsız)
function getSeedDishes(): any[] {
  const seed = SeedDataModule as any;
  return seed.initialDishes || seed.SEED_DISHES || seed.dishes || seed.default || [];
}

// 4. SeedData -> Dish Adapter
export function adaptSeedDataToDishes(): Dish[] {
  const rawDishes = getSeedDishes();
  
  return rawDishes.map((dish: any) => {
    const tags: string[] = [];
    const cat = dish.category || dish.type || '';
    const nameLower = (dish.name || '').toLowerCase();

    if (cat === 'main' || cat === 'ana_yemek') {
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
      incompatibleWithTags: (cat === 'main' || cat === 'ana_yemek') && 
        (nameLower.includes('manti') || nameLower.includes('mantı')) ? ['hamur_isi'] : [],
      popularity: 3,
      isWeekendSuitable: ['pide', 'hamburger', 'dürüm', 'mantı', 'börek', 'pizza', 'sandwich', 'sandviç'].some(p => nameLower.includes(p))
    };
  });
}

// 5. Ana Menü Oluşturucu
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
