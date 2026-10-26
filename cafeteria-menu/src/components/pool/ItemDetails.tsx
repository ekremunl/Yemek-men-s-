// src/components/pool/ItemDetails.tsx
'use client';
import { useMemo, useState } from 'react';
import { BookOpen, Flame, Link2Off } from 'lucide-react';
import { useAppStore } from '@/context/store';
import { MAIN_GROUPS, MAIN_GROUP_LABEL, type CategoryKey, type FoodItem, type MainGroup } from '@/types';
import { matchRecipes } from '@/lib/mutfak';
import { cn } from '@/lib/utils';
import ItemPicker from '@/components/ui/ItemPicker';

/** Yemeğin ayrıntıları: (ana yemekte) grup, kalori ve reçete bağlantısı. Değişiklikler anında kaydedilir. */
export default function ItemDetails({ item }: { item: FoodItem }) {
  const setCalories = useAppStore((s) => s.setCalories);
  const setMainGroup = useAppStore((s) => s.setMainGroup);
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
    const ok = Number.isFinite(n) && n > 0;
    setCalories(item.id, ok ? n : null);
    if (!ok) setKcal('');
  };

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-4">
      {item.category === 'mainCourses' && (
        <div>
          <p className="text-[11px] font-medium text-white/50 mb-1.5">Grup (menü üretici bu gruplardan seçer)</p>
          <div className="flex flex-wrap gap-1.5">
            {MAIN_GROUPS.map((g: MainGroup) => (
              <button
                key={g}
                type="button"
                aria-pressed={item.group === g}
                onClick={() => setMainGroup(item.id, g)}
                className={cn('min-h-[2.5rem] px-3 rounded-full border text-xs font-medium', item.group === g ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-white/10 bg-white/5 text-white/60')}
              >
                {MAIN_GROUP_LABEL[g].replace(' yemekleri', '')}
              </button>
            ))}
            <button
              type="button"
              aria-pressed={!item.group}
              onClick={() => setMainGroup(item.id, undefined)}
              className={cn('min-h-[2.5rem] px-3 rounded-full border text-xs font-medium', !item.group ? 'bg-amber-500/80 border-amber-400 text-white' : 'border-white/10 bg-white/5 text-white/60')}
            >
              Grupsuz
            </button>
          </div>
          {!item.group && <p className="mt-1 text-[11px] text-amber-300/80">Grupsuz yemek menüye otomatik alınmaz.</p>}
        </div>
      )}

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
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            placeholder="örn. 250"
            className="w-32 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30"
          />
          <span className="text-xs text-white/40">kcal</span>
        </div>
      </div>

      <div>
        <p className="flex items-center gap-1.5 text-[11px] font-medium text-white/50 mb-1.5">
          <BookOpen className="w-3.5 h-3.5 text-emerald-300" />
          Reçete (Mutfak)
        </p>
        {recipeList.length === 0 ? (
          <p className="text-[11px] text-white/40 leading-relaxed">
            Henüz reçete yok.{' '}
            <button type="button" onClick={() => setActiveTab('kitchen')} className="underline underline-offset-2 text-indigo-300">Mutfak → Reçeteler</button>
            {' '}bölümünden ekleyin ya da eski uygulamadan alın.
          </p>
        ) : (
          <div className="flex items-stretch gap-2">
            <div className="flex-1 min-w-0">
              <ItemPicker items={pickerItems} value={item.recipeId ?? null} onChange={(id) => linkRecipe(item.id, id)} title={`"${item.name}" için reçete seç`} placeholder="Reçete bağla…" suggestedIds={suggestions} suggestedLabel="benzer" />
            </div>
            {item.recipeId && (
              <button type="button" onClick={() => linkRecipe(item.id, null)} aria-label="Reçete bağlantısını kaldır" className="w-12 shrink-0 flex items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/50 active:bg-white/15">
                <Link2Off className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
        {item.recipeId && !linked && recipeList.length > 0 && <p className="mt-1 text-[11px] text-amber-300/80">Bağlı reçete bulunamadı; yeniden içe aktarın.</p>}
        {linked && <p className="mt-1 text-[11px] text-white/40">{linked.ings.length} malzeme · kişi başı miktarlar malzeme listesinde kullanılır</p>}
      </div>
    </div>
  );
}
