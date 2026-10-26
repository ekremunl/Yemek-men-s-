// src/lib/groups.ts
// Ana yemek grupları: eski kayıtlardaki etiket ve adlardan başlangıç grubunu tahmin eder (yalnızca ilk geçişte).
import type { FoodItem, MainGroup } from '@/types';

const LEGUME = /fasulye|nohut|mercimek|barbunya|bakla|kuru bezelye|bulgurlu nohut|börülce/;
const POULTRY = /tavuk|piliç|hindi/;
const BEEF = /\bet\b|etli|kıyma|kıymalı|köfte|kebab|kebap|sote|biftek|kavurma|haşlama|dana|kuzu|tandır|güveç|musakka|dolma|sarma|karnıyarık|izmir köfte|hünkar/;
const VEG = /sebze|türlü|kabak|patlıcan|ıspanak|ispanak|taze fasulye|bamya|karnabahar|kapuska|lahana|pırasa|bezelye|enginar|semizotu|biber|domates/;

/** Etiket varsa etikete, yoksa ada bakarak grup önerir. Hiçbirine uymazsa (balık, hamur işi…) undefined. */
export function inferMainGroup(item: Pick<FoodItem, 'name' | 'tags'>): MainGroup | undefined {
  const tags = item.tags ?? [];
  const name = item.name.toLocaleLowerCase('tr-TR');
  const has = (t: string) => tags.includes(t);
  if (has('legume') || (!tags.length && LEGUME.test(name) && !/taze fasulye/.test(name))) return 'bakliyat';
  if (has('poultry') || (!tags.length && POULTRY.test(name))) return 'tavuk';
  if (has('meat_veg') || (has('beef') && has('vegetable'))) return 'etli_sebze';
  if (!tags.length && /etli/.test(name) && VEG.test(name)) return 'etli_sebze';
  if (has('beef') && !has('dough')) return 'et';
  if (!tags.length && BEEF.test(name) && !/pide|börek|mantı|lahmacun|hamburger/.test(name)) return 'et';
  return undefined;
}
