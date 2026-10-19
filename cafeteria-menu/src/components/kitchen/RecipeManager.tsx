// src/components/kitchen/RecipeManager.tsx
'use client';
import { useMemo, useState } from 'react';
import { Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useAppStore } from '@/context/store';
import type { LinkedRecipe, RecipeIngredient } from '@/types';
import { RECIPE_CATEGORIES, RECIPE_UNITS } from '@/lib/kitchen';
import { normalizeName } from '@/lib/mutfak';
import { cn } from '@/lib/utils';
import BottomSheet from '@/components/ui/BottomSheet';

interface Draft {
  id?: string;
  name: string;
  cat: string;
  ings: { name: string; amt: string; unit: string }[];
}

const blankDraft = (): Draft => ({ name: '', cat: 'Ana Yemek', ings: [{ name: '', amt: '', unit: 'g' }] });
const fromRecipe = (r: LinkedRecipe): Draft => ({
  id: r.id,
  name: r.name,
  cat: r.cat ?? 'Diğer',
  ings: r.ings.length ? r.ings.map((i) => ({ name: i.name, amt: String(i.amt), unit: i.unit })) : [{ name: '', amt: '', unit: 'g' }],
});

const field = 'min-w-0 w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30';

/** Reçete havuzu: malzemeler 1 kişilik miktar üzerinden girilir. */
export default function RecipeManager() {
  const { recipes, foodItems, saveRecipe, deleteRecipe, linkRecipe, addToast } = useAppStore((s) => ({
    recipes: s.recipes,
    foodItems: s.foodItems,
    saveRecipe: s.saveRecipe,
    deleteRecipe: s.deleteRecipe,
    linkRecipe: s.linkRecipe,
    addToast: s.addToast,
  }));

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Hepsi');
  const [draft, setDraft] = useState<Draft | null>(null);

  const list = useMemo(() => Object.values(recipes).sort((a, b) => a.name.localeCompare(b.name, 'tr')), [recipes]);
  const categories = useMemo(() => ['Hepsi', ...Array.from(new Set(list.map((r) => r.cat ?? 'Diğer'))).sort((a, b) => a.localeCompare(b, 'tr'))], [list]);
  const shown = list.filter(
    (r) =>
      (category === 'Hepsi' || (r.cat ?? 'Diğer') === category) &&
      (!query || r.name.toLocaleLowerCase('tr-TR').includes(query.toLocaleLowerCase('tr-TR')))
  );
  const linkedCount = (id: string) => foodItems.filter((f) => f.recipeId === id).length;

  const setIng = (i: number, patch: Partial<Draft['ings'][number]>) =>
    setDraft((d) => (d ? { ...d, ings: d.ings.map((g, k) => (k === i ? { ...g, ...patch } : g)) } : d));

  const save = () => {
    if (!draft) return;
    const name = draft.name.trim();
    const ings: RecipeIngredient[] = draft.ings
      .filter((g) => g.name.trim() && parseFloat(g.amt.replace(',', '.')) > 0)
      .map((g) => ({ name: g.name.trim(), amt: parseFloat(g.amt.replace(',', '.')), unit: g.unit }));
    if (!name) return void addToast({ type: 'warning', title: 'Yemek adı gerekli', message: 'Reçeteye bir ad verin.' });
    if (!ings.length) return void addToast({ type: 'warning', title: 'Malzeme gerekli', message: 'En az bir malzeme ve miktar girin.' });

    const saved = saveRecipe({ id: draft.id, name, cat: draft.cat.trim() || 'Diğer', ings });
    // Yeni reçete: adı birebir tutan, henüz reçetesiz yemekleri otomatik bağla.
    if (!draft.id) {
      let n = 0;
      foodItems.forEach((item) => {
        if (!item.recipeId && normalizeName(item.name) === normalizeName(name)) {
          linkRecipe(item.id, saved.id);
          n += 1;
        }
      });
      if (n) addToast({ type: 'success', title: 'Havuzla eşleşti', message: `${n} yemek bu reçeteye otomatik bağlandı.` });
    }
    setDraft(null);
  };

  const remove = (r: LinkedRecipe) => {
    if (window.confirm(`"${r.name}" reçetesi silinsin mi? Bağlı yemeklerden ve mutfak günlerinden de çıkarılır.`)) deleteRecipe(r.id);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Reçete ara…" className={cn(field, 'pl-9')} />
        </div>
        <button type="button" onClick={() => setDraft(blankDraft())} className="px-4 min-h-[3rem] flex items-center gap-1.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold active:bg-emerald-500">
          <Plus className="w-4 h-4" /> Yeni
        </button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {categories.map((c) => (
          <button key={c} type="button" onClick={() => setCategory(c)} aria-pressed={category === c}
            className={cn('shrink-0 px-3 min-h-[2.5rem] rounded-full text-xs font-medium border', category === c ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-white/10 text-white/60 bg-white/5')}>
            {c}
          </button>
        ))}
      </div>

      {list.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-sm text-white/40">
          Henüz reçete yok. "Yeni" ile ekleyin ya da Ayarlar'dan eski Mutfaktakip verisini alın.
        </div>
      )}

      <ul className="space-y-2.5">
        {shown.map((r) => (
          <li key={r.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white">{r.name}</p>
                <p className="text-[11px] text-white/40">
                  {r.cat ?? 'Diğer'} · 1 porsiyon{linkedCount(r.id) > 0 ? ` · ${linkedCount(r.id)} yemeğe bağlı` : ''}
                </p>
              </div>
              <button type="button" onClick={() => setDraft(fromRecipe(r))} aria-label={`${r.name} düzenle`} className="w-10 h-10 flex items-center justify-center rounded-lg text-white/60 active:bg-white/10"><Pencil className="w-4 h-4" /></button>
              <button type="button" onClick={() => remove(r)} aria-label={`${r.name} sil`} className="w-10 h-10 flex items-center justify-center rounded-lg text-red-400/70 active:bg-red-500/10"><Trash2 className="w-4 h-4" /></button>
            </div>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {r.ings.map((i, k) => (
                <li key={k} className="text-xs bg-white/5 rounded-full px-2.5 py-1 text-white/75">{i.name} <b className="text-white">{i.amt} {i.unit}</b></li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      <BottomSheet
        open={!!draft}
        onClose={() => setDraft(null)}
        full
        title={draft?.id ? 'Reçeteyi düzenle' : 'Yeni reçete'}
        subtitle="Malzemeler 1 kişilik miktar"
        footer={<button type="button" onClick={save} className="w-full min-h-[3rem] rounded-xl bg-indigo-600 text-white font-semibold active:bg-indigo-500">{draft?.id ? 'Değişiklikleri kaydet' : 'Reçeteyi kaydet'}</button>}
      >
        {draft && (
          <div className="space-y-3">
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Yemek adı" className={field} />
            <input list="recipe-cats" value={draft.cat} onChange={(e) => setDraft({ ...draft, cat: e.target.value })} placeholder="Kategori" className={field} />
            <datalist id="recipe-cats">{RECIPE_CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>

            <p className="text-xs font-semibold text-white/50 pt-1">Malzeme · 1 kişilik miktar</p>
            <div className="space-y-2">
              {draft.ings.map((g, i) => (
                <div key={i} className="grid grid-cols-[minmax(0,1fr)_5rem_4.5rem_2.5rem] gap-1.5 items-center">
                  <input value={g.name} onChange={(e) => setIng(i, { name: e.target.value })} placeholder="Malzeme" className={field} />
                  <input value={g.amt} onChange={(e) => setIng(i, { amt: e.target.value })} inputMode="decimal" placeholder="Miktar" className={field} />
                  <select value={g.unit} onChange={(e) => setIng(i, { unit: e.target.value })} className={field}>
                    {RECIPE_UNITS.map((u) => <option key={u}>{u}</option>)}
                  </select>
                  <button type="button" aria-label="Malzemeyi sil"
                    onClick={() => setDraft({ ...draft, ings: draft.ings.length > 1 ? draft.ings.filter((_, k) => k !== i) : [{ name: '', amt: '', unit: 'g' }] })}
                    className="w-10 h-11 flex items-center justify-center text-red-400/70"><X className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setDraft({ ...draft, ings: [...draft.ings, { name: '', amt: '', unit: 'g' }] })} className="min-h-[2.75rem] text-sm font-medium text-emerald-300">+ Malzeme ekle</button>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
