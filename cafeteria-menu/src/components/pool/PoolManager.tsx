// src/components/pool/PoolManager.tsx
'use client';
import { useMemo, useState } from 'react';
import {
  Plus, Trash2, Soup, UtensilsCrossed, Salad, Apple, Search, Cookie, Tag, RotateCcw,
  CheckSquare, Square, Sparkles, ChevronDown, Flame, BookOpen, Link2Off,
} from 'lucide-react';
import { useAppStore, FoodItemMetadataChanges } from '@/context/store';
import { CategoryKey, FoodItem } from '@/types';
import { CATEGORY_META, SEED_DATA } from '@/lib/seedData';
import { getEffectiveTags, inferTagsFromName, INGREDIENT_SUGGESTIONS } from '@/lib/menu';
import { getTagLabel, isKnownTag, TAG_GROUPS, servingTagsFirst } from '@/lib/tags';
import { cn } from '@/lib/utils';
import { IngredientInput, TagPicker } from './TagPicker';
import { CompanionPicker } from './CompanionPicker';
import ItemPicker from '@/components/ui/ItemPicker';
import { matchRecipes } from '@/lib/mutfak';

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

const uniq = (list: string[]) => Array.from(new Set(list));

/** Etiket filtresi: null = hepsi, aksi halde etiket anahtarı veya özel filtre. */
type TagFilter = string | null;
const FILTER_NONE = '__none'; // etiketi (kayıtlı ya da tahmini) hiç olmayanlar
const FILTER_GUESSED = '__guessed'; // yalnızca isminden tahmin edilen etiketi olanlar
const FILTER_NO_COMPANION = '__no_companion'; // eşlikçisi seçilmemiş ana yemekler

function matchesFilter(item: FoodItem, filter: TagFilter): boolean {
  if (!filter) return true;
  if (filter === FILTER_NO_COMPANION) return item.category === 'mainCourses' && !item.suggestedCompanions?.length;
  if (item.category === 'snacks') return false; // ara öğünler etiketlenmez
  const effective = getEffectiveTags(item);
  if (filter === FILTER_NONE) return effective.length === 0;
  if (filter === FILTER_GUESSED) return !item.tags?.length && effective.length > 0;
  return effective.includes(filter);
}

const BADGE_ADD = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
const BADGE_REMOVE = 'bg-red-500/20 text-red-300 border-red-500/30';
const FILTER_ON = 'bg-indigo-500/25 text-indigo-200 border-indigo-400/40';
const FILTER_OFF = 'border-white/10 text-white/50 hover:bg-white/5 hover:text-white/80';

/** Yemeğin kalorisi (kcal/porsiyon) ve Mutfaktakip reçete bağlantısı. Değişiklikler anında kaydedilir. */
function ItemMetaFields({ item }: { item: FoodItem }) {
  const setCalories = useAppStore((s) => s.setCalories);
  const linkRecipe = useAppStore((s) => s.linkRecipe);
  const recipes = useAppStore((s) => s.recipes);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const [kcal, setKcal] = useState(item.calories ? String(item.calories) : '');

  const recipeList = useMemo(() => Object.values(recipes).sort((a, b) => a.name.localeCompare(b.name, 'tr')), [recipes]);
  const linked = item.recipeId ? recipes[item.recipeId] : undefined;
  const suggestions = useMemo(() => {
    const match = matchRecipes([item], recipeList)[0];
    return match ? (match.exact ? [match.exact] : match.suggestions).map((r) => r.id) : [];
  }, [item, recipeList]);
  const pickerItems = useMemo<FoodItem[]>(
    () => recipeList.map((r) => ({ id: r.id, name: r.name, category: 'mainCourses' as CategoryKey })),
    [recipeList]
  );

  const commitKcal = () => {
    const n = Number(kcal.replace(',', '.'));
    setCalories(item.id, Number.isFinite(n) && n > 0 ? n : null);
    if (!(Number.isFinite(n) && n > 0)) setKcal('');
  };

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 space-y-3">
      <div>
        <label className="flex items-center gap-1.5 text-[11px] font-medium text-white/50 mb-1.5" htmlFor={`kcal-${item.id}`}>
          <Flame className="w-3.5 h-3.5 text-orange-300" />
          Kalori (porsiyon başına)
        </label>
        <div className="flex items-center gap-2">
          <input
            id={`kcal-${item.id}`}
            type="number"
            inputMode="numeric"
            min={0}
            value={kcal}
            onChange={(e) => setKcal(e.target.value)}
            onBlur={commitKcal}
            onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget.blur(), undefined)}
            placeholder="örn. 250"
            className="w-32 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30"
          />
          <span className="text-xs text-white/40">kcal</span>
        </div>
      </div>

      <div>
        <p className="flex items-center gap-1.5 text-[11px] font-medium text-white/50 mb-1.5">
          <BookOpen className="w-3.5 h-3.5 text-emerald-300" />
          Mutfaktakip reçetesi
        </p>
        {recipeList.length === 0 ? (
          <p className="text-[11px] text-white/40 leading-relaxed">
            Henüz reçete içe aktarılmadı.{' '}
            <button type="button" onClick={() => setActiveTab('settings')} className="underline underline-offset-2 text-indigo-300">
              Ayarlar → Mutfaktakip
            </button>
            {' '}bölümünden alın.
          </p>
        ) : (
          <div className="flex items-stretch gap-2">
            <div className="flex-1 min-w-0">
              <ItemPicker
                items={pickerItems}
                value={item.recipeId ?? null}
                onChange={(id) => linkRecipe(item.id, id)}
                title={`"${item.name}" için reçete seç`}
                placeholder="Reçete bağla…"
                suggestedIds={suggestions}
                suggestedLabel="benzer"
              />
            </div>
            {item.recipeId && (
              <button
                type="button"
                onClick={() => linkRecipe(item.id, null)}
                aria-label="Reçete bağlantısını kaldır"
                className="w-12 shrink-0 flex items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/50 active:bg-white/15"
              >
                <Link2Off className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
        {item.recipeId && !linked && recipeList.length > 0 && (
          <p className="mt-1 text-[11px] text-amber-300/80">Bağlı reçete Mutfaktakip kopyasında bulunamadı; yeniden içe aktarın.</p>
        )}
        {linked && (
          <p className="mt-1 text-[11px] text-white/40">{linked.ings.length} malzeme · kişi başı miktarlar malzeme listesinde kullanılır</p>
        )}
      </div>
    </div>
  );
}

/** Bir yemeğin etiketlerini ve baskın bileşenlerini düzenleyen satır içi panel. Değişiklikler anında kaydedilir. */
function TagEditor({ item, colors, onClose }: { item: FoodItem; colors: CategoryColors; onClose: () => void }) {
  const updateFoodItem = useAppStore((s) => s.updateFoodItem);
  const foodItems = useAppStore((s) => s.foodItems);
  const isMain = item.category === 'mainCourses';
  const seedItem = SEED_DATA.find((seed) => seed.id === item.id);
  const hasStoredTags = Boolean(item.tags?.length);

  // Kayıtlı etiket yoksa isimden tahmin edilenler gösterilir; ilk dokunuşta hepsi kalıcı olur.
  const tags = getEffectiveTags(item);
  const ingredients = item.mainIngredients ?? [];
  // Havuzdan silinmiş yemeklerin kimlikleri ayıklanır.
  const companions = useMemo(
    () => (item.suggestedCompanions ?? []).filter((id) => foodItems.some((food) => food.id === id)),
    [item.suggestedCompanions, foodItems]
  );
  const [showCompanions, setShowCompanions] = useState(companions.length > 0);

  const customSuggestions = useMemo(
    () => uniq(foodItems.flatMap((f) => f.tags ?? []).filter((t) => !isKnownTag(t))).sort((a, b) => a.localeCompare(b, 'tr')),
    [foodItems]
  );
  const ingredientSuggestions = useMemo(
    () => uniq([...INGREDIENT_SUGGESTIONS, ...foodItems.flatMap((f) => f.mainIngredients ?? [])]).sort((a, b) => a.localeCompare(b, 'tr')),
    [foodItems]
  );

  const save = (changes: FoodItemMetadataChanges) => updateFoodItem(item.id, changes, { silent: true });

  const toggleTag = (key: string) => save({ tags: tags.includes(key) ? tags.filter((t) => t !== key) : [...tags, key] });
  const toggleCompanion = (id: string) =>
    save({ suggestedCompanions: companions.includes(id) ? companions.filter((c) => c !== id) : [...companions, id] });

  const setManyCompanions = (ids: string[], on: boolean) =>
    save({ suggestedCompanions: on ? uniq([...companions, ...ids]) : companions.filter((c) => !ids.includes(c)) });

  const handleReset = () => {
    if (!seedItem) return;
    if (!window.confirm('Bu yemeğin etiketleri ve bileşenleri varsayılana döndürülsün mü?')) return;
    save({ tags: seedItem.tags ?? [], mainIngredients: seedItem.mainIngredients ?? [] });
  };

  return (
    <div className="mx-2 mb-2 rounded-xl border border-white/10 bg-black/20 p-3 space-y-3">
      <ItemMetaFields item={item} />

      {item.category === 'snacks' ? (
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-emerald-400/70">✓ Değişiklikler otomatik kaydedilir</span>
          <button
            type="button"
            onClick={onClose}
            className={cn('ml-auto px-4 min-h-[2.5rem] rounded-lg text-white text-xs font-medium transition-colors', colors.btn)}
          >
            Kapat
          </button>
        </div>
      ) : (
      <>
      {!hasStoredTags && (
        <p className="text-[11px] text-white/40">
          Bu yemeğin kayıtlı etiketi yok; gösterilenler isminden tahmin edildi. Bir etikete dokunduğunuzda tahminler de kaydedilir.
        </p>
      )}

      <TagPicker
        category={item.category}
        selected={tags}
        onToggle={toggleTag}
        activeClass={colors.badge}
        customSuggestions={customSuggestions}
      />

      <div>
        <p className="text-[11px] font-medium text-white/40 mb-1.5">Baskın bileşenler (Enter veya virgülle ekleyin)</p>
        <IngredientInput
          value={ingredients}
          onChange={(next) => save({ mainIngredients: next })}
          suggestions={ingredientSuggestions}
          activeClass={colors.badge}
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
                <span className="text-amber-300/80 font-medium">Zorunlu:</span> Menü oluşturulurken bu ana yemeğin yanına,
                eşlikçi seçtiğiniz her kategoriden (çorba / yan yemek / tamamlayıcı) yalnızca buradaki yemeklerden biri gelir.
                Bir kategoride hiç seçim yapmazsanız o kategori serbest kalır. Her kategoride 2-3 eşlikçi seçmeniz önerilir;
                tek seçenek aynı gün öğle ve akşam çakışmasına yol açabilir. Hafta sonu akşamı öğleyle aynı olan yemekler bu şarttan muaftır.
              </p>
              <CompanionPicker
                foodItems={foodItems}
                selected={companions}
                onToggle={toggleCompanion}
                onSetMany={setManyCompanions}
                activeClass={colors.badge}
              />
            </div>
          )}
        </div>
      )}

      <div className="text-[11px] leading-relaxed text-white/35 space-y-0.5">
        <p>• Aynı gün öğle ve akşamda aynı protein gelmez; aynı protein üst üste en fazla 2 gün seçilir.</p>
        <p>• Bakliyat öğlendeyse akşam hafif (sebze/balık) olur. Pratik yemekler hafta sonu öğlene konur.</p>
        <p>• Hamur işi / karbonhidrat ağırlıklı ana yemeğin yanına pilav-makarna gelmez.</p>
        <p>• Ortak baskın bileşenli yemekler aynı öğünde birlikte gelmez (mercimek çorbası + mercimek köftesi gibi).</p>
        <p>• Tüm etiketleri kaldırırsanız yemek yine isminden tahmin edilen etiketlere döner.</p>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[11px] text-emerald-400/70">✓ Değişiklikler otomatik kaydedilir</span>
        <button
          type="button"
          onClick={onClose}
          className={cn('ml-auto px-3 py-1.5 rounded-lg text-white text-xs font-medium transition-colors', colors.btn)}
        >
          Kapat
        </button>
        {seedItem && (
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1 text-[11px] text-white/40 hover:text-white/80 transition-colors"
            title="Varsayılan etiketleri geri yükle"
          >
            <RotateCcw className="w-3 h-3" />
            Varsayılana dön
          </button>
        )}
      </div>
      </>
      )}
    </div>
  );
}

interface CategoryPanelProps {
  categoryKey: CategoryKey;
  filter: TagFilter;
  selectMode: boolean;
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onSetMany: (ids: string[], on: boolean) => void;
}

function CategoryPanel({ categoryKey, filter, selectMode, selected, onToggleSelect, onSetMany }: CategoryPanelProps) {
  const [newName, setNewName] = useState('');
  const [newTags, setNewTags] = useState<string[] | null>(null); // null = isimden tahmini izle
  const [showNewTags, setShowNewTags] = useState(false);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const { foodItems, addFoodItem, removeFoodItem } = useAppStore((s) => ({
    foodItems: s.foodItems,
    addFoodItem: s.addFoodItem,
    removeFoodItem: s.removeFoodItem,
  }));

  const meta = CATEGORY_META.find((c) => c.key === categoryKey)!;
  const colors = CAT_COLORS[categoryKey];
  const editable = categoryKey !== 'snacks'; // ara öğünler menü motorunda kullanılmaz
  const query = search.toLocaleLowerCase('tr-TR');
  const total = foodItems.filter((f) => f.category === categoryKey).length;
  const items = foodItems.filter(
    (f) => f.category === categoryKey && f.name.toLocaleLowerCase('tr-TR').includes(query) && matchesFilter(f, filter)
  );
  const allVisibleSelected = items.length > 0 && items.every((i) => selected.has(i.id));

  const customSuggestions = useMemo(
    () => uniq(foodItems.flatMap((f) => f.tags ?? []).filter((t) => !isKnownTag(t))).sort((a, b) => a.localeCompare(b, 'tr')),
    [foodItems]
  );

  // Yeni yemek için isimden tahmin edilen etiketler; kullanıcı dokunana kadar bunlar izlenir.
  const suggestedTags = useMemo(
    () => (editable && newName.trim() ? inferTagsFromName({ id: 'new', name: newName, category: categoryKey }) : []),
    [editable, newName, categoryKey]
  );
  const pickedTags = newTags ?? suggestedTags;

  const toggleNewTag = (key: string) =>
    setNewTags((prev) => {
      const base = prev ?? suggestedTags;
      return base.includes(key) ? base.filter((t) => t !== key) : [...base, key];
    });

  const handleAdd = () => {
    if (!newName.trim()) return;
    addFoodItem(newName, categoryKey, editable && pickedTags.length > 0 ? { tags: pickedTags } : undefined);
    setNewName('');
    setNewTags(null);
    setShowNewTags(false);
  };

  return (
    <div className={cn('rounded-2xl border backdrop-blur-sm flex flex-col', colors.bg, colors.border)}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
        <span className={cn('p-2 rounded-lg', colors.bg, colors.text)}>{CAT_ICONS[categoryKey]}</span>
        <div className="flex-1">
          <h3 className="font-semibold text-white text-sm">{meta.labelTR}</h3>
          <p className="text-xs text-white/40">{items.length} / {total} ürün</p>
        </div>
        {selectMode && editable && (
          <button
            type="button"
            onClick={() => onSetMany(items.map((i) => i.id), !allVisibleSelected)}
            disabled={items.length === 0}
            className="flex items-center gap-1 text-[11px] text-white/60 hover:text-white disabled:opacity-30 transition-colors"
          >
            {allVisibleSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
            Görünenleri seç
          </button>
        )}
        <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium', colors.badge)}>{total}</span>
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
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/30 transition-colors"
          />
        </div>
      </div>

      {/* List */}
      <div className={cn('flex-1 overflow-y-auto px-4 py-2 space-y-1 scrollbar-thin', editingId ? 'max-h-[40rem]' : 'max-h-52')}>
        {items.length === 0 ? (
          <p className="text-center text-white/30 text-xs py-4">Ürün bulunamadı</p>
        ) : (
          items.map((item) => {
            const isEditing = editingId === item.id;
            const isSelected = selected.has(item.id);
            const hasStoredTags = Boolean(item.tags?.length);
            const shownTags = editable ? servingTagsFirst(getEffectiveTags(item)) : [];
            const companionCount =
              categoryKey === 'mainCourses'
                ? (item.suggestedCompanions ?? []).filter((id) => foodItems.some((food) => food.id === id)).length
                : 0;

            return (
              <div key={item.id} className={cn('rounded-lg hover:bg-white/5 transition-colors', isSelected && 'bg-indigo-500/10')}>
                <div className="flex items-center justify-between group pl-3 pr-1 py-0.5 min-h-[2.75rem]">
                  {selectMode && editable && (
                    <button
                      type="button"
                      onClick={() => onToggleSelect(item.id)}
                      aria-pressed={isSelected}
                      aria-label={`${item.name} seç`}
                      className={cn('mr-2 shrink-0 transition-colors', isSelected ? 'text-indigo-300' : 'text-white/30 hover:text-white/70')}
                    >
                      {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                    </button>
                  )}
                  <span
                    className={cn('text-sm text-white/80 truncate flex-1', selectMode && editable && 'cursor-pointer')}
                    onClick={selectMode && editable ? () => onToggleSelect(item.id) : undefined}
                  >
                    {item.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditingId(isEditing ? null : item.id)}
                    className={cn('ml-1 shrink-0 w-10 h-10 flex items-center justify-center rounded-lg transition-colors', isEditing ? colors.text : 'text-white/40 hover:text-white/80')}
                    title={editable ? 'Etiket, kalori ve reçete' : 'Kalori ve reçete'}
                    aria-label={`${item.name} ayrıntılarını düzenle`}
                    aria-expanded={isEditing}
                  >
                    <Tag className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => removeFoodItem(item.id)}
                    className="hover-reveal opacity-0 group-hover:opacity-100 w-10 h-10 flex items-center justify-center rounded-lg text-red-400/70 hover:text-red-400 active:bg-red-500/10 transition-all shrink-0"
                    title="Sil"
                    aria-label={`${item.name} sil`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {!isEditing && (item.calories || item.recipeId) && (
                  <div className="flex flex-wrap gap-1 px-3 pb-1.5 -mt-0.5">
                    {item.calories ? (
                      <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full border border-orange-400/30 text-orange-300">
                        <Flame className="w-2.5 h-2.5" />
                        {item.calories} kcal
                      </span>
                    ) : null}
                    {item.recipeId ? (
                      <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full border border-emerald-400/30 text-emerald-300">
                        <BookOpen className="w-2.5 h-2.5" />
                        reçeteli
                      </span>
                    ) : null}
                  </div>
                )}

                {editable && !isEditing && (shownTags.length > 0 || companionCount > 0 || categoryKey === 'mainCourses') && (
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
                    {shownTags.length > 4 && <span className="text-[10px] text-white/30 px-1">+{shownTags.length - 4}</span>}
                    {companionCount > 0 && (
                      <span title="Önerilen eşlikçi sayısı" className="text-[10px] px-1.5 py-0.5 rounded-full border border-white/15 text-white/60">
                        ★ {companionCount} eşlikçi
                      </span>
                    )}
                    {categoryKey === 'mainCourses' && companionCount === 0 && (
                      <button
                        type="button"
                        onClick={() => setEditingId(item.id)}
                        title="Eşlikçi seçilmedi: bu ana yemeğin yanına her çorba / yan yemek gelebilir"
                        className="text-[10px] px-1.5 py-0.5 rounded-full border border-dashed border-amber-400/40 text-amber-300/80 hover:bg-amber-400/10 transition-colors"
                      >
                        ⚠ eşlikçi yok
                      </button>
                    )}
                  </div>
                )}

                {editable && !isEditing && shownTags.length === 0 && companionCount === 0 && categoryKey !== 'mainCourses' && (
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
      <div className="px-4 pb-4 pt-2 border-t border-white/5 mt-1 space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Yeni ürün ekle..."
            className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-3 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30 transition-colors"
          />
          <button onClick={handleAdd} className={cn('w-12 flex items-center justify-center rounded-lg text-white text-sm font-medium transition-colors shrink-0', colors.btn)}>
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {editable && newName.trim() && (
          <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 space-y-2">
            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-white/40 shrink-0">Etiketler:</span>
              <span className="flex flex-wrap gap-1 flex-1">
                {pickedTags.length === 0 ? (
                  <span className="text-white/30">yok</span>
                ) : (
                  pickedTags.map((tag) => (
                    <span key={tag} className={cn('px-1.5 py-0.5 rounded-full border', colors.badge)}>
                      {getTagLabel(tag)}
                    </span>
                  ))
                )}
              </span>
              <button
                type="button"
                onClick={() => setShowNewTags((open) => !open)}
                aria-expanded={showNewTags}
                className="flex items-center gap-0.5 text-white/50 hover:text-white transition-colors shrink-0"
              >
                {showNewTags ? 'Gizle' : 'Değiştir'}
                <ChevronDown className={cn('w-3 h-3 transition-transform', showNewTags && 'rotate-180')} />
              </button>
            </div>
            {!newTags && suggestedTags.length > 0 && (
              <p className="text-[10px] text-white/30">İsminden tahmin edildi; eklemeden önce değiştirebilirsiniz.</p>
            )}
            {showNewTags && (
              <TagPicker
                category={categoryKey}
                selected={pickedTags}
                onToggle={toggleNewTag}
                activeClass={colors.badge}
                customSuggestions={customSuggestions}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Seçili yemeklere toplu etiket ya da eşlikçi uygular. Ekranın altına yapışık çalışır. */
function BulkBar({ ids, onClear }: { ids: string[]; onClear: () => void }) {
  const bulkUpdateTags = useAppStore((s) => s.bulkUpdateTags);
  const bulkUpdateCompanions = useAppStore((s) => s.bulkUpdateCompanions);
  const addToast = useAppStore((s) => s.addToast);
  const foodItems = useAppStore((s) => s.foodItems);
  const [target, setTarget] = useState<'tags' | 'companions'>('tags');
  const [mode, setMode] = useState<'add' | 'remove'>('add');
  const [companionMode, setCompanionMode] = useState<'add' | 'remove' | 'replace'>('add');
  const [picked, setPicked] = useState<string[]>([]);
  const [pickedCompanions, setPickedCompanions] = useState<string[]>([]);
  const [open, setOpen] = useState(true);

  const mainIds = useMemo(
    () => foodItems.filter((f) => ids.includes(f.id) && f.category === 'mainCourses').map((f) => f.id),
    [foodItems, ids]
  );

  const customSuggestions = useMemo(
    () => uniq(foodItems.flatMap((f) => f.tags ?? []).filter((t) => !isKnownTag(t))).sort((a, b) => a.localeCompare(b, 'tr')),
    [foodItems]
  );

  const toggle = (tag: string) => setPicked((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  const toggleCompanion = (id: string) =>
    setPickedCompanions((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  const setManyCompanions = (list: string[], on: boolean) =>
    setPickedCompanions((prev) => (on ? uniq([...prev, ...list]) : prev.filter((c) => !list.includes(c))));

  const applyTags = () => {
    if (picked.length === 0) return;
    const changed = bulkUpdateTags(ids, mode === 'add' ? picked : [], mode === 'remove' ? picked : []);
    addToast({
      type: changed > 0 ? 'success' : 'error',
      title: 'Toplu etiketleme',
      message:
        changed > 0
          ? `${changed} yemek güncellendi.`
          : 'Hiçbir yemek değişmedi (etiketler zaten öyleydi ya da kategoriye uygun değildi).',
    });
    setPicked([]);
  };

  const applyCompanions = () => {
    const replace = companionMode === 'replace';
    if (pickedCompanions.length === 0 && !replace) return;
    if (replace && pickedCompanions.length === 0) {
      if (!window.confirm(`${mainIds.length} ana yemeğin tüm eşlikçileri silinsin mi? (Eşlikçisiz kategori serbest kalır.)`)) return;
    }
    const changed = bulkUpdateCompanions(
      mainIds,
      companionMode === 'remove' ? [] : pickedCompanions,
      companionMode === 'remove' ? pickedCompanions : [],
      { replace }
    );
    addToast({
      type: changed > 0 ? 'success' : 'error',
      title: 'Toplu eşlikçi seçimi',
      message:
        changed > 0
          ? `${changed} ana yemeğin eşlikçileri güncellendi.`
          : 'Hiçbir ana yemek değişmedi (eşlikçiler zaten öyleydi).',
    });
    setPickedCompanions([]);
  };

  const isCompanions = target === 'companions';
  const pickedCount = isCompanions ? pickedCompanions.length : picked.length;
  const canApply = isCompanions
    ? mainIds.length > 0 && (pickedCompanions.length > 0 || companionMode === 'replace')
    : picked.length > 0;
  const removing = isCompanions ? companionMode === 'remove' : mode === 'remove';
  const segment = (active: boolean, tone: string) =>
    cn('px-3 py-1.5 transition-colors', active ? tone : 'text-white/50 hover:bg-white/5');

  return (
    <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] lg:bottom-0 z-40 border-t border-white/10 bg-slate-900/95 backdrop-blur">
      <div className="max-w-3xl mx-auto p-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex items-center gap-1 text-sm font-semibold text-white">
            {ids.length} yemek seçili
            <ChevronDown className={cn('w-4 h-4 transition-transform', open && 'rotate-180')} />
          </button>
          <div className="flex rounded-lg border border-white/10 overflow-hidden text-xs">
            <button type="button" onClick={() => setTarget('tags')} className={segment(!isCompanions, 'bg-indigo-500/30 text-indigo-100')}>
              Etiket
            </button>
            <button type="button" onClick={() => setTarget('companions')} className={segment(isCompanions, 'bg-indigo-500/30 text-indigo-100')}>
              Eşlikçi
            </button>
          </div>
          {isCompanions ? (
            <div className="flex rounded-lg border border-white/10 overflow-hidden text-xs">
              <button type="button" onClick={() => setCompanionMode('add')} className={segment(companionMode === 'add', 'bg-emerald-500/30 text-emerald-200')}>
                Ekle
              </button>
              <button type="button" onClick={() => setCompanionMode('remove')} className={segment(companionMode === 'remove', 'bg-red-500/30 text-red-200')}>
                Çıkar
              </button>
              <button type="button" onClick={() => setCompanionMode('replace')} className={segment(companionMode === 'replace', 'bg-amber-500/30 text-amber-200')}>
                Değiştir
              </button>
            </div>
          ) : (
            <div className="flex rounded-lg border border-white/10 overflow-hidden text-xs">
              <button type="button" onClick={() => setMode('add')} className={segment(mode === 'add', 'bg-emerald-500/30 text-emerald-200')}>
                Etiket ekle
              </button>
              <button type="button" onClick={() => setMode('remove')} className={segment(mode === 'remove', 'bg-red-500/30 text-red-200')}>
                Etiket çıkar
              </button>
            </div>
          )}
          <button type="button" onClick={onClear} className="ml-auto text-xs text-white/50 hover:text-white transition-colors">
            Seçimi temizle
          </button>
          <button
            type="button"
            onClick={isCompanions ? applyCompanions : applyTags}
            disabled={!canApply}
            className={cn(
              'px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors disabled:opacity-30',
              removing ? 'bg-red-600 hover:bg-red-500' : 'bg-emerald-600 hover:bg-emerald-500'
            )}
          >
            Uygula{pickedCount > 0 ? ` (${pickedCount})` : ''}
          </button>
        </div>
        {isCompanions && (
          <p className={cn('text-[11px]', mainIds.length > 0 ? 'text-white/40' : 'text-amber-300/80')}>
            {mainIds.length > 0
              ? `${mainIds.length} ana yemeğe uygulanır${companionMode === 'replace' ? '; mevcut eşlikçilerin yerine geçer' : ''}. Çorba / yan yemek / tamamlayıcı seçili olsa bile yalnızca ana yemekler etkilenir.`
              : 'Eşlikçi atamak için en az bir ana yemek seçin.'}
          </p>
        )}
        {open && (
          <div className="max-h-[38vh] overflow-y-auto pr-1">
            {isCompanions ? (
              <CompanionPicker
                foodItems={foodItems}
                selected={pickedCompanions}
                onToggle={toggleCompanion}
                onSetMany={setManyCompanions}
                activeClass={companionMode === 'remove' ? BADGE_REMOVE : BADGE_ADD}
              />
            ) : (
              <TagPicker selected={picked} onToggle={toggle} activeClass={mode === 'add' ? BADGE_ADD : BADGE_REMOVE} customSuggestions={customSuggestions} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PoolManager() {
  const foodItems = useAppStore((s) => s.foodItems);
  const confirmInferredTags = useAppStore((s) => s.confirmInferredTags);
  const addToast = useAppStore((s) => s.addToast);
  const [filter, setFilter] = useState<TagFilter>(null);
  const [showTagFilters, setShowTagFilters] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const stats = useMemo(() => {
    const counts = new Map<string, number>();
    let none = 0;
    let guessed = 0;
    let noCompanion = 0;
    foodItems.forEach((item) => {
      if (item.category === 'mainCourses' && !item.suggestedCompanions?.length) noCompanion += 1;
      if (item.category === 'snacks') return;
      const effective = getEffectiveTags(item);
      if (effective.length === 0) none += 1;
      else if (!item.tags?.length) guessed += 1;
      effective.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1));
    });
    return { counts, none, guessed, noCompanion };
  }, [foodItems]);

  // Bilinen etiketler grup sırasıyla, ardından havuzda kullanılan özel etiketler.
  const filterTags = useMemo(() => {
    const known = TAG_GROUPS.flatMap((g) => g.tags.map((t) => t.key));
    const custom = Array.from(stats.counts.keys()).filter((t) => !isKnownTag(t)).sort((a, b) => a.localeCompare(b, 'tr'));
    return uniq([...known, ...custom]).filter((tag) => (stats.counts.get(tag) ?? 0) > 0 || tag === filter);
  }, [stats, filter]);

  const selectedIds = useMemo(
    () => foodItems.filter((f) => selected.has(f.id) && f.category !== 'snacks').map((f) => f.id),
    [foodItems, selected]
  );

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const setMany = (ids: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });

  const toggleSelectMode = () => {
    setSelectMode((on) => !on);
    setSelected(new Set());
  };

  const handleConfirmGuessed = () => {
    if (!window.confirm(`${stats.guessed} yemeğin isminden tahmin edilen etiketleri kalıcı olarak kaydedilsin mi? Sonra tek tek düzeltebilirsiniz.`)) return;
    const count = confirmInferredTags();
    addToast({ type: 'success', title: 'Tahminler kaydedildi', message: `${count} yemeğin etiketleri kalıcı hale getirildi.` });
  };

  const chip = (key: TagFilter, label: string, count?: number) => (
    <button
      key={key ?? 'all'}
      type="button"
      aria-pressed={filter === key}
      onClick={() => setFilter(filter === key ? null : key)}
      className={cn('text-xs px-2.5 py-1 rounded-full border transition-colors', filter === key ? FILTER_ON : FILTER_OFF)}
    >
      {label}
      {count !== undefined ? ` · ${count}` : ''}
    </button>
  );

  return (
    <div className={cn('space-y-6', selectedIds.length > 0 && 'pb-72')}>
      <div>
        <h2 className="text-xl font-bold text-white">Ürün Havuzu Yönetimi</h2>
        <p className="text-sm text-white/50 mt-1 hidden sm:block">
          Kategorilere yemek ekleyin veya çıkarın. Etiket simgesiyle (<Tag className="inline w-3 h-3 -mt-0.5" />) yemeğin
          etiketlerini düzenleyin; değişiklikler anında kaydedilir. Otomatik menü bu etiketlere göre kural uygular. Ana yemeklerde
          ayrıca yanına gelecek çorba, yan yemek ve tamamlayıcıları (eşlikçiler) seçebilirsiniz; seçilen eşlikçiler menüde zorunludur.
          Birçok ana yemeğe aynı anda eşlikçi atamak için «Toplu seç»i kullanın.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleSelectMode}
            aria-pressed={selectMode}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors',
              selectMode ? FILTER_ON : 'border-white/10 text-white/70 hover:bg-white/5'
            )}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            {selectMode ? 'Toplu seçimi kapat' : 'Toplu seç'}
          </button>
          {stats.guessed > 0 && (
            <button
              type="button"
              onClick={handleConfirmGuessed}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20 text-xs font-medium transition-colors"
              title="İsminden tahmin edilen etiketleri kalıcı yapar"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Tahminleri kaydet ({stats.guessed})
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 items-center">
          {chip(null, 'Tümü')}
          {chip(FILTER_NONE, 'Etiketsiz', stats.none)}
          {chip(FILTER_GUESSED, 'Tahmini', stats.guessed)}
          {chip(FILTER_NO_COMPANION, 'Eşlikçisiz ana yemek', stats.noCompanion)}
          <button
            type="button"
            onClick={() => setShowTagFilters((v) => !v)}
            aria-expanded={showTagFilters}
            className="flex items-center gap-0.5 text-xs text-white/50 hover:text-white px-1.5 transition-colors"
          >
            Etikete göre
            <ChevronDown className={cn('w-3 h-3 transition-transform', showTagFilters && 'rotate-180')} />
          </button>
        </div>

        {(showTagFilters || (filter && filter !== FILTER_NONE && filter !== FILTER_GUESSED && filter !== FILTER_NO_COMPANION)) && (
          <div className="flex flex-wrap gap-1.5">
            {filterTags.map((tag) => chip(tag, getTagLabel(tag), stats.counts.get(tag) ?? 0))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CATEGORY_META.filter((cat) => !filter || cat.key !== 'snacks').map((cat) => (
          <CategoryPanel
            key={cat.key}
            categoryKey={cat.key}
            filter={filter}
            selectMode={selectMode}
            selected={selected}
            onToggleSelect={toggleSelect}
            onSetMany={setMany}
          />
        ))}
      </div>

      {selectMode && selectedIds.length > 0 && <BulkBar ids={selectedIds} onClear={() => setSelected(new Set())} />}
    </div>
  );
}
