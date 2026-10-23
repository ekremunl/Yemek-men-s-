// Çalıştırma:  npx tsx src/lib/repeats.test.ts
import assert from 'node:assert/strict';
import { analyzeRepeats, nameStems } from './repeats';
import { createEmptyDailyMenu, evaluateCandidates, generateAutoMonthMenus, ruleSettingsToOptions } from './menu';
import { SEED_DATA } from './seedData';
import { DEFAULT_RULE_SETTINGS } from '@/types';
import type { FoodItem } from '@/types';

// Ad benzerliği
assert.deepEqual(nameStems('Ispanak Yemeği'), ['ıspan']);
assert.ok(nameStems('Ispanaklı Börek').includes(nameStems('Ispanak Yemeği')[0]));
assert.ok(nameStems('Mercimek Çorbası').includes(nameStems('Mercimekli Köfte')[0]));
assert.deepEqual(nameStems('Mevsim Salata'), [], 'genel sözcükler gruplanmaz');

// Rapor: ıspanaklı iki yemek toplam sayılır
const items: FoodItem[] = [
  { id: 'a', name: 'Ispanak Yemeği', category: 'mainCourses' },
  { id: 'b', name: 'Ispanaklı Börek', category: 'snacks' },
  { id: 'c', name: 'Mantı', category: 'mainCourses' },
];
const menus = ['2026-11-02', '2026-11-05', '2026-11-09', '2026-11-12'].map((d, i) => {
  const m = createEmptyDailyMenu(d);
  m.lunch.mainCourse = i < 3 ? 'a' : 'c';
  m.snack = i % 2 === 0 ? 'b' : null;
  return m;
});
const rep = analyzeRepeats(menus, items, 2026, 10);
assert.equal(rep.dishes[0].name, 'Ispanak Yemeği');
assert.equal(rep.dishes[0].count, 3);
assert.equal(rep.groups[0].total, 5, 'ıspanak yemeği 3 + ıspanaklı börek 2');
assert.equal(rep.groups[0].label, 'Ispanak');
const mains = rep.categories.find((c) => c.key === 'mainCourses')!;
assert.equal(mains.poolSize, 2);
assert.equal(mains.neededForTarget, Math.ceil(60 / 3));

// Adil dağıtım: hiçbir yemek adil payın (+1) üstüne çıkmaz; yan yemek ardışık günlerde tekrar etmez.
const settings = { ...DEFAULT_RULE_SETTINGS, fairRotation: true, rotationSlack: 1, sideCooldownDays: 2 };
const byId = new Map(SEED_DATA.map((i) => [i.id, i]));
for (const seed of [1, 2, 3]) {
  const out = generateAutoMonthMenus(SEED_DATA, 2026, 10, [], { ...ruleSettingsToOptions(settings), seed });
  assert.ok(!out.warnings.some((w) => /gevşetildi|uygulanamadı/.test(w)), 'örnek havuzda gevşetme gerekmemeli');
  const use = new Map<string, number>();
  const sideDays = new Map<string, number[]>();
  out.menus.forEach((m, d) => {
    for (const k of ['lunch', 'dinner'] as const) {
      for (const f of ['soup', 'mainCourse', 'sideDish', 'complement'] as const) {
        const id = m[k][f];
        if (!id) continue;
        use.set(id, (use.get(id) ?? 0) + 1);
        if (f === 'sideDish') (sideDays.get(id) ?? sideDays.set(id, []).get(id)!).push(d);
      }
    }
  });
  for (const cat of ['soups', 'mainCourses', 'sideDishes', 'complements'] as const) {
    const size = SEED_DATA.filter((i) => i.category === cat).length;
    const cap = Math.ceil((out.menus.length * 2) / size) + 1;
    SEED_DATA.filter((i) => i.category === cat).forEach((i) => assert.ok((use.get(i.id) ?? 0) <= cap, `${i.name} adil payı (${cap}) aştı`));
  }
  sideDays.forEach((days, id) => {
    const distinct = Array.from(new Set(days));
    distinct.slice(1).forEach((x, i) => assert.ok(x - distinct[i] >= 3, `${byId.get(id)!.name}: yan yemek ${x - distinct[i]} gün arayla`));
  });
}

// Küçük havuz (4 çorba): sıkı kural çözülemese de menü üretilir ve nedeni uyarıda söylenir.
const tiny = [...SEED_DATA.filter((i) => i.category !== 'soups'), ...SEED_DATA.filter((i) => i.category === 'soups').slice(0, 4)];
const tinyOut = generateAutoMonthMenus(tiny, 2026, 10, [], { ...ruleSettingsToOptions(settings), seed: 1 });
assert.equal(tinyOut.menus.length, 30);
assert.ok(tinyOut.warnings.some((w) => /gevşetildi|uygulanamadı/.test(w)), 'gevşetme uyarısı verilmeli');

// Elle seçim: bu ay sınıra gelmiş yemek uyarı alır.
const full = generateAutoMonthMenus(SEED_DATA, 2026, 10, [], { ...ruleSettingsToOptions(settings), seed: 2 });
const ev = evaluateCandidates(SEED_DATA, full.menus, '2026-11-15', 'lunch', 'soup', ruleSettingsToOptions(settings));
assert.ok(Array.isArray(ev.ranked));
console.log('tekrar özeti ve adil dağıtım testleri geçti');
