// Çalıştırma:  npx tsx src/lib/mutfak-shopping.test.ts
import assert from 'node:assert/strict';
import { computeIngredients } from './shopping';
import { matchRecipes, normalizeName, parseMutfakBackup, parseNameList } from './mutfak';
import { autoLines, cardLines, emptyKitchenDay, normalizeKitchenDay, recipesForMeal } from './kitchen';
import { ingredientToOrderItem, orderToText } from './order';
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

// Mutfak günlük rapor: menü (bağlı reçeteler) + elle eklenen reçete + doğrudan tüketim, öğüne göre kişi sayısı
const itemMap = new Map(items.map((i) => [i.id, i]));
const kd = emptyKitchenDay({ lunch: 100, dinner: 50 });
kd.meals.ogle = ['r2']; // elle eklenen (menüde zaten var → tekrarlanmaz)
kd.meals.kahvalti = ['r2'];
kd.direkt.push({ name: 'Süt', amt: 2000, unit: 'ml', meal: 'ogle' });
const ogle = autoLines(kd, 'ogle', day, itemMap, recipes);
assert.equal(ogle.find((l) => l.name === 'Makarna')!.qty, 8, 'makarna 80g × 100 = 8 kg (tekrar yok)');
assert.equal(ogle.find((l) => l.name === 'Süt')!.qty, 2);
assert.equal(ogle.find((l) => l.name === 'Süt')!.unit, 'L');
assert.deepEqual(recipesForMeal(kd, 'ogle', day, itemMap, recipes).unlinked, ['Sütlaç']);
const aksam = autoLines(kd, 'aksam', day, itemMap, recipes); // akşam: 50 kişi
assert.equal(aksam.find((l) => l.name === 'Mercimek')!.qty, 2);
const kahvalti = autoLines(kd, 'kahvalti', day, itemMap, recipes);
assert.equal(kahvalti.length, 2, 'kahvaltıda yalnızca elle eklenen r2 var');
// Elle düzenlenmiş rapor otomatik hesabın yerini alır
kd.report.ogle = [{ name: 'X', qty: 1, unit: 'kg' }];
assert.equal(cardLines(kd, 'ogle', day, itemMap, recipes)[0].name, 'X');
// Eski Mutfaktakip günü (eksik alanlarla) güvenle normalize edilir
const old = normalizeKitchenDay({ lunch: 10, meals: { ogle: ['r1'] } } as never, { lunch: 1, dinner: 2 });
assert.equal(old.lunch, 10); assert.equal(old.dinner, 2); assert.deepEqual(old.meals.aksam, []); assert.deepEqual(old.firin, []);

// Sipariş: birim dönüşümü ve metin
assert.deepEqual(ingredientToOrderItem({ name: 'Un', qty: 600, unit: 'g' }), { name: 'Un', qty: 0.6, unit: 'kg' });
assert.deepEqual(ingredientToOrderItem({ name: 'Süt', qty: 2.5, unit: 'L' }), { name: 'Süt', qty: 2.5, unit: 'L' });
assert.equal(ingredientToOrderItem({ name: 'Yumurta', qty: 30, unit: 'adet' }).unit, 'Adet');
assert.ok(orderToText([{ name: 'Un', qty: 2, unit: 'kg' }]).includes('2 kg'));
assert.deepEqual(parseNameList('Un, Şeker\nTuz;Un'), ['Un', 'Şeker', 'Tuz']);

// Yedek doğrulama
assert.throws(() => parseMutfakBackup('{"foo":1}'));
assert.equal(parseMutfakBackup(JSON.stringify({ recipes: [recipes.r1], days: {} })).recipes.length, 1);

// Tek yemek değiştirme: öneriler kurallara uyar, mevcut seçim hariç
const ev = evaluateCandidates(SEED_DATA, [], '2026-11-04', 'lunch', 'mainCourse');
assert.ok(ev.ranked.length > 0);
assert.ok(ev.ranked.every((id) => SEED_DATA.find((f) => f.id === id)!.category === 'mainCourses'));
console.log('mutfak/shopping testleri geçti');
