// src/lib/tags.ts
// Yemeklere atanabilen etiketlerin kataloğu (etiket anahtarı → Türkçe ad).
// Anahtarlar, otomatik menü motorunun (menu.ts köprüsü) tanıdığı İngilizce etiketlerdir.

export interface TagOption {
  key: string;
  label: string;
}

export interface TagGroup {
  id: 'protein' | 'nature' | 'side' | 'other';
  title: string;
  /** Yalnızca bu kategorilerde gösterilir (verilmezse hepsinde). */
  onlyForCategories?: string[];
  tags: TagOption[];
}

export const TAG_GROUPS: TagGroup[] = [
  {
    id: 'protein',
    title: 'Protein',
    tags: [
      { key: 'poultry', label: 'Tavuk' },
      { key: 'beef', label: 'Kırmızı et' },
      { key: 'fish', label: 'Balık' },
    ],
  },
  {
    id: 'nature',
    title: 'Nitelik',
    tags: [
      { key: 'legume', label: 'Bakliyat' },
      { key: 'vegetable', label: 'Sebze' },
      { key: 'light', label: 'Hafif' },
      { key: 'dough', label: 'Hamur işi' },
      { key: 'carb_heavy', label: 'Karbonhidrat ağırlıklı' },
      { key: 'practical', label: 'Pratik' },
    ],
  },
  {
    id: 'side',
    title: 'Yan yemek türü',
    onlyForCategories: ['sideDishes'],
    tags: [
      { key: 'rice', label: 'Pirinç pilavı' },
      { key: 'bulgur', label: 'Bulgur' },
      { key: 'pasta', label: 'Makarna' },
      { key: 'noodle', label: 'Erişte / şehriye' },
      { key: 'couscous', label: 'Kuskus' },
    ],
  },
  {
    id: 'other',
    title: 'Diğer',
    tags: [
      { key: 'dairy', label: 'Süt ürünü' },
      { key: 'dessert', label: 'Tatlı' },
      { key: 'fruit', label: 'Meyve' },
      { key: 'salad', label: 'Salata' },
      { key: 'bread', label: 'Ekmek' },
      { key: 'pickled', label: 'Turşu' },
      { key: 'drink', label: 'İçecek' },
      { key: 'fried', label: 'Kızartma' },
      { key: 'baked', label: 'Fırın' },
      { key: 'grilled', label: 'Izgara' },
      { key: 'vegetarian', label: 'Etsiz' },
      { key: 'traditional', label: 'Geleneksel' },
    ],
  },
];

const TAG_LABELS = new Map(TAG_GROUPS.flatMap((group) => group.tags.map((tag) => [tag.key, tag.label] as const)));

/** Katalogda olmayan (özel) etiketler anahtarıyla gösterilir. */
export function getTagLabel(key: string): string {
  return TAG_LABELS.get(key) ?? key;
}

export function isKnownTag(key: string): boolean {
  return TAG_LABELS.has(key);
}
