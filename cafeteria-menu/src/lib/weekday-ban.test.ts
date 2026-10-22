// Çalıştırma:  npx tsx src/lib/weekday-ban.test.ts
import assert from 'node:assert/strict';
import { evaluateCandidates, generateAutoMonthMenus, getAllMenuItemIds, getEffectiveTags, ruleSettingsToOptions } from './menu';
import { SEED_DATA } from './seedData';
import { DEFAULT_RULE_SETTINGS } from '@/types';

const settings = { ...DEFAULT_RULE_SETTINGS, weekdayBans: { '1': ['poultry'] } }; // Pazartesi: tavuk yok
const byId = new Map(SEED_DATA.map((i) => [i.id, i]));
const isPoultry = (id: string) => getEffectiveTags(byId.get(id)!).includes('poultry');

// Gerçek havuzla, birkaç farklı tohumla: hiçbir Pazartesi'de tavuklu yemek (çorba dahil) yok.
for (const seed of [1, 2, 3]) {
  const out = generateAutoMonthMenus(SEED_DATA, 2026, 10, [], { ...ruleSettingsToOptions(settings), seed });
  const mondays = out.menus.filter((m) => new Date(m.date + 'T12:00:00').getDay() === 1);
  assert.ok(mondays.length >= 4);
  for (const menu of mondays) {
    getAllMenuItemIds(menu).forEach((id) => assert.ok(!isPoultry(id), `${menu.date}: ${byId.get(id)!.name} tavuklu`));
  }
  // Diğer günlerde tavuk hâlâ çıkabilir (kural yalnızca Pazartesi'yi kapsar).
  assert.ok(out.menus.some((m) => new Date(m.date + 'T12:00:00').getDay() !== 1 && getAllMenuItemIds(m).some(isPoultry)));
}

// Elle seçim yardımı: Pazartesi için tavuklu adaylar uyarı alır, öneri listesinde yer almaz.
const ev = evaluateCandidates(SEED_DATA, [], '2026-11-02', 'lunch', 'mainCourse', ruleSettingsToOptions(settings));
const chickenMains = SEED_DATA.filter((i) => i.category === 'mainCourses' && isPoultry(i.id));
assert.ok(chickenMains.length > 0);
chickenMains.forEach((i) => {
  assert.ok(ev.violations[i.id], `${i.name} Pazartesi için uyarı almalı`);
  assert.ok(!ev.ranked.includes(i.id));
});
// Salı günü aynı yemekler serbest.
const tue = evaluateCandidates(SEED_DATA, [], '2026-11-03', 'lunch', 'mainCourse', ruleSettingsToOptions(settings));
assert.ok(chickenMains.some((i) => !tue.violations[i.id]));

// Eski kayıtlar (weekdayBans alanı yok) sorunsuz çalışır.
assert.doesNotThrow(() => ruleSettingsToOptions({ mainCooldownDays: 5, maxConsecutiveProteinDays: 2, weekendSync: true, requireCompanions: true }));
console.log('gün yasağı (gerçek havuz) testi geçti');
