// src/components/pool/PoolManager.tsx
'use client';
import { useState } from 'react';
import { Plus, Trash2, Soup, UtensilsCrossed, Salad, Apple, Search, Cookie, Tag, RotateCcw } from 'lucide-react';
import { useAppStore } from '@/context/store';
import { CategoryKey, FoodItem } from '@/types';
import { CATEGORY_META, SEED_DATA } from '@/lib/seedData';
import { getEffectiveTags } from '@/lib/menu';
import { getTagLabel, isKnownTag, TAG_GROUPS } from '@/lib/tags';
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

type CategoryColors = (typeof CAT_COLORS)[CategoryKey];

const COMPANION_CATEGORIES: { key: CategoryKey; title: string }[] = [
  { key: 'soups', title: 'Çorba' },
  { key: 'sideDishes', title: 'Yan yemek' },
  { key: 'complements', title: 'Tamamlayıcı' },
];

/** Bir yemeğin etiketlerini ve baskın bileşenlerini düzenleyen satır içi panel. */
function TagEditor({
  item,
  colors,
  onClose,
}: {
  item: FoodItem;
  colors: CategoryColors;
  onClose: () => void;
}) {
  const updateFoodItem = useAppStore((s) => s.updateFoodItem);
  const foodItems = useAppStore((s) => s.foodItems);
  const isMain = item.category === 'mainCourses';
  const seedItem = SEED_DATA.find((seed) => seed.id === item.id);
  const hasStoredTags = Boolean(item.tags?.length);

  // Kayıtlı etiket yoksa isimden tahmin edilenler seçili başlar; "Kaydet" ile kalıcı olur.
  const [tags, setTags] = useState<string[]>(() => getEffectiveTags(item));
  const [ingredients, setIngredients] = useState((item.mainIngredients ?? []).join(', '));
  // Havuzdan silinmiş yemeklerin kimlikleri baştan ayıklanır.
  const [companions, setCompanions] = useState<string[]>(() =>
    (item.suggestedCompanions ?? []).filter((id) => foodItems.some((food) => food.id === id))
  );
  const [showCompanions, setShowCompanions] = useState(companions.length > 0);

  const toggle = (key: string) =>
    setTags((prev) => (prev.includes(key) ? prev.filter((tag) => tag !== key) : [...prev, key]));

  const toggleCompanion = (id: string) =>
    setCompanions((prev) => (prev.includes(id) ? prev.filter((companionId) => companionId !== id) : [...prev, id]));

  const customTags = tags.filter((tag) => !isKnownTag(tag));
  const groups = TAG_GROUPS.filter(
    (group) => !group.onlyForCategories || group.onlyForCategories.includes(item.category)
  );

  const handleSave = () => {
    updateFoodItem(item.id, {
      tags,
      mainIngredients: ingredients.split(','),
      ...(isMain ? { suggestedCompanions: companions } : {}),
    });
    onClose();
  };

  const handleReset = () => {
    if (!seedItem) return;
    setTags(seedItem.tags ?? []);
    setIngredients((seedItem.mainIngredients ?? []).join(', '));
  };

  return (
    <div className="mx-2 mb-2 rounded-xl border border-white/10 bg-black/20 p-3 space-y-3">
      {!hasStoredTags && (
        <p className="text-[11px] text-white/40">
          Bu yemeğin kayıtlı etiketi yok; seçili olanlar isminden tahmin edildi. Doğruysa kaydedin, değilse düzeltin.
        </p>
      )}

      {groups.map((group) => (
        <div key={group.id}>
          <p className="text-[11px] font-medium text-white/40 mb-1.5">{group.title}</p>
          <div className="flex flex-wrap gap-1.5">
            {group.tags.map((tag) => {
              const active = tags.includes(tag.key);
              return (
                <button
                  key={tag.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggle(tag.key)}
                  className={cn(
                    'text-xs px-2 py-1 rounded-full border transition-colors',
                    active ? colors.badge : 'border-white/10 text-white/50 hover:bg-white/5 hover:text-white/80'
                  )}
                >
                  {tag.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {customTags.length > 0 && (
        <div>
          <p className="text-[11px] font-medium text-white/40 mb-1.5">Özel etiketler (korunur)</p>
          <div className="flex flex-wrap gap-1.5">
            {customTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggle(tag)}
                className={cn('text-xs px-2 py-1 rounded-full border', colors.badge)}
                title="Kaldırmak için tıklayın"
              >
                {getTagLabel(tag)} ×
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="text-[11px] font-medium text-white/40 mb-1.5 block" htmlFor={`ing-${item.id}`}>
          Baskın bileşenler (virgülle ayırın)
        </label>
        <input
          id={`ing-${item.id}`}
          type="text"
          value={ingredients}
          onChange={(e) => setIngredients(e.target.value)}
          placeholder="örn. mercimek, yoğurt"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/30 transition-colors"
        />
      </div>

      {isMain && (
        <div className="rounded-lg border border-white/10 bg-white/[0.03]">
          <button
            type="button"
            onClick={() => setShowCompanions((open) => !open)}
            aria-expanded={showCompanions}
            className="flex w-full items-center justify-between px-3 py-2 text-[11px] font-medium text-white/60 hover:text-white/90 transition-colors"
          >
            <span>Önerilen eşlikçiler{companions.length > 0 ? ` · ${companions.length} seçili` : ''}</span>
            <span aria-hidden>{showCompanions ? '−' : '+'}</span>
          </button>

          {showCompanions && (
            <div className="px-3 pb-3 space-y-3">
              <p className="text-[11px] leading-relaxed text-white/35">
                Menü oluşturulurken bu ana yemeğin yanına her kategoriden buradaki yemeklerden biri tercih edilir.
                Kurallara aykırıysa (aynı bileşen, aynı gün tekrar, hafta sonu senkronu vb.) başka yemek seçilir.
                Her kategoride 2-3 öneri en iyi sonucu verir; tek öneri aynı gün öğle ve akşam çakışabilir.
              </p>
              {COMPANION_CATEGORIES.map(({ key, title }) => {
                const options = foodItems.filter((food) => food.category === key);
                const count = options.filter((option) => companions.includes(option.id)).length;
                return (
                  <div key={key}>
                    <p className="text-[11px] font-medium text-white/40 mb-1.5">
                      {title}
                      {count > 0 ? ` · ${count}` : ''}
                    </p>
                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                      {options.map((option) => {
                        const active = companions.includes(option.id);
                        return (
                          <button
                            key={option.id}
                            type="button"
                            aria-pressed={active}
                            onClick={() => toggleCompanion(option.id)}
                            className={cn(
                              'text-xs px-2 py-1 rounded-full border transition-colors',
                              active
                                ? colors.badge
                                : 'border-white/10 text-white/50 hover:bg-white/5 hover:text-white/80'
                            )}
                          >
                            {option.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="text-[11px] leading-relaxed text-white/35 space-y-0.5">
        <p>• Aynı gün öğle ve akşamda aynı protein gelmez; aynı protein üst üste en fazla 2 gün seçilir.</p>
        <p>• Bakliyat öğlendeyse akşam hafif (sebze/balık) olur. Pratik yemekler hafta sonu öğlene konur.</p>
        <p>• Hamur işi / karbonhidrat ağırlıklı ana yemeğin yanına pilav-makarna gelmez.</p>
        <p>• Ortak baskın bileşenli yemekler aynı öğünde birlikte gelmez (mercimek çorbası + mercimek köftesi gibi).</p>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          className={cn('px-3 py-1.5 rounded-lg text-white text-xs font-medium transition-colors', colors.btn)}
        >
          Kaydet
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 rounded-lg text-xs text-white/60 hover:text-white hover:bg-white/5 transition-colors"
        >
          Vazgeç
        </button>
        {seedItem && (
          <button
            type="button"
            onClick={handleReset}
            className="ml-auto flex items-center gap-1 text-[11px] text-white/40 hover:text-white/80 transition-colors"
            title="Varsayılan etiketleri geri yükle (Kaydet'e basana kadar uygulanmaz)"
          >
            <RotateCcw className="w-3 h-3" />
            Varsayılana dön
          </button>
        )}
      </div>
    </div>
  );
}

function CategoryPanel({ categoryKey }: { categoryKey: CategoryKey }) {
  const [newName, setNewName] = useState('');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
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
      <div className={cn('flex-1 overflow-y-auto px-4 py-2 space-y-1 scrollbar-thin', editingId ? 'max-h-[40rem]' : 'max-h-52')}>
        {items.length === 0 ? (
          <p className="text-center text-white/30 text-xs py-4">Ürün bulunamadı</p>
        ) : (
          items.map((item) => {
            const editable = categoryKey !== 'snacks'; // ara öğünler menü motorunda kullanılmaz
            const isEditing = editingId === item.id;
            const hasStoredTags = Boolean(item.tags?.length);
            const shownTags = editable ? getEffectiveTags(item) : [];
            const companionCount =
              categoryKey === 'mainCourses'
                ? (item.suggestedCompanions ?? []).filter((id) => foodItems.some((food) => food.id === id)).length
                : 0;

            return (
              <div key={item.id} className="rounded-lg hover:bg-white/5 transition-colors">
                <div className="flex items-center justify-between group px-3 py-2">
                  <span className="text-sm text-white/80 truncate flex-1">{item.name}</span>
                  {editable && (
                    <button
                      type="button"
                      onClick={() => setEditingId(isEditing ? null : item.id)}
                      className={cn(
                        'ml-2 shrink-0 transition-colors',
                        isEditing ? colors.text : 'text-white/30 hover:text-white/80'
                      )}
                      title="Etiketleri düzenle"
                      aria-label={`${item.name} etiketlerini düzenle`}
                      aria-expanded={isEditing}
                    >
                      <Tag className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => removeFoodItem(item.id)}
                    className="opacity-0 group-hover:opacity-100 text-red-400/60 hover:text-red-400 transition-all ml-2 shrink-0"
                    title="Sil"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {editable && !isEditing && (shownTags.length > 0 || companionCount > 0) && (
                  <div className="flex flex-wrap gap-1 px-3 pb-2 -mt-1">
                    {shownTags.slice(0, 4).map((tag) => (
                      <span
                        key={tag}
                        title={hasStoredTags ? undefined : 'İsminden tahmin edildi'}
                        className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded-full border',
                          hasStoredTags ? colors.badge : 'border-dashed border-white/20 text-white/40'
                        )}
                      >
                        {getTagLabel(tag)}
                      </span>
                    ))}
                    {shownTags.length > 4 && (
                      <span className="text-[10px] text-white/30 px-1">+{shownTags.length - 4}</span>
                    )}
                    {companionCount > 0 && (
                      <span
                        title="Önerilen eşlikçi sayısı"
                        className="text-[10px] px-1.5 py-0.5 rounded-full border border-white/15 text-white/60"
                      >
                        ★ {companionCount} eşlikçi
                      </span>
                    )}
                  </div>
                )}

                {editable && !isEditing && shownTags.length === 0 && companionCount === 0 && (
                  <button
                    type="button"
                    onClick={() => setEditingId(item.id)}
                    className="px-3 pb-2 -mt-1 text-[10px] text-white/25 hover:text-white/60 transition-colors"
                  >
                    etiket yok · ekle
                  </button>
                )}

                {isEditing && <TagEditor item={item} colors={colors} onClose={() => setEditingId(null)} />}
              </div>
            );
          })
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
        <p className="text-sm text-white/50 mt-1">
          Kategorilere yemek ekleyin veya çıkarın. Etiket simgesiyle (<Tag className="inline w-3 h-3 -mt-0.5" />) yemeğin
          etiketlerini düzenleyin; otomatik menü bu etiketlere göre kural uygular. Ana yemeklerde ayrıca yanına önerilen çorba, yan yemek ve
          tamamlayıcıları seçebilirsiniz.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CATEGORY_META.map((cat) => (
          <CategoryPanel key={cat.key} categoryKey={cat.key} />
        ))}
      </div>
    </div>
  );
}
