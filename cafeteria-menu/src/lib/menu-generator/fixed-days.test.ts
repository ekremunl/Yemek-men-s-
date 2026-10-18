// Çalıştırma:  npx tsx src/lib/menu-generator/fixed-days.test.ts
import assert from 'node:assert/strict';
import { generateMonthlyMenu, validateMonthlyMenu } from './index';
import type { DayMenu } from './index';
import { SAMPLE_POOL } from './sample-pool';

const year = 2026;
const month = 11; // Kasım

const base = generateMonthlyMenu(SAMPLE_POOL, month, year, { seed: 7 });

// 1) Kilitli günler aynen korunur, diğerleri yeniden üretilir.
const lockedDates = ['2026-11-03', '2026-11-04', '2026-11-12'];
const fixedDays: DayMenu[] = base.days.filter((d) => lockedDates.includes(d.date));
const regen = generateMonthlyMenu(SAMPLE_POOL, month, year, { seed: 99, fixedDays });

for (const fixed of fixedDays) {
  const got = regen.days.find((d) => d.date === fixed.date)!;
  assert.deepEqual(
    JSON.stringify(got.meals),
    JSON.stringify(fixed.meals),
    `${fixed.date} kilitli gün değişmemeli`,
  );
}
const changed = regen.days.filter((d, i) => !lockedDates.includes(d.date) && JSON.stringify(d.meals) !== JSON.stringify(base.days[i].meals));
assert.ok(changed.length > 10, 'kilitsiz günlerin çoğu yeniden üretilmeli');

// 2) Sonuç tüm sert kuralları sağlar (kilitli günler dahil, ileriye dönük bekleme kuralı ile).
const violations = validateMonthlyMenu(regen);
assert.deepEqual(violations, [], `ihlal yok: ${JSON.stringify(violations.slice(0, 2))}`);

// 3) Kısmi aralık: yalnızca 8-14 Kasım yeniden üretilir, dışarısı aynen kalır.
const frozen: DayMenu[] = base.days.filter((d) => d.date < '2026-11-08' || d.date > '2026-11-14');
const week = generateMonthlyMenu(SAMPLE_POOL, month, year, { seed: 5, fixedDays: frozen });
for (const f of frozen) {
  assert.equal(JSON.stringify(week.days.find((d) => d.date === f.date)!.meals), JSON.stringify(f.meals));
}
assert.deepEqual(validateMonthlyMenu(week), []);

console.log('fixed-days testleri geçti');
