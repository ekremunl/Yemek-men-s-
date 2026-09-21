// src/lib/menu-bridge.test.ts
// Çalıştırma (cafeteria-menu klasöründe):  npx tsx src/lib/menu-bridge.test.ts
//
// menu.ts köprüsünü GERÇEK seedData ile sınar. Kontroller, motorun kurallarını
// kullanmadan, kullanıcı spesifikasyonu ve önceki sürümdeki eşleşme kuralları
// doğrudan yeniden yazılarak yapılır.
import assert from 'node:assert/strict';
import type { DailyMenu, FoodItem, MainMealKey } from '@/types';
import { SEED_DATA } from './seedData';
import {
  adaptSeedDataToDishes,
  dailyMenuToDayMenu,
  dayMenuToDailyMenu,
  foodItemsToDishes,
  formatMenuGenerationError,
  generateAutoMonthMenus,
  validateDailyMenus,
} from './menu';
import { MenuGenerationError } from './menu-generator';

const MEALS: MainMealKey[] = ['lunch', 'dinner'];
const byId = (items: FoodItem[]) => new Map(items.map((i) => [i.id, i]));
const PROTEINS = ['poultry', 'beef', 'fish'];
const STARCH = ['rice', 'pasta', 'bulgur', 'noodle', 'couscous'];
const INGREDIENT_WORDS = ['mercimek', 'nohut', 'fasulye', 'bezelye', 'tavuk', 'domates', 'patates', 'patlıcan', 'kabak', 'lahana', 'mantar', 'ıspanak'];
const weekdayOf = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, 12).getDay();
};

function check(menus: DailyMenu[], pool: FoodItem[], label: string, history: DailyMenu[] = []) {
  const items = byId(pool);
  const get = (id: string | null) => (id ? items.get(id)! : undefined);
  const all = [...history, ...menus].sort((a, b) => a.date.localeCompare(b.date));
  const offset = all.findIndex((m) => m.date === menus[0].date);

  const dishesOfMeal = (m: DailyMenu, k: MainMealKey) =>
    [m[k].soup, m[k].mainCourse, m[k].sideDish, m[k].complement].map(get).filter(Boolean) as FoodItem[];
  const dayDishes = (m: DailyMenu) => MEALS.flatMap((k) => dishesOfMeal(m, k));

  all.forEach((menu, idx) => {
    if (idx < offset) return;
    const weekend = [0, 6].includes(weekdayOf(menu.date));

    for (const k of MEALS) {
      const meal = menu[k];
      const where = `${label} ${menu.date} ${k}`;
      assert.ok(meal.soup && meal.mainCourse && meal.sideDish && meal.complement, `${where}: eksik çeşit`);
      const main = get(meal.mainCourse)!;
      const side = get(meal.sideDish)!;
      const dishes = dishesOfMeal(menu, k);

      // Hamur işi / karbonhidrat ağırlıklı ana yemek yanında pilav-makarna yok
      if (main.tags?.some((t) => t === 'dough' || t === 'carb_heavy')) {
        assert.ok(!side.tags?.some((t) => STARCH.includes(t)), `${where}: ${main.name} yanında ${side.name}`);
      }
      // Önceki sürümün eşleşme kuralları (son commit)
      const n = main.name.toLocaleLowerCase('tr-TR');
      if (n.includes('kuru fasulye') || n.includes('nohut')) assert.equal(side.name, 'Pirinç Pilavı', `${where}: ${main.name} + ${side.name}`);
      if (n.includes('yeşil mercimek') || n.includes('barbunya')) assert.ok(side.tags?.includes('pasta'), `${where}: ${main.name} + ${side.name}`);

      // Baskın bileşen çakışması yok
      for (const word of INGREDIENT_WORDS) {
        const holders = dishes.filter((d) => d.name.toLocaleLowerCase('tr-TR').includes(word));
        assert.ok(holders.length <= 1, `${where}: "${word}" tekrar (${holders.map((h) => h.name).join(' + ')})`);
      }
      // Bir öğünde en fazla bir baklagil yemeği
      assert.ok(dishes.filter((d) => d.tags?.includes('legume')).length <= 1, `${where}: birden fazla baklagil`);
    }

    // Aynı gün: protein tekrarı yok (hafta sonu senkron yemekler hariç)
    const lunch = dishesOfMeal(menu, 'lunch');
    const dinner = dishesOfMeal(menu, 'dinner');
    const lunchP = new Set(lunch.flatMap((d) => d.tags ?? []).filter((t) => PROTEINS.includes(t)));
    for (const d of dinner) {
      if (lunch.some((l) => l.id === d.id)) continue;
      for (const t of d.tags ?? []) assert.ok(!(PROTEINS.includes(t) && lunchP.has(t)), `${label} ${menu.date}: ${t} öğle+akşam (${d.name})`);
    }
    // Öğlen baklagil (ana/yan) → akşam hafif ve baklagilsiz
    if ([menu.lunch.mainCourse, menu.lunch.sideDish].some((id) => get(id)?.tags?.includes('legume'))) {
      assert.ok(!dinner.some((d) => d.tags?.includes('legume')), `${label} ${menu.date}: baklagil akşama taştı`);
      assert.ok(get(menu.dinner.mainCourse)!.tags?.some((t) => ['vegetable', 'light', 'fish'].includes(t)), `${label} ${menu.date}: akşam ana yemek hafif değil`);
    }
    // Hafta sonu: öğle ana yemeği pratik + akşam çorba/yan/tamamlayıcı öğleyle aynı
    if (weekend) {
      assert.ok(get(menu.lunch.mainCourse)!.tags?.includes('practical'), `${label} ${menu.date}: hafta sonu öğle pratik değil`);
      for (const f of ['soup', 'sideDish', 'complement'] as const) assert.equal(menu.dinner[f], menu.lunch[f], `${label} ${menu.date}: hafta sonu ${f} senkron değil`);
    } else {
      for (const f of ['soup', 'sideDish', 'complement'] as const) assert.notEqual(menu.dinner[f], menu.lunch[f], `${label} ${menu.date}: hafta içi ${f} aynı`);
    }
    assert.notEqual(menu.lunch.mainCourse, menu.dinner.mainCourse, `${label} ${menu.date}: aynı ana yemek iki öğünde`);
    assert.ok(menu.snack, `${label} ${menu.date}: ara öğün yok`);
  });

  // Aynı ana yemek: sonraki 5 gün içinde tekrar yok
  for (let i = Math.max(offset, 0); i < all.length; i++) {
    for (let j = Math.max(0, i - 5); j < i; j++) {
      for (const a of MEALS) for (const b of MEALS) {
        assert.notEqual(all[j][a].mainCourse, all[i][b].mainCourse, `${label}: ${all[j].date} ve ${all[i].date} aynı ana yemek`);
      }
    }
  }
  // Aynı protein 3 gün üst üste yok
  for (const p of PROTEINS) {
    for (let i = Math.max(offset, 2); i < all.length; i++) {
      const streak = [i - 2, i - 1, i].every((k) => dayDishes(all[k]).some((d) => d.tags?.includes(p)));
      assert.ok(!streak, `${label} ${all[i].date}: ${p} 3 gün üst üste`);
    }
  }
}

let passed = 0;
const test = (name: string, fn: () => void) => {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
};

console.log('menu.ts köprüsü testleri (gerçek seedData)');

test('12 ay × 15 seed: tüm kurallar + eski eşleşme kuralları + hafta sonu senkronu sağlanıyor', () => {
  const t0 = Date.now();
  let runs = 0;
  let maxAttempts = 1;
  const months: Array<[number, number]> = [...Array.from({ length: 12 }, (_, m) => [2026, m] as [number, number]), [2028, 1]];
  for (const [year, month] of months) {
    for (let seed = 1; seed <= 15; seed++) {
      const gen = generateAutoMonthMenus(SEED_DATA, year, month, [], { seed });
      const days = new Date(year, month + 1, 0).getDate();
      assert.equal(gen.menus.length, days);
      check(gen.menus, SEED_DATA, `${year}-${month + 1} seed=${seed}`);
      assert.deepEqual(validateDailyMenus(gen.menus, SEED_DATA), [], 'validateDailyMenus temiz olmalı');
      runs++;
    }
  }
  console.log(`    ${runs} menü, ${Date.now() - t0} ms`);
  void maxAttempts;
});

test('Ay geçişi: önceki ayın son günleri bekleme/protein kurallarına dahil', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const sept = generateAutoMonthMenus(SEED_DATA, 2026, 8, [], { seed }).menus;
    const oct = generateAutoMonthMenus(SEED_DATA, 2026, 9, sept, { seed: seed + 100 }).menus;
    check(oct, SEED_DATA, `carry-in seed=${seed}`, sept);
  }
});

test('Aynı seed → aynı menü; farklı seed → farklı menü', () => {
  const a = generateAutoMonthMenus(SEED_DATA, 2026, 9, [], { seed: 7 });
  const b = generateAutoMonthMenus(SEED_DATA, 2026, 9, [], { seed: 7 });
  const c = generateAutoMonthMenus(SEED_DATA, 2026, 9, [], { seed: 8 });
  assert.deepEqual(a.menus, b.menus);
  assert.notDeepEqual(a.menus, c.menus);
});

test('Etiketsiz (elle eklenmiş) yemekler isimden çıkarılan etiketlerle korunuyor', () => {
  const pool: FoodItem[] = [
    ...SEED_DATA,
    { id: 'u1', name: 'Kıymalı Börek', category: 'mainCourses' }, // etiket yok
    { id: 'u2', name: 'Mercimekli Köfte', category: 'mainCourses' }, // baklagil, et DEĞİL
  ];
  const dishes = foodItemsToDishes(pool);
  const borek = dishes.find((d) => d.id === 'u1')!;
  assert.ok(borek.tags.includes('hamur_isi') && borek.tags.includes('pratik'));
  const kofte = dishes.find((d) => d.id === 'u2')!;
  assert.ok(kofte.tags.includes('bakliyat') && !kofte.tags.includes('kirmizi_et'));

  // Denetleyiciye, motorun çıkarımından BAĞIMSIZ olarak elle yazılmış beklenen etiketler verilir.
  const expectedPool: FoodItem[] = pool.map((item) =>
    item.id === 'u1'
      ? { ...item, tags: ['dough', 'carb_heavy', 'beef', 'practical'] }
      : item.id === 'u2'
        ? { ...item, tags: ['legume', 'vegetarian'] }
        : item,
  );

  let appeared = 0;
  for (let seed = 1; seed <= 25; seed++) {
    const { menus } = generateAutoMonthMenus(pool, 2026, 9, [], { seed });
    check(menus, expectedPool, `custom seed=${seed}`);
    for (const m of menus) for (const k of MEALS) {
      if (m[k].mainCourse === 'u1') {
        appeared++;
        assert.ok(!byId(expectedPool).get(m[k].sideDish!)!.tags?.some((t) => STARCH.includes(t)), 'Börek yanında pilav/makarna');
      }
    }
  }
  assert.ok(appeared > 0, 'Etiketsiz "Kıymalı Börek" hiç kullanılmadı (pratik olarak algılanmalıydı)');
});

test('Adapter ve dönüştürücüler', () => {
  const dishes = adaptSeedDataToDishes();
  assert.equal(dishes.length, SEED_DATA.filter((i) => i.category !== 'snacks').length);
  const manti = dishes.find((d) => d.name === 'Mantı')!;
  assert.deepEqual([manti.category, manti.tags.includes('hamur_isi'), manti.tags.includes('pratik')], ['ana_yemek', true, true]);
  const dishById = new Map(dishes.map((d) => [d.id, d]));

  const { menus } = generateAutoMonthMenus(SEED_DATA, 2026, 9, [], { seed: 3 });
  for (const menu of menus.slice(0, 5)) {
    const roundTrip = dayMenuToDailyMenu(dailyMenuToDayMenu(menu, dishById), menu.snack);
    assert.deepEqual(roundTrip, menu);
  }
});

test('validateDailyMenus elle bozulmuş menüyü yakalıyor (Mantı + pilav)', () => {
  const { menus } = generateAutoMonthMenus(SEED_DATA, 2026, 9, [], { seed: 5 });
  const bozuk: DailyMenu[] = structuredClone(menus);
  bozuk[3].dinner.mainCourse = 'm21'; // Mantı
  bozuk[3].dinner.sideDish = 'd1'; // Pirinç Pilavı
  const violations = validateDailyMenus(bozuk, SEED_DATA);
  assert.ok(violations.some((v) => v.ruleId === 'INTRA_CARB_MAIN_WITH_RICE_PASTA'), JSON.stringify(violations.map((v) => v.ruleId)));
});

test('Yetersiz havuz → Türkçe, anlaşılır hata mesajı', () => {
  const noPractical = SEED_DATA.filter((i) => !i.tags?.includes('practical'));
  try {
    generateAutoMonthMenus(noPractical, 2026, 9, [], { seed: 1 });
    assert.fail('Hata bekleniyordu');
  } catch (e) {
    assert.ok(e instanceof MenuGenerationError);
    const msg = formatMenuGenerationError(e);
    assert.match(msg, /pratik|practical/i);
    console.log(`    örnek mesaj: ${msg}`);
  }
});

console.log(`\n${passed} test geçti.`);
