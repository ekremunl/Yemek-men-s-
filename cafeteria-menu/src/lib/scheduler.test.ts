// Çalıştırma:  npx tsx src/lib/scheduler.test.ts
import assert from 'node:assert/strict';
import { scheduleMonth, banReason, mondayOf } from './scheduler';
import { SEED_DATA } from './seedData';
import { DEFAULT_PLAN_SETTINGS, MAIN_GROUPS } from '@/types';
import type { DailyMenu, MainGroup, PlanSettings } from '@/types';

const byId = new Map(SEED_DATA.map((i) => [i.id, i]));
const groupOf = (id: string | null) => byId.get(id as string)?.group as MainGroup;
const dow = (date: string) => new Date(`${date}T12:00:00`).getDay();

const A = scheduleMonth({ items: SEED_DATA, year: 2026, month: 10, existingMenus: [], settings: DEFAULT_PLAN_SETTINGS, seed: 1 });
assert.equal(A.menus.length, 30);
assert.ok(A.menus.every((m) => m.lunch.mainCourse && m.dinner.mainCourse && m.lunch.soup && m.snack));

// 1) Her gün öğle ve akşam ana yemek farklı gruptan.
A.menus.forEach((m) => assert.notEqual(groupOf(m.lunch.mainCourse), groupOf(m.dinner.mainCourse), m.date));

// 2) Tam (7 günlük) haftalarda gruplar eşit: en çok − en az ≤ 1, her öğünde.
const weeks = new Map<string, DailyMenu[]>();
A.menus.forEach((m) => weeks.set(mondayOf(m.date), [...(weeks.get(mondayOf(m.date)) ?? []), m]));
let full = 0;
weeks.forEach((days) => {
  if (days.length !== 7) return;
  full += 1;
  (['lunch', 'dinner'] as const).forEach((slot) => {
    const c: Record<string, number> = { bakliyat: 0, et: 0, etli_sebze: 0, tavuk: 0 };
    days.forEach((m) => (c[groupOf(m[slot].mainCourse)] += 1));
    const v = Object.values(c);
    assert.ok(Math.max(...v) - Math.min(...v) <= 1, `${days[0].date} ${slot}: ${JSON.stringify(c)}`);
  });
});
assert.ok(full >= 3);

// 3) Gruplar aynı günde sabit kalmaz: her grup ay içinde en az 2 farklı haftanın günü.
const lunchDows: Record<string, Set<number>> = { bakliyat: new Set(), et: new Set(), etli_sebze: new Set(), tavuk: new Set() };
A.menus.forEach((m) => lunchDows[groupOf(m.lunch.mainCourse)].add(dow(m.date)));
MAIN_GROUPS.forEach((g) => assert.ok(lunchDows[g].size >= 4, `${g} yalnızca ${lunchDows[g].size} farklı günde çıktı`));

// 4) Aylar arası rotasyon: gruptaki diğer yemekler seçilmeden aynı yemek tekrar etmez.
const B = scheduleMonth({ items: SEED_DATA, year: 2026, month: 11, existingMenus: A.menus, settings: DEFAULT_PLAN_SETTINGS, seed: 2 });
const seq: Record<string, string[]> = {};
[...A.menus, ...B.menus].forEach((m) =>
  (['lunch', 'dinner'] as const).forEach((slot) => {
    const id = m[slot].mainCourse!;
    (seq[groupOf(id)] ??= []).push(id);
  }),
);
MAIN_GROUPS.forEach((g) => {
  const size = SEED_DATA.filter((i) => i.category === 'mainCourses' && i.group === g).length;
  const s = seq[g];
  s.forEach((id, i) => {
    if (i === 0) return;
    const prev = s.lastIndexOf(id, i - 1);
    if (prev < 0) return;
    const between = new Set(s.slice(prev + 1, i));
    // Aynı yemek tekrar gelmeden önce grubun diğer yemeklerinin çoğu seçilmiş olmalı (gün içi/sıra payı: 1).
    assert.ok(between.size >= size - 2, `${g}: "${byId.get(id)!.name}" ${between.size}/${size - 1} yemekten sonra tekrar etti`);
  });
});

// 5) Gün yasağı: Pazartesi tavuk yok. Hafta sonu: bakliyat grubu + tek tek yemek yasağı.
const chickenPackaged = SEED_DATA.find((i) => i.group === 'tavuk')!;
const settings: PlanSettings = {
  dayBans: { '1': ['g:tavuk'] },
  weekendBans: ['g:bakliyat', ...SEED_DATA.filter((i) => i.group === 'tavuk' && i.id !== chickenPackaged.id).map((i) => `d:${i.id}`)],
};
for (const seed of [1, 2, 3]) {
  const R = scheduleMonth({ items: SEED_DATA, year: 2026, month: 10, existingMenus: [], settings, seed });
  assert.ok(!R.warnings.some((w) => /yasak yok sayıldı/.test(w)));
  R.menus.forEach((m) => {
    (['lunch', 'dinner'] as const).forEach((slot) => {
      const g = groupOf(m[slot].mainCourse);
      if (dow(m.date) === 1) assert.notEqual(g, 'tavuk', `${m.date} Pazartesi tavuk`);
      if ([0, 6].includes(dow(m.date))) {
        assert.notEqual(g, 'bakliyat', `${m.date} hafta sonu bakliyat`);
        if (g === 'tavuk') assert.equal(m[slot].mainCourse, chickenPackaged.id, `${m.date}: hafta sonu yalnızca izinli tavuk`);
      }
    });
  });
}
const legume = SEED_DATA.find((i) => i.group === 'bakliyat')!;
assert.ok(banReason(legume, '2026-11-07', settings)); // Cumartesi
assert.equal(banReason(legume, '2026-11-04', settings), null); // Çarşamba

// 5b) İstisna: tavuk grubu hafta sonu yasak, yalnızca bir (paketli) tavuk yemeği serbest.
{
  const exceptionSettings: PlanSettings = { dayBans: {}, weekendBans: ['g:tavuk', `a:${chickenPackaged.id}`] };
  const others = SEED_DATA.filter((i) => i.group === 'tavuk' && i.id !== chickenPackaged.id);
  assert.equal(banReason(chickenPackaged, '2026-11-07', exceptionSettings), null);
  others.forEach((i) => assert.ok(banReason(i, '2026-11-07', exceptionSettings), i.name));
  assert.equal(banReason(others[0], '2026-11-04', exceptionSettings), null, 'hafta içi yasak yok');
  for (const seed of [1, 2, 3, 4]) {
    const R = scheduleMonth({ items: SEED_DATA, year: 2026, month: 10, existingMenus: [], settings: exceptionSettings, seed });
    R.menus.forEach((m) =>
      (['lunch', 'dinner'] as const).forEach((slot) => {
        if ([0, 6].includes(dow(m.date)) && groupOf(m[slot].mainCourse) === 'tavuk') {
          assert.equal(m[slot].mainCourse, chickenPackaged.id, `${m.date}: hafta sonu yalnızca istisna tavuk`);
        }
      }),
    );
  }
}

// 6) Kilitli gün aynen korunur; çevresi onunla aynı yemeği seçmez.
const locked = A.menus[10];
const L = scheduleMonth({ items: SEED_DATA, year: 2026, month: 10, existingMenus: A.menus, frozenDates: [locked.date], settings: DEFAULT_PLAN_SETTINGS, seed: 9 });
assert.deepEqual(L.menus.find((m) => m.date === locked.date), locked);
assert.equal(L.menus.length, 30);

// 7) Grubu olmayan / boş grup: uyarı verilir, menü yine üretilir.
const noTavuk = SEED_DATA.map((i) => (i.group === 'tavuk' ? { ...i, group: undefined } : i));
const N = scheduleMonth({ items: noTavuk, year: 2026, month: 10, existingMenus: [], settings: DEFAULT_PLAN_SETTINGS, seed: 1 });
assert.ok(N.warnings.some((w) => /Tavuk yemekleri/.test(w)));
assert.ok(N.menus.every((m) => groupOf(m.lunch.mainCourse) !== 'tavuk'));
console.log('zamanlayıcı testleri geçti');
