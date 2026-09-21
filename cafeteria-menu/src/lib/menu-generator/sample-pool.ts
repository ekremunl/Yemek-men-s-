// lib/menu-generator/sample-pool.ts
// Örnek havuz: kendi veritabanı/JSON'unuzla değiştirin.
import type { Dish, DishCategory, Tag } from './types';

const dish = (
  id: string,
  name: string,
  category: DishCategory,
  tags: Tag[],
  extra: Partial<Dish> = {},
): Dish => ({ id, name, category, tags, ...extra });

export const SAMPLE_POOL: Dish[] = [
  // ---------------- ANA YEMEKLER ----------------
  dish('m-tavuk-sote', 'Tavuk Sote', 'ana_yemek', ['tavuk', 'sebze'], { mainIngredients: ['tavuk'] }),
  dish('m-firin-baget', 'Fırında Baget Tavuk', 'ana_yemek', ['tavuk'], { mainIngredients: ['tavuk'] }),
  dish('m-sinitzel', 'Tavuk Şinitzel', 'ana_yemek', ['tavuk'], { mainIngredients: ['tavuk'] }),
  dish('m-kremali-tavuk', 'Kremalı Mantarlı Tavuk', 'ana_yemek', ['tavuk'], { mainIngredients: ['tavuk', 'mantar'] }),
  dish('m-tavuk-guvec', 'Tavuklu Güveç', 'ana_yemek', ['tavuk', 'sebze'], { mainIngredients: ['tavuk'] }),
  dish('m-etli-nohut', 'Etli Nohut', 'ana_yemek', ['kirmizi_et', 'bakliyat'], { mainIngredients: ['nohut'] }),
  dish('m-kuru-fasulye', 'Etli Kuru Fasulye', 'ana_yemek', ['kirmizi_et', 'bakliyat'], { mainIngredients: ['fasulye'] }),
  dish('m-izgara-kofte', 'Izgara Köfte', 'ana_yemek', ['kirmizi_et'], { mainIngredients: ['kıyma'] }),
  dish('m-kiymali-ispanak', 'Kıymalı Ispanak', 'ana_yemek', ['kirmizi_et', 'sebze'], { mainIngredients: ['ıspanak'] }),
  dish('m-etli-turlu', 'Etli Türlü', 'ana_yemek', ['kirmizi_et', 'sebze']),
  dish('m-kadinbudu', 'Kadınbudu Köfte', 'ana_yemek', ['kirmizi_et'], { mainIngredients: ['kıyma'] }),
  dish('m-hunkar', 'Hünkar Beğendi', 'ana_yemek', ['kirmizi_et'], { mainIngredients: ['patlıcan'] }),
  dish('m-karniyarik', 'Karnıyarık', 'ana_yemek', ['kirmizi_et', 'sebze'], { mainIngredients: ['patlıcan'] }),
  dish('m-mercimekli-kofte', 'Mercimekli Köfte', 'ana_yemek', ['bakliyat'], { mainIngredients: ['mercimek'] }),
  dish('m-taze-fasulye', 'Zeytinyağlı Taze Fasulye', 'ana_yemek', ['sebze', 'hafif']),
  dish('m-enginar', 'Zeytinyağlı Enginar', 'ana_yemek', ['sebze', 'hafif']),
  dish('m-mucver', 'Kabak Mücver', 'ana_yemek', ['sebze', 'hafif']),
  dish('m-sebze-guvec', 'Sebzeli Güveç', 'ana_yemek', ['sebze', 'hafif']),
  dish('m-turlu', 'Sebze Türlü', 'ana_yemek', ['sebze', 'hafif']),
  dish('m-levrek', 'Fırında Levrek', 'ana_yemek', ['balik'], { mainIngredients: ['levrek'] }),
  dish('m-firin-makarna', 'Fırın Makarna', 'ana_yemek', ['hamur_isi', 'karbonhidrat_agirlikli', 'pilav_makarna']),
  // pratik olanlar (hafta sonu öğle adayları)
  dish('m-manti', 'Mantı', 'ana_yemek', ['hamur_isi', 'pratik'], { incompatibleWithTags: ['pilav_makarna'] }),
  dish('m-su-boregi', 'Su Böreği', 'ana_yemek', ['hamur_isi', 'pratik']),
  dish('m-kiymali-pide', 'Kıymalı Pide', 'ana_yemek', ['hamur_isi', 'kirmizi_et', 'pratik']),
  dish('m-peynirli-pide', 'Peynirli Pide', 'ana_yemek', ['hamur_isi', 'pratik']),
  dish('m-tavuk-durum', 'Tavuk Dürüm', 'ana_yemek', ['tavuk', 'pratik']),
  dish('m-hamburger', 'Hamburger', 'ana_yemek', ['kirmizi_et', 'pratik']),
  dish('m-lahmacun', 'Lahmacun', 'ana_yemek', ['hamur_isi', 'kirmizi_et', 'pratik']),
  dish('m-gozleme', 'Gözleme', 'ana_yemek', ['hamur_isi', 'pratik']),

  // ---------------- YAN ÜRÜNLER ----------------
  dish('s-pirinc', 'Pirinç Pilavı', 'yan_urun', ['pilav_makarna']),
  dish('s-bulgur', 'Bulgur Pilavı', 'yan_urun', ['pilav_makarna']),
  dish('s-sehriyeli', 'Şehriyeli Pilav', 'yan_urun', ['pilav_makarna']),
  dish('s-spagetti', 'Spagetti', 'yan_urun', ['pilav_makarna']),
  dish('s-cacik', 'Cacık', 'yan_urun', ['hafif'], { mainIngredients: ['yoğurt'] }),
  dish('s-yogurt', 'Yoğurt', 'yan_urun', [], { mainIngredients: ['yoğurt'] }),
  dish('s-coban', 'Çoban Salata', 'yan_urun', ['sebze', 'hafif']),
  dish('s-mevsim', 'Mevsim Salata', 'yan_urun', ['sebze', 'hafif']),
  dish('s-havuc-tarator', 'Havuç Tarator', 'yan_urun', ['sebze'], { mainIngredients: ['yoğurt'] }),
  dish('s-tursu', 'Turşu', 'yan_urun', []),
  dish('s-ayran', 'Ayran', 'yan_urun', [], { mainIngredients: ['yoğurt'] }),
  dish('s-nohutlu-pilav', 'Nohutlu Pilav', 'yan_urun', ['pilav_makarna', 'bakliyat'], { mainIngredients: ['nohut'] }),

  // ---------------- ÇORBALAR ----------------
  dish('c-mercimek', 'Mercimek Çorbası', 'çorba', ['bakliyat'], { mainIngredients: ['mercimek'] }),
  dish('c-ezogelin', 'Ezogelin Çorbası', 'çorba', ['bakliyat'], { mainIngredients: ['mercimek'] }),
  dish('c-domates', 'Domates Çorbası', 'çorba', ['sebze'], { mainIngredients: ['domates'] }),
  dish('c-yayla', 'Yayla Çorbası', 'çorba', [], { mainIngredients: ['yoğurt'] }),
  dish('c-tarhana', 'Tarhana Çorbası', 'çorba', []),
  dish('c-sehriye', 'Şehriye Çorbası', 'çorba', []),
  dish('c-tavuk-suyu', 'Tavuk Suyu Çorbası', 'çorba', ['tavuk'], { mainIngredients: ['tavuk'] }),
  dish('c-sebze', 'Sebze Çorbası', 'çorba', ['sebze', 'hafif']),
  dish('c-mantar', 'Kremalı Mantar Çorbası', 'çorba', [], { mainIngredients: ['mantar'] }),
  dish('c-dugun', 'Düğün Çorbası', 'çorba', ['kirmizi_et']),
  dish('c-brokoli', 'Brokoli Çorbası', 'çorba', ['sebze', 'hafif']),

  // ---------------- TATLI / MEYVE ----------------
  dish('d-sutlac', 'Sütlaç', 'tatli_meyve', []),
  dish('d-kazandibi', 'Kazandibi', 'tatli_meyve', []),
  dish('d-revani', 'Revani', 'tatli_meyve', []),
  dish('d-irmik-helvasi', 'İrmik Helvası', 'tatli_meyve', []),
  dish('d-puding', 'Puding', 'tatli_meyve', []),
  dish('d-elma', 'Elma', 'tatli_meyve', ['hafif']),
  dish('d-portakal', 'Portakal', 'tatli_meyve', ['hafif']),
  dish('d-mevsim-meyve', 'Mevsim Meyve', 'tatli_meyve', ['hafif']),
  dish('d-asure', 'Aşure', 'tatli_meyve', ['bakliyat']),
];
