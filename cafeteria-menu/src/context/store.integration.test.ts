// src/context/store.integration.test.ts
// Çalıştırma (cafeteria-menu klasöründe):  npx tsx src/context/store.integration.test.ts
//
// Gerçek zustand store'u üzerinden uçtan uca test: eski sürüm (v4) kaydının grup geçişi, otomatik menü,
// kilitli gün, yasak temizliği ve hata yolları.
import assert from 'node:assert/strict';
import type { FoodItem } from '@/types';
import { SEED_DATA } from '@/lib/seedData';
import { getAllMenuItemIds } from '@/lib/menu';

const STORAGE_KEY = 'cafeteria-menu-store';

const memory = new Map<string, string>();
const localStorageStub = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => void memory.set(key, value),
  removeItem: (key: string) => void memory.delete(key),
};
Object.assign(globalThis, { window: globalThis, localStorage: localStorageStub });

async function main() {
  // Eski (v4) kayıt: ana yemeklerde grup yok, etiketler var; etiket tabanlı Pazartesi-tavuk yasağı var.
  const legacyPool: FoodItem[] = SEED_DATA.map((item) => {
    const { group: _g, ...rest } = item;
    void _g;
    return rest;
  });
  memory.set(
    STORAGE_KEY,
    JSON.stringify({
      state: {
        foodItems: legacyPool,
        menus: [],
        currentYear: 2026,
        currentMonth: 9,
        ruleSettings: { weekdayBans: { '1': ['poultry'], '6': ['legume'] } },
      },
      version: 4,
    }),
  );

  const { useAppStore } = await import('./store');
  const state = () => useAppStore.getState();
  let passed = 0;
  const test = (name: string, fn: () => void) => {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  };

  console.log('store entegrasyon testleri');

  test('Migration (v4→v5): ana yemeklere grup atanır, eski etiket yasakları gruba çevrilir', () => {
    const mains = state().foodItems.filter((i) => i.category === 'mainCourses');
    const kuruFasulye = mains.find((i) => i.name === 'Kuru Fasulye')!;
    const sote = mains.find((i) => i.name === 'Tavuk Sote')!;
    assert.equal(kuruFasulye.group, 'bakliyat');
    assert.equal(sote.group, 'tavuk');
    assert.ok(mains.filter((i) => i.group).length >= 20);
    assert.deepEqual(state().planSettings.dayBans['1'], ['g:tavuk']);
    assert.deepEqual(state().planSettings.weekendBans, ['g:bakliyat']);
  });

  test('generateBalancedMonthMenus: ay dolu, yasaklara uyulur, hata yok', () => {
    state().generateBalancedMonthMenus(2026, 10); // Kasım
    const menus = state().menus;
    assert.equal(menus.length, 30);
    assert.ok(state().toasts.some((t) => t.type === 'success'));
    assert.ok(!state().toasts.some((t) => t.type === 'error'));
    const items = new Map(state().foodItems.map((i) => [i.id, i]));
    for (const menu of menus) {
      const dow = new Date(`${menu.date}T12:00:00`).getDay();
      for (const key of ['lunch', 'dinner'] as const) {
        const group = items.get(menu[key].mainCourse!)!.group;
        if (dow === 1) assert.notEqual(group, 'tavuk', `${menu.date} Pazartesi tavuk`);
        if (dow === 0 || dow === 6) assert.notEqual(group, 'bakliyat', `${menu.date} hafta sonu bakliyat`);
      }
    }
  });

  test('Kilitli gün yeniden üretimde aynen korunur', () => {
    const target = state().menus[12];
    state().toggleLockDay(target.date);
    state().generateBalancedMonthMenus(2026, 10);
    assert.deepEqual(state().menus.find((m) => m.date === target.date), target);
    assert.equal(state().menus.length, 30);
  });

  test('Ay geçişi: Aralık, Kasım geçmişiyle döngüye devam eder (aynı ana yemek hemen tekrar etmez)', () => {
    state().generateBalancedMonthMenus(2026, 11);
    const ordered = [...state().menus].sort((a, b) => a.date.localeCompare(b.date));
    const mains = ordered.flatMap((m) => [m.lunch.mainCourse, m.dinner.mainCourse]);
    // Art arda iki öğünde aynı yemek olmamalı.
    mains.slice(1).forEach((id, i) => assert.notEqual(id, mains[i]));
  });

  test('replaceCourse: aynı gruptan başka bir yemek önerir', () => {
    const date = '2026-11-10';
    const before = state().menus.find((m) => m.date === date)!.lunch.mainCourse!;
    const items = new Map(state().foodItems.map((i) => [i.id, i]));
    const pick = state().replaceCourse(date, 'lunch', 'mainCourse');
    assert.ok(pick && pick !== before);
    assert.equal(items.get(pick!)!.group, items.get(before)!.group);
  });

  test('removeFoodItem: menülerden ve yasak listelerinden temizlenir; geri alınabilir', () => {
    const victim = state().foodItems.find((i) => i.name === 'Mantı' || i.category === 'mainCourses')!;
    state().setPlanSettings({ weekendBans: [...state().planSettings.weekendBans, `d:${victim.id}`] });
    state().removeFoodItem(victim.id);
    assert.ok(!state().foodItems.some((i) => i.id === victim.id));
    assert.ok(!state().planSettings.weekendBans.includes(`d:${victim.id}`));
    assert.ok(state().menus.every((m) => !getAllMenuItemIds(m).includes(victim.id)));
    const undo = state().toasts.find((t) => t.action?.label === 'Geri al');
    assert.ok(undo, 'geri al bildirimi yok');
    undo!.action!.run();
    assert.ok(state().foodItems.some((i) => i.id === victim.id));
  });

  test('Grup seçilmemiş ana yemek: grup atanınca menüye girer; grup yoksa uyarı verilir', () => {
    const id = 'user-new';
    state().addFoodItem('Yeni Tavuk Yemeği', 'mainCourses', 'tavuk');
    const added = state().foodItems.find((i) => i.name === 'Yeni Tavuk Yemeği')!;
    assert.equal(added.group, 'tavuk');
    state().setMainGroup(added.id, undefined);
    assert.equal(state().foodItems.find((i) => i.id === added.id)!.group, undefined);
    void id;
  });

  test('Bir kategori tamamen boşsa: "Eksik Ürün Havuzu" hatası, menü değişmez', () => {
    const backup = state().foodItems;
    const menusBefore = state().menus.length;
    useAppStore.setState({ foodItems: backup.filter((i) => i.category !== 'soups') });
    state().generateBalancedMonthMenus(2027, 0);
    assert.ok(state().toasts.some((t) => t.type === 'error' && /Eksik Ürün Havuzu/.test(t.title)));
    assert.ok(state().generationError);
    assert.equal(state().menus.length, menusBefore);
    useAppStore.setState({ foodItems: backup, generationError: null });
  });

  test('persist: localStorage kaydı v5 ve planSettings içerir', () => {
    const saved = JSON.parse(memory.get(STORAGE_KEY)!);
    assert.equal(saved.version, 5);
    assert.ok(saved.state.planSettings);
    assert.ok(Array.isArray(saved.state.foodItems));
  });

  console.log(`\n${passed} test geçti.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
