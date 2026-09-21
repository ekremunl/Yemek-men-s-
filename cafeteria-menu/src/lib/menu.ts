import { generateMonthlyMenu, type Dish, type DayMenu } from './menu-generator';
import { initialDishes } from './seedData';

// 1. SeedData içerisindeki yemekleri yeni algoritmanın Dish formatına çeviren Adapter
export function adaptSeedDataToDishes(): Dish[] {
  return initialDishes.map((dish: any) => {
    const tags: string[] = [];

    // Kategoriye göre etiket tanımlamaları
    if (dish.category === 'main') {
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
      incompatibleWithTags: dish.category === 'main' && (dish.name.toLowerCase().includes('manti') || dish.name.toLowerCase().includes('mantı')) ? ['hamur_isi'] : [],
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
