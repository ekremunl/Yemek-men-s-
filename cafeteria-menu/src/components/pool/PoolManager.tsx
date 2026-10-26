// src/components/pool/PoolManager.tsx
'use client';
import { useMemo, useState } from 'react';
import { Apple, BookOpen, ChevronDown, Cookie, Flame, Pencil, Plus, Salad, Search, Soup, Trash2, UtensilsCrossed } from 'lucide-react';
import { useAppStore } from '@/context/store';
import { MAIN_GROUPS, MAIN_GROUP_LABEL, type CategoryKey, type FoodItem, type MainGroup } from '@/types';
import { CATEGORY_META } from '@/lib/seedData';
import { cn } from '@/lib/utils';
import ItemDetails from './ItemDetails';

const CAT_ICONS: Record<CategoryKey, React.ReactNode> = {
  soups: <Soup className="w-4 h-4" />,
  mainCourses: <UtensilsCrossed className="w-4 h-4" />,
  sideDishes: <Salad className="w-4 h-4" />,
  complements: <Apple className="w-4 h-4" />,
  snacks: <Cookie className="w-4 h-4" />,
};

const CAT_COLORS: Record<CategoryKey, { border: string; badge: string; btn: string; text: string }> = {
  soups: { border: 'border-amber-500/30', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30', btn: 'bg-amber-500', text: 'text-amber-400' },
  mainCourses: { border: 'border-red-500/30', badge: 'bg-red-500/20 text-red-300 border-red-500/30', btn: 'bg-red-500', text: 'text-red-400' },
  sideDishes: { border: 'border-emerald-500/30', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', btn: 'bg-emerald-500', text: 'text-emerald-400' },
  complements: { border: 'border-blue-500/30', badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30', btn: 'bg-blue-500', text: 'text-blue-400' },
  snacks: { border: 'border-violet-500/30', badge: 'bg-violet-500/20 text-violet-300 border-violet-500/30', btn: 'bg-violet-500', text: 'text-violet-400' },
};

const GROUP_OPTIONS: { value: MainGroup | ''; label: string }[] = [
  ...MAIN_GROUPS.map((g) => ({ value: g, label: MAIN_GROUP_LABEL[g] })),
  { value: '', label: 'Grup seçilmemiş' },
];

function DishRow({ item, category }: { item: FoodItem; category: CategoryKey }) {
  const removeFoodItem = useAppStore((s) => s.removeFoodItem);
  const setMainGroup = useAppStore((s) => s.setMainGroup);
  const [open, setOpen] = useState(false);
  const needsGroup = category === 'mainCourses' && !item.group;

  return (
    <li className="rounded-xl bg-white/[0.03] border border-white/5">
      <div className="flex items-center pl-3 pr-1 min-h-[2.75rem]">
        <span className="flex-1 min-w-0 py-2">
          <span className="block truncate text-sm text-white/90">{item.name}</span>
          {(item.calories || item.recipeId) && (
            <span className="flex gap-1 mt-0.5">
              {item.calories ? (
                <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full border border-orange-400/30 text-orange-300"><Flame className="w-2.5 h-2.5" />{item.calories} kcal</span>
              ) : null}
              {item.recipeId ? (
                <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full border border-emerald-400/30 text-emerald-300"><BookOpen className="w-2.5 h-2.5" />reçeteli</span>
              ) : null}
            </span>
          )}
        </span>
        {needsGroup && (
          <select
            aria-label={`${item.name} için grup seç`}
            value=""
            onChange={(e) => e.target.value && setMainGroup(item.id, e.target.value as MainGroup)}
            className="mr-1 max-w-[8.5rem] bg-amber-500/10 border border-amber-400/40 rounded-lg px-2 min-h-[2.5rem] text-xs text-amber-200"
          >
            <option value="">Grup seç…</option>
            {MAIN_GROUPS.map((g) => <option key={g} value={g}>{MAIN_GROUP_LABEL[g]}</option>)}
          </select>
        )}
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={`${item.name} ayrıntıları`} className={cn('w-10 h-10 flex items-center justify-center rounded-lg', open ? 'text-indigo-300' : 'text-white/40')}>
          <Pencil className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => removeFoodItem(item.id)} aria-label={`${item.name} sil`} className="w-10 h-10 flex items-center justify-center rounded-lg text-red-400/70 active:bg-red-500/10">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      {open && <div className="px-2 pb-2"><ItemDetails item={item} /></div>}
    </li>
  );
}

function CategoryPanel({ categoryKey, defaultOpen }: { categoryKey: CategoryKey; defaultOpen: boolean }) {
  const meta = CATEGORY_META.find((c) => c.key === categoryKey)!;
  const colors = CAT_COLORS[categoryKey];
  const foodItems = useAppStore((s) => s.foodItems);
  const addFoodItem = useAppStore((s) => s.addFoodItem);
  const [open, setOpen] = useState(defaultOpen);
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [group, setGroup] = useState<MainGroup | ''>('');

  const items = useMemo(
    () => foodItems.filter((i) => i.category === categoryKey).sort((a, b) => a.name.localeCompare(b.name, 'tr')),
    [foodItems, categoryKey]
  );
  const q = query.toLocaleLowerCase('tr-TR').trim();
  const shown = q ? items.filter((i) => i.name.toLocaleLowerCase('tr-TR').includes(q)) : items;
  const ungrouped = categoryKey === 'mainCourses' ? items.filter((i) => !i.group).length : 0;

  const add = () => {
    if (!name.trim()) return;
    addFoodItem(name, categoryKey, categoryKey === 'mainCourses' && group ? group : undefined);
    setName('');
  };

  return (
    <section className={cn('rounded-2xl border bg-white/[0.03]', colors.border)}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="w-full flex items-center gap-3 px-4 min-h-[3.5rem] text-left">
        <span className={colors.text}>{CAT_ICONS[categoryKey]}</span>
        <span className="flex-1 min-w-0">
          <span className="block font-semibold text-white">{meta.labelTR}</span>
          <span className="block text-[11px] text-white/40">{items.length} yemek{ungrouped > 0 ? ` · ${ungrouped} grup seçilmemiş` : ''}</span>
        </span>
        <ChevronDown className={cn('w-4 h-4 text-white/40 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="px-3 pb-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ara…" className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30" />
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              placeholder="Yeni yemek ekle…"
              className="flex-1 min-w-[9rem] bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30"
            />
            {categoryKey === 'mainCourses' && (
              <select value={group} onChange={(e) => setGroup(e.target.value as MainGroup | '')} aria-label="Yeni yemeğin grubu" className="bg-slate-800 border border-white/10 rounded-xl px-3 text-sm text-white min-h-[3rem]">
                {GROUP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.value ? o.label : 'Grup seç…'}</option>)}
              </select>
            )}
            <button type="button" onClick={add} aria-label="Ekle" className={cn('w-12 min-h-[3rem] flex items-center justify-center rounded-xl text-white', colors.btn)}><Plus className="w-5 h-5" /></button>
          </div>

          {categoryKey === 'mainCourses' ? (
            <div className="space-y-4">
              {[...MAIN_GROUPS, undefined].map((g) => {
                const rows = shown.filter((i) => (g ? i.group === g : !i.group));
                if (!g && rows.length === 0) return null;
                return (
                  <div key={g ?? 'none'}>
                    <p className={cn('flex items-center justify-between text-xs font-semibold mb-1.5', g ? 'text-white/70' : 'text-amber-300')}>
                      <span>{g ? MAIN_GROUP_LABEL[g] : 'Grup seçilmemiş (menüye otomatik alınmaz)'}</span>
                      <span className="text-white/35 font-normal">{rows.length}</span>
                    </p>
                    {rows.length === 0 ? (
                      <p className="text-[11px] text-white/30 px-1 pb-1">Bu grupta yemek yok.</p>
                    ) : (
                      <ul className="space-y-1.5">{rows.map((i) => <DishRow key={i.id} item={i} category={categoryKey} />)}</ul>
                    )}
                  </div>
                );
              })}
            </div>
          ) : shown.length === 0 ? (
            <p className="text-center text-sm text-white/30 py-4">Yemek yok.</p>
          ) : (
            <ul className="space-y-1.5">{shown.map((i) => <DishRow key={i.id} item={i} category={categoryKey} />)}</ul>
          )}
        </div>
      )}
    </section>
  );
}

export default function PoolManager() {
  const mains = useAppStore((s) => s.foodItems.filter((i) => i.category === 'mainCourses'));
  const counts = MAIN_GROUPS.map((g) => ({ g, n: mains.filter((i) => i.group === g).length }));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-white">Ürün Havuzu</h2>
        <p className="text-sm text-white/50 mt-1 hidden sm:block">
          Ana yemekleri dört gruba ayırın; menü üretici gruplardan seçer, günlere eşit dağıtır ve yemekleri sırayla döndürür.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {counts.map(({ g, n }) => (
          <div key={g} className={cn('rounded-xl border px-3 py-2', n === 0 ? 'border-red-400/40 bg-red-500/5' : 'border-white/10 bg-white/5')}>
            <p className="text-[11px] text-white/50">{MAIN_GROUP_LABEL[g]}</p>
            <p className={cn('text-lg font-bold', n === 0 ? 'text-red-300' : 'text-white')}>{n}</p>
          </div>
        ))}
      </div>

      {CATEGORY_META.map((c) => (
        <CategoryPanel key={c.key} categoryKey={c.key} defaultOpen={c.key === 'mainCourses'} />
      ))}
    </div>
  );
}
