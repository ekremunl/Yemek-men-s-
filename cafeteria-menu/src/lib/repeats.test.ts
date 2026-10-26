// Çalıştırma:  npx tsx src/lib/repeats.test.ts
import assert from 'node:assert/strict';
import { analyzeRepeats, nameStems } from './repeats';
import { createEmptyDailyMenu } from './menu';
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

console.log('tekrar özeti testleri geçti');
