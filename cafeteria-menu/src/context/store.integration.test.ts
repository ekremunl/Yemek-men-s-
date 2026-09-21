// src/context/store.integration.test.ts
// Çalıştırma (cafeteria-menu klasöründe):  npx tsx src/context/store.integration.test.ts
//
// Gerçek zustand store'u üzerinden uçtan uca test: eski sürüm (v2) localStorage
// verisinin migration'ı, otomatik menü üretimi, ay geçişi ve hata yolları.
import assert from 'node:assert/strict';
import type { FoodItem } from '@/types';
import { SEED_DATA } from '@/lib/seedData';
import { validateDailyMenus } from '@/lib/menu';

const STORAGE_KEY = 'cafeteria-menu-store';
const PRACTICAL_NAMES = ['Mantı', 'Su Böreği', 'Kıymalı Pide', 'Peynirli Pide', 'Tavuk Dürüm', 'Hamburger', 'Lahmacun'];

// Tarayıcı ortamı taklidi (store, localStorage'ı yalnızca window varsa kullanır).
const memory = new Map<string, string>();
const localStorageStub = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => void memory.set(key, value),
  removeItem: (key: string) => void memory.delete(key),
};
Object.assign(globalThis, { window: globalThis, localStorage: localStorageStub });

async function main() {
  // Eski (v2) kayıt: yeni varsayılan yemekler yok + kullanıcının elle eklediği etiketsiz "Mantı".
  const NEW_IDS = new Set(['m21', 'm22', 'm23', 'm24', 'm25', 'm26', 'm27', 'd11', 'd12', 'd13', 'd14']);
  const oldPool: FoodItem[] = [
    ...SEED_DATA.filter((item) => !NEW_IDS.has(item.id)),
    { id: 'user-manti', name: 'Mantı', category: 'mainCourses' },
  ];
  memory.set(STORAGE_KEY, JSON.stringify({ state: { foodItems: oldPool, menus: [], currentYear: 2026, currentMonth: 9 }, version: 2 }));

  const { useAppStore } = await import('./store');
  const state = () => useAppStore.getState();
  let passed = 0;
  const test = (name: string, fn: () => void) => {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  };

  console.log('store entegrasyon testleri');

  test('Migration (v2→v3): yeni varsayılan yemekler eklenir, aynı isimli kullanıcı yemeği çoğaltılmaz', () => {
    const names = state().foodItems.map((i) => i.name);
    for (const name of ['Tavuk Dürüm', 'Hamburger', 'Çoban Salata', 'Havuç Tarator']) assert.ok(names.includes(name), `${name} eklenmedi`);
    assert.equal(names.filter((n) => n === 'Mantı').length, 1, 'Mantı çoğaldı');
    assert.equal(state().foodItems.find((i) => i.name === 'Mantı')!.id, 'user-manti');
  });

  test('generateBalancedMonthMenus: Ekim 2026 için tam ve kurallara uygun menü üretir', () => {
    state().generateBalancedMonthMenus(2026, 9);
    const menus = state().menus;
    assert.equal(menus.length, 31);
    assert.ok(state().toasts.some((t) => t.type === 'success'), 'başarı bildirimi yok');
    assert.ok(!state().toasts.some((t) => t.type === 'error'), 'beklenmeyen hata bildirimi');

    const items = new Map(state().foodItems.map((i) => [i.id, i]));
    for (const menu of menus) {
      const day = new Date(Number(menu.date.slice(0, 4)), Number(menu.date.slice(5, 7)) - 1, Number(menu.date.slice(8)), 12).getDay();
      for (const key of ['lunch', 'dinner'] as const) {
        assert.ok(menu[key].soup && menu[key].mainCourse && menu[key].sideDish && menu[key].complement, `${menu.date} ${key} eksik`);
      }
      assert.ok(menu.snack, `${menu.date} ara öğün yok`);
      if (day === 0 || day === 6) {
        assert.ok(PRACTICAL_NAMES.includes(items.get(menu.lunch.mainCourse!)!.name), `${menu.date} hafta sonu öğle pratik değil`);
        assert.equal(menu.dinner.soup, menu.lunch.soup);
        assert.equal(menu.dinner.sideDish, menu.lunch.sideDish);
        assert.equal(menu.dinner.complement, menu.lunch.complement);
      }
    }
    assert.deepEqual(validateDailyMenus(menus, state().foodItems), []);
  });

  test('Yeniden üretim aynı ayı değiştirir; sayı sabit kalır', () => {
    const before = JSON.stringify(state().menus);
    state().generateBalancedMonthMenus(2026, 9);
    assert.equal(state().menus.length, 31);
    assert.notEqual(JSON.stringify(state().menus), before, 'her üretim farklı olmalı');
  });

  test('Ay geçişi: Kasım üretilince Ekim korunur ve iki ay birlikte kurallara uyar', () => {
    const octBefore = JSON.stringify(state().menus);
    state().generateBalancedMonthMenus(2026, 10);
    assert.equal(state().menus.length, 31 + 30);
    assert.equal(JSON.stringify(state().menus.slice(0, 31)), octBefore, 'Ekim menüsü değişmemeli');
    assert.deepEqual(validateDailyMenus(state().menus, state().foodItems), [], 'ay sınırında ihlal var');
  });

  test('Üretilen menü localStorage kaydına (v3) yazılır', () => {
    const saved = JSON.parse(memory.get(STORAGE_KEY)!);
    assert.equal(saved.version, 3);
    assert.equal(saved.state.menus.length, 61);
  });

  test('updateFoodItem: etiket/bileşenler temizlenip kalıcı kaydedilir; sonraki üretim kurallara uyar', () => {
    state().addFoodItem('Deneme Böreği', 'mainCourses');
    const id = state().foodItems.find((i) => i.name === 'Deneme Böreği')!.id;
    state().updateFoodItem(id, { tags: [' dough ', 'dough', 'practical', ''], mainIngredients: [' peynir ', 'peynir', ''] });

    const saved = state().foodItems.find((i) => i.id === id)!;
    assert.deepEqual(saved.tags, ['dough', 'practical']);
    assert.deepEqual(saved.mainIngredients, ['peynir']);
    const persisted = JSON.parse(memory.get(STORAGE_KEY)!).state.foodItems.find((i: FoodItem) => i.id === id);
    assert.deepEqual(persisted.tags, ['dough', 'practical'], 'localStorage kaydına yazılmalı');

    state().generateBalancedMonthMenus(2026, 9);
    const october = state().menus.filter((m) => m.date.startsWith('2026-10'));
    assert.deepEqual(validateDailyMenus(october, state().foodItems), []);
  });

  test('Pratik yemek kalmayınca: Türkçe hata bildirimi, mevcut menüler bozulmaz', () => {
    const before = JSON.stringify(state().menus);
    const practical = state().foodItems.filter((i) => PRACTICAL_NAMES.includes(i.name));
    for (const item of practical) state().removeFoodItem(item.id);
    const menusAfterRemoval = JSON.stringify(state().menus);

    state().generateBalancedMonthMenus(2026, 11);
    assert.equal(JSON.stringify(state().menus), menusAfterRemoval, 'hata durumunda menü değişmemeli');
    const errorToast = state().toasts.filter((t) => t.type === 'error').pop();
    assert.ok(errorToast && /pratik/i.test(errorToast.message), errorToast?.message);
    void before;
    console.log(`    örnek bildirim: ${errorToast!.title} — ${errorToast!.message}`);
  });

  test('Bir kategori tamamen boşsa: mevcut "Eksik Ürün Havuzu" bildirimi korunur', () => {
    for (const item of state().foodItems.filter((i) => i.category === 'soups')) state().removeFoodItem(item.id);
    state().generateBalancedMonthMenus(2026, 11);
    assert.ok(state().toasts.some((t) => t.title === 'Eksik Ürün Havuzu'));
  });

  console.log(`\n${passed} test geçti.`);
  process.exit(0); // store'un toast zamanlayıcıları süreci açık tutmasın
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
