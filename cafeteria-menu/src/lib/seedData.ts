// src/lib/seedData.ts
import { FoodItem, CategoryMeta } from '@/types';

export const CATEGORY_META: CategoryMeta[] = [
  {
    key: 'soups',
    label: 'Soups',
    labelTR: 'Çorbalar',
    color: 'amber',
    accent: '#f59e0b',
    icon: 'Soup',
  },
  {
    key: 'mainCourses',
    label: 'Main Courses',
    labelTR: 'Ana Yemekler',
    color: 'red',
    accent: '#ef4444',
    icon: 'UtensilsCrossed',
  },
  {
    key: 'sideDishes',
    label: 'Side Dishes',
    labelTR: 'Yan Yemekler',
    color: 'green',
    accent: '#22c55e',
    icon: 'Salad',
  },
  {
    key: 'complements',
    label: 'Complements',
    labelTR: 'Tamamlayıcılar',
    color: 'blue',
    accent: '#3b82f6',
    icon: 'Apple',
  },
];

export const SEED_DATA: FoodItem[] = [
  // Soups
  { id: 's1', name: 'Mercimek Çorbası', category: 'soups', tags: ['legume'] },
  { id: 's2', name: 'Tarhana Çorbası', category: 'soups', tags: ['traditional'] },
  { id: 's3', name: 'Yayla Çorbası', category: 'soups', tags: ['dairy'] },
  { id: 's4', name: 'Domates Çorbası', category: 'soups', tags: ['vegetable'] },
  { id: 's5', name: 'Ezogelin Çorbası', category: 'soups', tags: ['legume'] },
  { id: 's6', name: 'Tavuk Suyu Çorbası', category: 'soups', tags: ['poultry'] },
  { id: 's7', name: 'Şehriye Çorbası', category: 'soups', tags: ['noodle'] },
  { id: 's8', name: 'Patates Çorbası', category: 'soups', tags: ['vegetable'] },
  { id: 's9', name: 'İşkembe Çorbası', category: 'soups', tags: ['traditional'] },
  { id: 's10', name: 'Düğün Çorbası', category: 'soups', tags: ['traditional'] },
  { id: 's11', name: 'Kremalı Sebze Çorbası', category: 'soups', tags: ['vegetable'] },
  { id: 's12', name: 'Bezelye Çorbası', category: 'soups', tags: ['legume'] },

  // Main Courses
  { id: 'm1', name: 'Kuru Fasulye', category: 'mainCourses', tags: ['legume', 'traditional'] },
  { id: 'm2', name: 'Et Sote', category: 'mainCourses', tags: ['beef'] },
  { id: 'm3', name: 'Tavuk Sote', category: 'mainCourses', tags: ['poultry'] },
  { id: 'm4', name: 'Izgara Köfte', category: 'mainCourses', tags: ['beef', 'grilled'] },
  { id: 'm5', name: 'Tavuk Şinitzel', category: 'mainCourses', tags: ['poultry', 'fried'] },
  { id: 'm6', name: 'Nohut Yemeği', category: 'mainCourses', tags: ['legume'] },
  { id: 'm7', name: 'Mercimek Köftesi', category: 'mainCourses', tags: ['legume', 'vegetarian'] },
  { id: 'm8', name: 'Etli Türlü', category: 'mainCourses', tags: ['beef', 'vegetable'] },
  { id: 'm9', name: 'Sebzeli Tavuk', category: 'mainCourses', tags: ['poultry', 'vegetable'] },
  { id: 'm10', name: 'Patlıcan Musakka', category: 'mainCourses', tags: ['beef', 'vegetable'] },
  { id: 'm11', name: 'Balık (Hamsi/Mezgit)', category: 'mainCourses', tags: ['fish'] },
  { id: 'm12', name: 'Bezelye Yemeği', category: 'mainCourses', tags: ['legume', 'vegetarian'] },
  { id: 'm13', name: 'Etli Kabak', category: 'mainCourses', tags: ['beef', 'vegetable'] },
  { id: 'm14', name: 'Tas Kebabı', category: 'mainCourses', tags: ['beef', 'traditional'] },
  { id: 'm15', name: 'Fırın Tavuk', category: 'mainCourses', tags: ['poultry', 'baked'] },
  { id: 'm16', name: 'Kapuska', category: 'mainCourses', tags: ['beef', 'vegetable'] },
  { id: 'm17', name: 'Etli Biber Dolması', category: 'mainCourses', tags: ['beef', 'traditional'] },
  { id: 'm18', name: 'Sogan Kebabı', category: 'mainCourses', tags: ['beef'] },

  // Side Dishes
  { id: 'd1', name: 'Pirinç Pilavı', category: 'sideDishes', tags: ['rice'] },
  { id: 'd2', name: 'Bulgur Pilavı', category: 'sideDishes', tags: ['bulgur'] },
  { id: 'd3', name: 'Makarna (Şehriyeli)', category: 'sideDishes', tags: ['pasta'] },
  { id: 'd4', name: 'Erişte', category: 'sideDishes', tags: ['noodle'] },
  { id: 'd5', name: 'Kuskus Pilavı', category: 'sideDishes', tags: ['couscous'] },
  { id: 'd6', name: 'Fırın Makarna', category: 'sideDishes', tags: ['pasta', 'baked'] },
  { id: 'd7', name: 'Nohutlu Pirinç Pilavı', category: 'sideDishes', tags: ['rice', 'legume'] },
  { id: 'd8', name: 'Domatesli Bulgur', category: 'sideDishes', tags: ['bulgur'] },
  { id: 'd9', name: 'Sade Makarna', category: 'sideDishes', tags: ['pasta'] },
  { id: 'd10', name: 'Spagetti', category: 'sideDishes', tags: ['pasta'] },

  // Complements
  { id: 'c1', name: 'Ayran', category: 'complements', tags: ['dairy', 'drink'] },
  { id: 'c2', name: 'Yoğurt', category: 'complements', tags: ['dairy'] },
  { id: 'c3', name: 'Mevsim Meyvesi', category: 'complements', tags: ['fruit'] },
  { id: 'c4', name: 'Turşu', category: 'complements', tags: ['pickled'] },
  { id: 'c5', name: 'Yeşil Salata', category: 'complements', tags: ['salad'] },
  { id: 'c6', name: 'Cacık', category: 'complements', tags: ['dairy', 'salad'] },
  { id: 'c7', name: 'Domates-Salatalık Salatası', category: 'complements', tags: ['salad'] },
  { id: 'c8', name: 'Ekmek', category: 'complements', tags: ['bread'] },
  { id: 'c9', name: 'Komposto', category: 'complements', tags: ['fruit', 'drink'] },
  { id: 'c10', name: 'Portakal / Elma', category: 'complements', tags: ['fruit'] },
  { id: 'c11', name: 'Sütlaç', category: 'complements', tags: ['dairy', 'dessert'] },
  { id: 'c12', name: 'Helva', category: 'complements', tags: ['dessert'] },
];
