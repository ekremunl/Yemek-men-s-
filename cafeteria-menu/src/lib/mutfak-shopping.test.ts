// Çalıştırma:  npx tsx src/lib/mutfak-shopping.test.ts
import assert from 'node:assert/strict';
import { computeIngredients } from './shopping';
import { matchRecipes, mergeMenusIntoMutfak, normalizeName, parseMutfakBackup } from './mutfak';
import { evaluateCandidates, createEmptyDailyMenu } from './menu';
import { SEED_DATA } from './seedData';
import type { FoodItem, LinkedRecipe } from '@/types';

const recipes: Record<string, LinkedRecipe> = {
  r1: { id: 'r1', name: 'Kırmızı Mercimek Çorbası', ings: [{ name: 'Mercimek', amt: 40, unit: 'g' }, { name: 'Un', amt: 6, unit: 'g' }] },
  r2: { id: 'r2', name: 'Kıymalı Makarna', ings: [{ name: 'Makarna', amt: 80, unit: 'g' }, { name: 'mercimek', amt: 10, unit: 'g' }] },
};
const items: FoodItem[] = [
  { id: 'a', name: 'Mercimek Çorbası', category: 'soups', recipeId: 'r1' },
  { id: 'b', name: 'Makarna', category: 'sideDishes', recipeId: 'r2' },
  { id: 'c', name: 'Sütlaç', category: 'complements' },
];
const day = createEmptyDailyMenu('2026-11-02');
day.lunch.soup = 'a'; day.lunch.sideDish = 'b'; day.dinner.soup = 'a'; day.lunch.complement = 'c';

// Malzeme: öğle 100, akşam 50 kişi
const rep = computeIngredients([day], items, recipes, { lunch: 100, dinner: 50 }, '2026-11-02', '2026-11-02');
const merc = rep.lines.find((l) => l.name === 'Mercimek')!;
assert.equal(merc.qty, 7, '40×100 + 40×50 + 10×100 = 7000 g = 7 kg');
assert.equal(merc.unit, 'kg');
assert.equal(rep.lines.find((l) => l.name.toLowerCase() === 'makarna')!.qty, 8);
assert.equal(rep.unlinked[0].name, 'Sütlaç');
assert.equal(rep.countedDishes, 3);

// Aralık dışı gün sayılmaz
assert.equal(computeIngredients([day], items, recipes, { lunch: 1, dinner: 1 }, '2026-12-01', '2026-12-02').lines.length, 0);

// Eşleştirme
assert.equal(normalizeName('  Mercimek   Çorbası! '), 'mercimek çorbası');
const m = matchRecipes(items.slice(0, 1), Object.values(recipes))[0];
assert.equal(m.exact, undefined);
assert.equal(m.suggestions[0].id, 'r1', 'benzer ad önerilir');

// Mutfaktakip'e aktarma: bağlı olmayan atlanır, kesinleşmiş rapor korunur
const existing = { '2026-11-02': { lunch: 7, dinner: 8, meals: { ogle: ['x'], aksam: [], ara: [], kahvalti: [] }, report: { aksam: [{ name: 'Z' }] } } };
const res = mergeMenusIntoMutfak(existing, [day], items, new Set(['r1', 'r2']), { lunch: 100, dinner: 100 }, '2026-11-01', '2026-11-30');
const out = res.days['2026-11-02'];
assert.deepEqual(out.meals!.ogle, ['r1', 'r2']);
assert.equal(out.lunch, 7, 'mevcut kişi sayısı korunur');
assert.deepEqual(out.meals!.aksam, [], 'kesinleşmiş akşam raporuna dokunulmaz');
assert.equal(res.skippedMeals, 1);
assert.deepEqual(res.unlinked, ['Sütlaç']);

// Yedek doğrulama
assert.throws(() => parseMutfakBackup('{"foo":1}'));
assert.equal(parseMutfakBackup(JSON.stringify({ recipes: [recipes.r1], days: {} })).recipes.length, 1);

// Tek yemek değiştirme: öneriler kurallara uyar, mevcut seçim hariç
const ev = evaluateCandidates(SEED_DATA, [], '2026-11-04', 'lunch', 'mainCourse');
assert.ok(ev.ranked.length > 0);
assert.ok(ev.ranked.every((id) => SEED_DATA.find((f) => f.id === id)!.category === 'mainCourses'));
console.log('mutfak/shopping testleri geçti');
