// src/context/store.tags.test.ts
// Çalıştırma (cafeteria-menu klasöründe):  npx tsx src/context/store.tags.test.ts
//
// Etiket düzenleme akışı: yemek eklerken etiket, sessiz otomatik kaydetme,
// tahminleri toplu kaydetme ve toplu etiket ekleme/çıkarma.
import assert from 'node:assert/strict';

const memory = new Map<string, string>();
const localStorageStub = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => void memory.set(key, value),
  removeItem: (key: string) => void memory.delete(key),
};
Object.assign(globalThis, { window: globalThis, localStorage: localStorageStub });

async function main() {
  const { useAppStore } = await import('./store');
  const state = () => useAppStore.getState();
  const byName = (name: string) => state().foodItems.find((i) => i.name === name)!;
  let passed = 0;
  const test = (name: string, fn: () => void) => {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  };

  console.log('etiket düzenleme testleri');

  test('addFoodItem: seçilen etiketler ve bileşenler yemekle birlikte kaydedilir', () => {
    state().addFoodItem('Tavuklu Test Yemeği', 'mainCourses', { tags: ['poultry', 'vegetable'], mainIngredients: ['Tavuk'] });
    const item = byName('Tavuklu Test Yemeği');
    assert.deepEqual(item.tags, ['poultry', 'vegetable']);
    assert.deepEqual(item.mainIngredients, ['Tavuk']);
  });

  test('addFoodItem: etiket verilmezse alan hiç oluşmaz (isimden tahmine bırakılır)', () => {
    state().addFoodItem('Etiketsiz Test Yemeği', 'mainCourses');
    assert.equal(byName('Etiketsiz Test Yemeği').tags, undefined);
  });

  test('updateFoodItem silent: bildirim çıkmaz, normal çağrıda çıkar', () => {
    const id = byName('Tavuklu Test Yemeği').id;
    const before = state().toasts.length;
    state().updateFoodItem(id, { tags: ['poultry'] }, { silent: true });
    assert.equal(state().toasts.length, before, 'silent çağrı bildirim üretti');
    assert.deepEqual(byName('Tavuklu Test Yemeği').tags, ['poultry']);
    state().updateFoodItem(id, { tags: ['poultry', 'legume'] });
    assert.equal(state().toasts.length, before + 1);
  });

  test('confirmInferredTags: yalnızca kayıtlı etiketi olmayan ve tahmini bulunan yemekler kalıcı olur', () => {
    state().addFoodItem('Tavuk Sote Test', 'mainCourses');
    state().addFoodItem('Anlamsız Yemek Test', 'mainCourses');
    const count = state().confirmInferredTags();
    assert.ok(count >= 1);
    assert.deepEqual(byName('Tavuk Sote Test').tags, ['poultry']);
    assert.equal(byName('Anlamsız Yemek Test').tags, undefined, 'tahmini olmayan yemeğe etiket yazılmamalı');
    assert.equal(state().confirmInferredTags(), 0, 'ikinci çağrıda yapılacak iş kalmamalı');
  });

  test('bulkUpdateTags: ekleme mevcut etiketleri korur, yan yemek etiketi ana yemeğe eklenmez', () => {
    const a = byName('Tavuk Sote Test').id;
    const side = state().foodItems.find((i) => i.category === 'sideDishes')!;
    const changed = state().bulkUpdateTags([a, side.id], ['vegetable', 'rice'], []);
    assert.equal(changed, 2);
    const main = byName('Tavuk Sote Test');
    assert.ok(main.tags!.includes('poultry') && main.tags!.includes('vegetable'));
    assert.ok(!main.tags!.includes('rice'), 'yan yemek etiketi ana yemeğe eklendi');
    assert.ok(state().foodItems.find((i) => i.id === side.id)!.tags!.includes('rice'));
  });

  test('bulkUpdateTags: çıkarma yalnızca ilgili etiketi siler; değişiklik yoksa 0 döner', () => {
    const a = byName('Tavuk Sote Test').id;
    assert.equal(state().bulkUpdateTags([a], [], ['vegetable']), 1);
    assert.deepEqual(byName('Tavuk Sote Test').tags, ['poultry']);
    assert.equal(state().bulkUpdateTags([a], [], ['vegetable']), 0);
  });

  test('bulkUpdateTags: ara öğünler (snacks) ve bilinmeyen kimlikler atlanır', () => {
    const snack = state().foodItems.find((i) => i.category === 'snacks')!;
    const before = JSON.stringify(snack.tags);
    assert.equal(state().bulkUpdateTags([snack.id, 'yok-boyle-id'], ['vegetable'], []), 0);
    assert.equal(JSON.stringify(state().foodItems.find((i) => i.id === snack.id)!.tags), before, 'ara öğün etiketi değişti');
  });

  test('Özel etiket: kaydedilir ve toplu işlemle eklenip çıkarılabilir', () => {
    const a = byName('Tavuk Sote Test').id;
    state().bulkUpdateTags([a], ['yeni-etiket'], []);
    assert.ok(byName('Tavuk Sote Test').tags!.includes('yeni-etiket'));
    state().bulkUpdateTags([a], [], ['yeni-etiket']);
    assert.ok(!byName('Tavuk Sote Test').tags!.includes('yeni-etiket'));
  });

  console.log(`\n${passed} test geçti.`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
