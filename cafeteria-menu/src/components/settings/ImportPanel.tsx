// src/components/settings/ImportPanel.tsx
'use client';
import { useMemo, useRef, useState } from 'react';
import { BookOpen, ClipboardList, Link2, RefreshCw, Upload } from 'lucide-react';
import { useAppStore } from '@/context/store';
import { normalizeKitchenDay } from '@/lib/kitchen';
import { matchRecipes, parseMutfakBackup, parseNameList, readLiveMutfak, readLiveOrderPool, type MutfakData } from '@/lib/mutfak';
import ItemPicker from '@/components/ui/ItemPicker';
import type { CategoryKey, FoodItem } from '@/types';

const btn = 'min-h-[3rem] flex items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium active:opacity-80 transition-colors';

/** Eski uygulamalardan (Mutfaktakip, sipariş) veri alma ve yemek ↔ reçete eşleştirme. */
export default function ImportPanel() {
  const { foodItems, recipes, persons, kitchenDays, setRecipes, setKitchenDays, linkRecipe, addToOrderPool, addToast } = useAppStore((s) => ({
    foodItems: s.foodItems, recipes: s.recipes, persons: s.persons, kitchenDays: s.kitchenDays,
    setRecipes: s.setRecipes, setKitchenDays: s.setKitchenDays, linkRecipe: s.linkRecipe,
    addToOrderPool: s.addToOrderPool, addToast: s.addToast,
  }));

  const fileRef = useRef<HTMLInputElement>(null);
  const [showUnlinked, setShowUnlinked] = useState(false);
  const [paste, setPaste] = useState('');

  const recipeList = useMemo(() => Object.values(recipes), [recipes]);
  const unlinkedItems = useMemo(() => foodItems.filter((i) => !i.recipeId || !recipes[i.recipeId]), [foodItems, recipes]);
  const linkedCount = foodItems.length - unlinkedItems.length;
  const matches = useMemo(() => new Map(matchRecipes(unlinkedItems, recipeList).map((m) => [m.itemId, m])), [unlinkedItems, recipeList]);
  const pickerItems = useMemo<FoodItem[]>(
    () => recipeList.map((r) => ({ id: r.id, name: r.name, category: 'mainCourses' as CategoryKey })).sort((a, b) => a.name.localeCompare(b.name, 'tr')),
    [recipeList]
  );

  const applyMutfak = (data: MutfakData, source: string) => {
    const dayCount = Object.keys(data.days).length;
    if (!window.confirm(`${data.recipes.length} reçete ve ${dayCount} günlük kayıt alınacak (${source}).\n\nAynı kimlikli reçeteler ve aynı tarihli günler dosyadakiyle DEĞİŞTİRİLİR; diğerleri korunur. Devam edilsin mi?`)) return;

    const mergedRecipes = { ...recipes, ...Object.fromEntries(data.recipes.map((r) => [r.id, r])) };
    setRecipes(mergedRecipes);
    setKitchenDays({
      ...kitchenDays,
      ...Object.fromEntries(Object.entries(data.days).map(([date, d]) => [date, normalizeKitchenDay(d as never, persons)])),
    });

    let auto = 0;
    matchRecipes(useAppStore.getState().foodItems.filter((i) => !i.recipeId || !mergedRecipes[i.recipeId]), data.recipes).forEach((m) => {
      if (m.exact) { linkRecipe(m.itemId, m.exact.id); auto += 1; }
    });
    addToast({ type: 'success', title: 'Mutfaktakip verisi alındı', message: `${data.recipes.length} reçete, ${dayCount} gün; ${auto} yemek adından otomatik eşleşti.` });
  };

  const importLive = () => {
    const live = readLiveMutfak();
    if (!live) return void addToast({ type: 'warning', title: 'Mutfaktakip bulunamadı', message: 'Bu tarayıcıda eski uygulamanın verisi yok (farklı alan adı olabilir). Yedek dosyasıyla alın.' });
    applyMutfak(live, 'bu tarayıcıdan');
  };

  const importFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try { applyMutfak(parseMutfakBackup(await file.text()), 'dosyadan'); }
    catch (error) { addToast({ type: 'error', title: 'İçe aktarılamadı', message: error instanceof Error ? error.message : 'Geçersiz dosya.' }); }
  };

  const importOrderLive = () => {
    const names = readLiveOrderPool();
    if (!names) return void addToast({ type: 'warning', title: 'Sipariş verisi bulunamadı', message: 'Bu tarayıcıda eski sipariş uygulamasının ürünleri yok. Adları aşağıya yapıştırın.' });
    addToOrderPool(names);
    addToast({ type: 'success', title: 'Ürünler alındı', message: `${names.length} ürün sipariş listesine eklendi.` });
  };

  const importPaste = () => {
    const names = parseNameList(paste);
    if (!names.length) return;
    addToOrderPool(names);
    setPaste('');
    addToast({ type: 'success', title: 'Ürünler eklendi', message: `${names.length} ürün kaydedildi.` });
  };

  return (
    <section className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-6">
      <div className="flex items-center gap-2">
        <BookOpen className="w-5 h-5 text-emerald-400" />
        <h3 className="text-base font-semibold text-white">Eski Uygulamalardan Veri Al</h3>
      </div>
      <p className="text-sm text-white/50 leading-relaxed">
        Mutfaktakip ve sipariş uygulamasındaki verilerinizi bir kez buraya alın; sonra artık bu uygulamayı kullanabilirsiniz.
        Eski uygulamalar <b>aynı alan adında</b> yayınlanıyorsa "bu tarayıcıdan al" çalışır; değilse eski uygulamada "Verileri Yedekle" ile dosya indirin.
      </p>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-white/60">Mutfaktakip: reçeteler ve günlük kayıtlar</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button type="button" onClick={importLive} className={`${btn} bg-emerald-600 text-white`}><RefreshCw className="w-4 h-4" /> Bu tarayıcıdan al</button>
          <button type="button" onClick={() => fileRef.current?.click()} className={`${btn} bg-white/5 border border-white/10 text-white/80`}><Upload className="w-4 h-4" /> Yedek dosyasından al</button>
        </div>
        <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={importFile} />
        <p className="text-[11px] text-white/35">{recipeList.length} reçete kayıtlı · {linkedCount}/{foodItems.length} yemek reçeteye bağlı</p>
      </div>

      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-white/60"><ClipboardList className="w-3.5 h-3.5" /> Sipariş: ürün listesi</p>
        <button type="button" onClick={importOrderLive} className={`${btn} w-full bg-white/5 border border-white/10 text-white/80`}><RefreshCw className="w-4 h-4" /> Bu tarayıcıdan al</button>
        <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={3} placeholder="Ya da ürün adlarını yapıştırın (her satıra bir ürün veya virgülle)"
          className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30" />
        <button type="button" onClick={importPaste} disabled={!paste.trim()} className={`${btn} w-full bg-white/5 border border-white/10 text-white/80 disabled:opacity-30`}>Ürünleri ekle</button>
      </div>

      {recipeList.length > 0 && unlinkedItems.length > 0 && (
        <div className="space-y-2">
          <button type="button" onClick={() => setShowUnlinked((v) => !v)} aria-expanded={showUnlinked} className="w-full flex items-center justify-between min-h-[2.75rem] text-xs font-semibold text-white/60">
            <span className="flex items-center gap-1.5"><Link2 className="w-3.5 h-3.5" /> Reçetesi bağlı olmayan yemekler ({unlinkedItems.length})</span>
            <span>{showUnlinked ? '−' : '+'}</span>
          </button>
          {showUnlinked && (
            <ul className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {unlinkedItems.map((item) => {
                const match = matches.get(item.id);
                const best = match?.suggestions[0];
                return (
                  <li key={item.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2">
                    <p className="text-sm text-white">{item.name}</p>
                    {best && (
                      <button type="button" onClick={() => linkRecipe(item.id, best.id)} className="w-full text-left min-h-[2.5rem] px-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-200 active:bg-emerald-500/20">
                        Öneri: <b>{best.name}</b> — bağla
                      </button>
                    )}
                    <ItemPicker items={pickerItems} value={null} onChange={(id) => id && linkRecipe(item.id, id)} title={`"${item.name}" için reçete seç`}
                      placeholder="Başka reçete seç…" suggestedIds={match?.suggestions.map((r) => r.id)} suggestedLabel="benzer" />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
