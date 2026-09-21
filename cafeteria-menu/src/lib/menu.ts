import { generateMonthlyMenu, type Dish, type DayMenu } from './menu-generator';
import { initialDishes } from './seedData';

// Projenin arayüz bileşenlerinin (ExportPanel vb.) beklediği sabitler ve tanımlamalar
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

export const MAIN_MEAL_KEYS = ['lunch', 'dinner'] as const;

// Günün eksiksiz olup olmadığını kontrol eden yardımcı fonksiyon
export function isDayComplete(dayMenu: any): boolean {
  if (!dayMenu) return false;
  return Boolean(
    dayMenu.lunch?.main || dayMenu.dinner?.main || 
    (dayMenu.meals && dayMenu.meals.length > 0)
  );
}

// 1. SeedData içerisindeki yemekleri yeni algoritmanın Dish formatına çeviren Adapter
export function adaptSeedDataToDishes(): Dish[] {
  return initialDishes.map((dish: any) => {
    const tags: string[] = [];

    if (dish.category === 'main' || dish.category === 'ana_yemek') {
      const nameLower = dish.name.toLowerCase();
      if (nameLower.includes('tavuk')) tags.push('tavuk', 'kümes');
      else if (nameLower.includes('köfte') || nameLower.includes('et') || nameLower.includes('kıyma')) tags.push('kırmızı_et');
      else if (nameLower.includes('balık')) tags.push('balık');
      else if (nameLower.includes('kuru fasulye') || nameLower.includes('nohut') || nameLower.includes('mercimek')) tags.push('bakliyat');
      else if (nameLower.includes('manti') || nameLower.includes('mantı') || nameLower.includes('makarna') || nameLower.includes('börek') || nameLower.includes('pide')) tags.push('hamur_isi');
      else tags.push('sebze');
    }

    return {
      id: dish.id,
      name: dish.name,
      category: dish.category,
      tags: tags,
      incompatibleWithTags: (dish.category === 'main' || dish.category === 'ana_yemek') && 
        (dish.name.toLowerCase().includes('manti') || dish.name.toLowerCase().includes('mantı')) ? ['hamur_isi'] : [],
      popularity: 3,
      isWeekendSuitable: ['pide', 'hamburger', 'dürüm', 'mantı', 'börek', 'pizza', 'sandwich', 'sandviç'].some(p => dish.name.toLowerCase().includes(p))
    };
  });
}

// 2. Yeni algoritma ile menü üreten ana fonksiyon
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
