// src/components/pool/PoolManager.tsx
'use client';
import { useState } from 'react';
import { Plus, Trash2, Soup, UtensilsCrossed, Salad, Apple, Search, Cookie } from 'lucide-react';
import { useAppStore } from '@/context/store';
import { CategoryKey } from '@/types';
import { CATEGORY_META } from '@/lib/seedData';
import { cn } from '@/lib/utils';

const CAT_ICONS: Record<CategoryKey, React.ReactNode> = {
  soups: <Soup className="w-4 h-4" />,
  mainCourses: <UtensilsCrossed className="w-4 h-4" />,
  sideDishes: <Salad className="w-4 h-4" />,
  complements: <Apple className="w-4 h-4" />,
  snacks: <Cookie className="w-4 h-4" />,
};

const CAT_COLORS: Record<CategoryKey, { bg: string; border: string; badge: string; btn: string; text: string }> = {
  soups: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    btn: 'bg-amber-500 hover:bg-amber-400',
    text: 'text-amber-400',
  },
  mainCourses: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    badge: 'bg-red-500/20 text-red-300 border-red-500/30',
    btn: 'bg-red-500 hover:bg-red-400',
    text: 'text-red-400',
  },
  sideDishes: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    btn: 'bg-emerald-500 hover:bg-emerald-400',
    text: 'text-emerald-400',
  },
  complements: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    btn: 'bg-blue-500 hover:bg-blue-400',
    text: 'text-blue-400',
  },
  snacks: {
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/30',
    badge: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
    btn: 'bg-violet-500 hover:bg-violet-400',
    text: 'text-violet-400',
  },
};

function CategoryPanel({ categoryKey }: { categoryKey: CategoryKey }) {
  const [newName, setNewName] = useState('');
  const [search, setSearch] = useState('');
  const { foodItems, addFoodItem, removeFoodItem } = useAppStore((s) => ({
    foodItems: s.foodItems,
    addFoodItem: s.addFoodItem,
    removeFoodItem: s.removeFoodItem,
  }));

  const meta = CATEGORY_META.find((c) => c.key === categoryKey)!;
  const colors = CAT_COLORS[categoryKey];
  const items = foodItems.filter(
    (f) => f.category === categoryKey && f.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = () => {
    if (newName.trim()) {
      addFoodItem(newName, categoryKey);
      setNewName('');
    }
  };

  return (
    <div className={cn('rounded-2xl border backdrop-blur-sm flex flex-col', colors.bg, colors.border)}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
        <span className={cn('p-2 rounded-lg', colors.bg, colors.text)}>
          {CAT_ICONS[categoryKey]}
        </span>
        <div className="flex-1">
          <h3 className="font-semibold text-white text-sm">{meta.labelTR}</h3>
          <p className="text-xs text-white/40">{items.length} / {foodItems.filter(f => f.category === categoryKey).length} ürün</p>
        </div>
        <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium', colors.badge)}>
          {foodItems.filter((f) => f.category === categoryKey).length}
        </span>
      </div>

      {/* Search */}
      <div className="px-4 pt-3 pb-1">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ara..."
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/30 transition-colors"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto max-h-52 px-4 py-2 space-y-1 scrollbar-thin">
        {items.length === 0 ? (
          <p className="text-center text-white/30 text-xs py-4">Ürün bulunamadı</p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between group px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
            >
              <span className="text-sm text-white/80 truncate flex-1">{item.name}</span>
              <button
                onClick={() => removeFoodItem(item.id)}
                className="opacity-0 group-hover:opacity-100 text-red-400/60 hover:text-red-400 transition-all ml-2 shrink-0"
                title="Sil"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Add */}
      <div className="px-4 pb-4 pt-2 border-t border-white/5 mt-1">
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Yeni ürün ekle..."
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30 transition-colors"
          />
          <button
            onClick={handleAdd}
            className={cn('px-3 py-2 rounded-lg text-white text-sm font-medium transition-colors shrink-0', colors.btn)}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PoolManager() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Ürün Havuzu Yönetimi</h2>
        <p className="text-sm text-white/50 mt-1">Kategorilere yemek ekleyin veya çıkarın</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CATEGORY_META.map((cat) => (
          <CategoryPanel key={cat.key} categoryKey={cat.key} />
        ))}
      </div>
    </div>
  );
}
