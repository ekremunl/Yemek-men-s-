// lib/menu-generator/menu-generator.test.ts
// Çalıştırma:  npx tsx lib/menu-generator/menu-generator.test.ts
//
// Bu testler, generator'ın kendi kurallarını KULLANMADAN, kullanıcı
// spesifikasyonunu doğrudan yeniden yazarak çıktıyı denetler.
import assert from 'node:assert/strict';
import { generateMonthlyMenu, MenuGenerationError, validateMonthlyMenu } from './index';
import type { DayMenu, Dish, MonthlyMenu } from './index';
import { SAMPLE_POOL } from './sample-pool';

const SLOTS = ['ogle', 'aksam'] as const;
const PROTEINS = ['tavuk', 'kirmizi_et', 'balik'];
const dishesOf = (meal: DayMenu['meals']['ogle']): Dish[] => Object.values(meal).filter(Boolean) as Dish[];
const dayDishes = (d: DayMenu) => SLOTS.flatMap((s) => dishesOf(d.meals[s]));

function checkSpec(menu: MonthlyMenu, label: string, history: DayMenu[] = []) {
  const days = [...history, ...menu.days];
  const offset = history.length;

  days.forEach((day, i) => {
    if (i < offset) return;
    for (const slot of SLOTS) {
      const meal = day.meals[slot];
      const all = dishesOf(meal);
      const where = `${label} ${day.date} ${slot}`;

      // Tam menü: 4 kategori dolu
      assert.ok(meal.ana_yemek && meal.yan_urun && meal.çorba && meal.tatli_meyve, `${where}: eksik kategori`);

      // 1a) Hamur işi / karbonhidrat ağırlıklı ana yemek yanında pilav/makarna yok
      if (meal.ana_yemek!.tags.some((t) => t === 'hamur_isi' || t === 'karbonhidrat_agirlikli')) {
        assert.ok(!all.some((d) => d !== meal.ana_yemek && d.tags.includes('pilav_makarna')),
          `${where}: ${meal.ana_yemek!.name} yanında pilav/makarna`);
      }
      // incompatibleWithTags
      for (const a of all) for (const b of all) if (a !== b) {
        assert.ok(!a.incompatibleWithTags?.some((t) => b.tags.includes(t)), `${where}: ${a.name} ↔ ${b.name} uyumsuz`);
      }
      // 1b) Baskın bileşen çakışması yok
      const seen = new Set<string>();
      for (const d of all) for (const ing of d.mainIngredients ?? []) {
        assert.ok(!seen.has(ing), `${where}: "${ing}" bileşeni tekrar (${d.name})`);
        seen.add(ing);
      }
    }

    // 2a) Öğle protein grubu akşamda tekrar etmez
    const lunchP = new Set(dishesOf(day.meals.ogle).flatMap((d) => d.tags).filter((t) => PROTEINS.includes(t)));
    const dinnerP = dishesOf(day.meals.aksam).flatMap((d) => d.tags).filter((t) => PROTEINS.includes(t));
    for (const p of dinnerP) assert.ok(!lunchP.has(p), `${label} ${day.date}: ${p} hem öğle hem akşam`);

    // 2b) Öğlen bakliyat (ana/yan) varsa akşam hafif ve bakliyatsız
    const lunchLegume = [day.meals.ogle.ana_yemek, day.meals.ogle.yan_urun].some((d) => d?.tags.includes('bakliyat'));
    if (lunchLegume) {
      assert.ok(!dishesOf(day.meals.aksam).some((d) => d.tags.includes('bakliyat')), `${label} ${day.date}: bakliyat akşama taştı`);
      assert.ok(day.meals.aksam.ana_yemek!.tags.some((t) => t === 'sebze' || t === 'hafif'),
        `${label} ${day.date}: akşam ana yemek hafif değil (${day.meals.aksam.ana_yemek!.name})`);
    }

    // 3) Hafta sonu öğle ana yemeği pratik
    if (day.weekday === 0 || day.weekday === 6) {
      assert.ok(day.meals.ogle.ana_yemek!.tags.includes('pratik'),
        `${label} ${day.date}: hafta sonu öğle "${day.meals.ogle.ana_yemek!.name}" pratik değil`);
    }
  });

  // 4a) Aynı ana yemek: kullanıldığı günden sonraki 5 gün içinde ve aynı gün tekrar yok
  const mains = days.map((d) => SLOTS.map((s) => d.meals[s].ana_yemek?.id));
  for (let i = offset; i < days.length; i++) {
    for (let j = Math.max(0, i - 5); j <= i; j++) {
      const ids = j === i ? mains[i] : [...mains[j], ...mains[i]];
      const filtered = ids.filter(Boolean);
      if (j === i) assert.equal(new Set(filtered).size, filtered.length, `${label} ${days[i].date}: aynı gün aynı ana yemek`);
      else for (const a of mains[j]) for (const b of mains[i]) {
        assert.ok(!a || a !== b, `${label}: ${days[j].date} ve ${days[i].date} aynı ana yemek (${a})`);
      }
    }
  }

  // 4b) Aynı protein 3 gün üst üste gelmez
  for (const p of PROTEINS) {
    for (let i = Math.max(offset, 2); i < days.length; i++) {
      const streak = [i - 2, i - 1, i].every((k) => dayDishes(days[k]).some((d) => d.tags.includes(p)));
      assert.ok(!streak, `${label} ${days[i].date}: ${p} 3 gün üst üste`);
    }
  }
}

let passed = 0;
const test = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
};

console.log('menu-generator testleri');

test('Farklı ay/yıl/seed kombinasyonlarında tüm kurallar sağlanıyor (kuralsız bağımsız denetim)', () => {
  const t0 = Date.now();
  let runs = 0;
  let maxAttempts = 1;
  for (const [year, month] of [[2026, 10], [2027, 2], [2026, 12], [2028, 2], [2026, 5], [2026, 8]] as const) {
    for (let seed = 1; seed <= 25; seed++) {
      const menu = generateMonthlyMenu(SAMPLE_POOL, month, year, { seed });
      assert.equal(menu.days.length, new Date(Date.UTC(year, month, 0)).getUTCDate());
      checkSpec(menu, `${year}-${month} seed=${seed}`);
      assert.deepEqual(validateMonthlyMenu(menu), [], 'validateMonthlyMenu temiz olmalı');
      maxAttempts = Math.max(maxAttempts, menu.attempts);
      runs++;
    }
  }
  console.log(`    ${runs} menü, ${Date.now() - t0} ms, en fazla deneme: ${maxAttempts}`);
});

test('Aynı seed → birebir aynı menü', () => {
  const a = generateMonthlyMenu(SAMPLE_POOL, 10, 2026, { seed: 42 });
  const b = generateMonthlyMenu(SAMPLE_POOL, 10, 2026, { seed: 42 });
  assert.deepEqual(a.days, b.days);
  const c = generateMonthlyMenu(SAMPLE_POOL, 10, 2026, { seed: 43 });
  assert.notDeepEqual(a.days, c.days);
});

test('Önceki ayın son günleri bekleme kurallarına dahil ediliyor', () => {
  const sept = generateMonthlyMenu(SAMPLE_POOL, 9, 2026, { seed: 7 });
  const tail = sept.days.slice(-6);
  for (let seed = 1; seed <= 15; seed++) {
    const oct = generateMonthlyMenu(SAMPLE_POOL, 10, 2026, { seed, previousDays: tail });
    checkSpec(oct, `carry-in seed=${seed}`, tail);
    assert.deepEqual(validateMonthlyMenu(oct, { previousDays: tail }), []);
  }
});

test('Doğrulayıcı elle bozulmuş menüdeki ihlalleri yakalıyor', () => {
  const menu = generateMonthlyMenu(SAMPLE_POOL, 10, 2026, { seed: 5 });
  const manti = SAMPLE_POOL.find((d) => d.id === 'm-manti')!;
  const pilav = SAMPLE_POOL.find((d) => d.id === 's-pirinc')!;
  const bozuk: MonthlyMenu = structuredClone(menu);
  bozuk.days[2].meals.aksam.ana_yemek = manti;
  bozuk.days[2].meals.aksam.yan_urun = pilav;
  const v = validateMonthlyMenu(bozuk);
  assert.ok(v.some((x) => x.ruleId === 'INTRA_CARB_MAIN_WITH_RICE_PASTA' || x.ruleId === 'INTRA_INCOMPATIBLE_TAGS'));
});

test('Mercimek Çorbası + Mercimekli Köfte birlikte gelmiyor (hedefli senaryo)', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const menu = generateMonthlyMenu(SAMPLE_POOL, 3, 2027, { seed });
    for (const day of menu.days) for (const s of SLOTS) {
      const m = day.meals[s];
      const names = [m.çorba?.name, m.ana_yemek?.name];
      assert.ok(!(names.includes('Mercimek Çorbası') && names.includes('Mercimekli Köfte')));
      assert.ok(!(names.includes('Ezogelin Çorbası') && names.includes('Mercimekli Köfte')));
    }
  }
});

test('Yetersiz havuz → açıklayıcı hata', () => {
  const small = SAMPLE_POOL.filter((d) => d.category !== 'ana_yemek' || d.tags.includes('tavuk'));
  assert.throws(() => generateMonthlyMenu(small, 10, 2026, { seed: 1 }), (e: unknown) =>
    e instanceof MenuGenerationError && /yetersiz|pratik/.test(e.message));
});

test('Çözümsüz kısıt → MenuGenerationError + teşhis bilgisi', () => {
  // Yeterince yemek var ama akşam ana yemeğinin tamamı tavuk: protein kuralı çakışır.
  const pool = SAMPLE_POOL.filter((d) => d.category !== 'ana_yemek' || d.tags.includes('tavuk') || d.tags.includes('pratik'));
  try {
    generateMonthlyMenu(pool, 10, 2026, { seed: 1, maxAttempts: 2, maxBacktracksPerAttempt: 2000 });
    assert.fail('Hata bekleniyordu');
  } catch (e) {
    assert.ok(e instanceof MenuGenerationError);
    assert.ok((e as MenuGenerationError).diagnostics?.rejectedBy, 'diagnostics dolu olmalı');
    console.log(`    örnek mesaj: ${(e as MenuGenerationError).message}`);
  }
});

test('Geçersiz parametreler', () => {
  assert.throws(() => generateMonthlyMenu(SAMPLE_POOL, 0, 2026), RangeError);
  assert.throws(() => generateMonthlyMenu(SAMPLE_POOL, 13, 2026), RangeError);
});

console.log(`\n${passed} test geçti.`);

// Örnek çıktı
const demo = generateMonthlyMenu(SAMPLE_POOL, 10, 2026, { seed: 2026 });
const gun = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
console.log('\nEkim 2026 (ilk 9 gün) — seed 2026');
for (const d of demo.days.slice(0, 9)) {
  const f = (s: 'ogle' | 'aksam') => {
    const m = d.meals[s];
    return [m.çorba, m.ana_yemek, m.yan_urun, m.tatli_meyve].map((x) => x?.name).join(' | ');
  };
  console.log(`${d.date} ${gun[d.weekday]}\n   Öğle : ${f('ogle')}\n   Akşam: ${f('aksam')}`);
}
