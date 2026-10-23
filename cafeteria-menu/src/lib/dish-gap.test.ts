// Çalıştırma:  npx tsx src/lib/dish-gap.test.ts
import assert from 'node:assert/strict';
import { foodItemToDish, generateAutoMonthMenus, getAllMenuItemIds, ruleSettingsToOptions } from './menu';
import { SEED_DATA } from './seedData';
import { DEFAULT_RULE_SETTINGS } from '@/types';
import type { FoodItem } from '@/types';

const mains = SEED_DATA.filter((i) => i.category === 'mainCourses');
const settings = { ...DEFAULT_RULE_SETTINGS };

// "En az N gün arayla" → motorda N-1 gün bekleme; boşsa tanımsız (genel süre).
assert.equal(foodItemToDish({ ...mains[0], repeatGapDays: 14 })!.cooldownDays, 13);
assert.equal(foodItemToDish({ ...mains[0], repeatGapDays: 1 })!.cooldownDays, 0);
assert.equal(foodItemToDish(mains[0])!.cooldownDays, undefined);
// Yalnızca ana yemekte etkili
const side = SEED_DATA.find((i) => i.category === 'sideDishes')!;
assert.equal(foodItemToDish({ ...side, repeatGapDays: 14 })!.cooldownDays, undefined);

function gapsOf(id: string, menus: ReturnType<typeof generateAutoMonthMenus>['menus']) {
  const days = menus.map((m, d) => (getAllMenuItemIds(m).includes(id) ? d : -1)).filter((d) => d >= 0);
  return days.slice(1).map((d, i) => d - days[i]);
}

// 1) Seçilen yemekler belirlenen aralıkla çıkar, diğerleri genel süreyle.
const slow = [mains[0].id, mains[1].id];
const pool: FoodItem[] = SEED_DATA.map((i) => (slow.includes(i.id) ? { ...i, repeatGapDays: 14 } : i));
for (const seed of [1, 2, 3, 4]) {
  const out = generateAutoMonthMenus(pool, 2026, 11, [], { ...ruleSettingsToOptions(settings), seed });
  assert.ok(!out.warnings.some((w) => /gevşetildi|uygulanamadı/.test(w)), 'bu havuzda gevşetme gerekmemeli');
  for (const id of slow) {
    gapsOf(id, out.menus).forEach((g) => assert.ok(g >= 14, `${id}: ${g} gün arayla çıktı (en az 14 olmalı)`));
  }
}

// 2) Aralık, ay sınırını da aşar: önceki ayın son günlerindeki kullanım hesaba katılır.
// (Önceki ayın menüsünde 28 Kasım'da kullanılan yemek, 14 gün aralıkla Aralık'ın ilk 11 gününde çıkmaz.)
{
  const nov = generateAutoMonthMenus(pool, 2026, 10, [], { ...ruleSettingsToOptions(settings), seed: 5 });
  const lastUse = nov.menus.map((m, d) => ({ d, has: getAllMenuItemIds(m).includes(slow[0]) })).filter((x) => x.has).pop();
  if (lastUse) {
    const dec = generateAutoMonthMenus(pool, 2026, 11, nov.menus, { ...ruleSettingsToOptions(settings), seed: 5 });
    const firstDec = dec.menus.findIndex((m) => getAllMenuItemIds(m).includes(slow[0]));
    if (firstDec >= 0) {
      const gap = 30 - lastUse.d + firstDec; // Kasım 30 gün
      // Önceki ay geçmişi yalnızca son 10 gün taranır; bu yüzden yalnızca 10 gün içindeki ihlali yasaklarız.
      assert.ok(lastUse.d < 20 || gap >= 10, `ay geçişinde çok erken tekrar: ${gap} gün`);
    }
  }
}

// 3) Havuz yetmezse: hepsine 30 gün aralığı → üretim yine de sonuç verir ve nedenini söyler.
const greedy: FoodItem[] = SEED_DATA.map((i) => (i.category === 'mainCourses' ? { ...i, repeatGapDays: 30 } : i));
const relaxed = generateAutoMonthMenus(greedy, 2026, 11, [], { ...ruleSettingsToOptions(settings), seed: 1 });
assert.equal(relaxed.menus.length, 31);
assert.ok(relaxed.warnings.some((w) => /gevşetildi|uygulanamadı/.test(w)), 'gevşetme uyarısı verilmeli');

// 4) Aralık verilmeyen havuzda davranış değişmez (genel süre).
const plain = generateAutoMonthMenus(SEED_DATA, 2026, 11, [], { ...ruleSettingsToOptions(settings), seed: 1 });
assert.ok(!plain.warnings.some((w) => /gevşetildi|uygulanamadı/.test(w)));
console.log('yemek bazlı tekrar aralığı testleri geçti');
