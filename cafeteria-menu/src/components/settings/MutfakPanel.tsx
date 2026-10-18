// src/components/settings/MutfakPanel.tsx
'use client';
import { useMemo, useRef, useState } from 'react';
import { BookOpen, Download, Link2, RefreshCw, Upload, Send } from 'lucide-react';
import { useAppStore } from '@/context/store';
import { addDays, getTodayDateKey } from '@/lib/utils';
import {
  buildMutfakBackup,
  matchRecipes,
  mergeMenusIntoMutfak,
  parseMutfakBackup,
  readLiveMutfak,
  writeLiveMutfakDays,
  type MutfakData,
} from '@/lib/mutfak';
import ItemPicker from '@/components/ui/ItemPicker';
import type { CategoryKey, FoodItem } from '@/types';

/** Mutfaktakip ile iki yönlü bağlantı: reçeteleri al, yemekleri eşleştir, menüyü Mutfaktakip günlerine gönder. */
export default function MutfakPanel() {
  const { foodItems, menus, recipes, persons, setRecipes, linkRecipe, addToast } = useAppStore((s) => ({
    foodItems: s.foodItems,
    menus: s.menus,
    recipes: s.recipes,
    persons: s.persons,
    setRecipes: s.setRecipes,
    linkRecipe: s.linkRecipe,
    addToast: s.addToast,
  }));

  const fileRef = useRef<HTMLInputElement>(null);
  const sendFileRef = useRef<HTMLInputElement>(null);
  const [from, setFrom] = useState(getTodayDateKey());
  const [to, setTo] = useState(addDays(getTodayDateKey(), 6));
  const [showUnlinked, setShowUnlinked] = useState(false);

  const recipeList = useMemo(() => Object.values(recipes), [recipes]);
  const linkable = useMemo(() => foodItems, [foodItems]);
  const linkedCount = linkable.filter((i) => i.recipeId && recipes[i.recipeId]).length;
  const unlinkedItems = useMemo(() => linkable.filter((i) => !i.recipeId || !recipes[i.recipeId]), [linkable, recipes]);
  const matches = useMemo(() => new Map(matchRecipes(unlinkedItems, recipeList).map((m) => [m.itemId, m])), [unlinkedItems, recipeList]);
  const pickerItems = useMemo<FoodItem[]>(
    () => recipeList.map((r) => ({ id: r.id, name: r.name, category: 'mainCourses' as CategoryKey })).sort((a, b) => a.name.localeCompare(b.name, 'tr')),
    [recipeList]
  );

  const importData = (data: MutfakData, source: string) => {
    const record = Object.fromEntries(data.recipes.map((r) => [r.id, r]));
    setRecipes(record);
    // Adı birebir eşleşen ve henüz bağlı olmayan yemekleri otomatik bağla.
    let auto = 0;
    matchRecipes(useAppStore.getState().foodItems.filter((i) => !i.recipeId || !record[i.recipeId]), data.recipes).forEach((m) => {
      if (m.exact) {
        linkRecipe(m.itemId, m.exact.id);
        auto += 1;
      }
    });
    addToast({ type: 'success', title: 'Reçeteler alındı', message: `${data.recipes.length} reçete (${source}); ${auto} yemek adından otomatik eşleşti.` });
  };

  const importLive = () => {
    const live = readLiveMutfak();
    if (!live) {
      addToast({
        type: 'warning',
        title: 'Mutfaktakip bulunamadı',
        message: 'Bu tarayıcıda Mutfaktakip verisi yok (farklı alan adı olabilir). Yedek dosyasıyla içe aktarın.',
      });
      return;
    }
    importData(live, 'bu tarayıcıdan');
  };

  const importFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      importData(parseMutfakBackup(await file.text()), 'dosyadan');
    } catch (error) {
      addToast({ type: 'error', title: 'İçe aktarılamadı', message: error instanceof Error ? error.message : 'Geçersiz dosya.' });
    }
  };

  const summarize = (result: ReturnType<typeof mergeMenusIntoMutfak>) =>
    `${result.touchedDays} gün yazıldı` +
    (result.skippedMeals ? `, ${result.skippedMeals} kesinleşmiş öğün atlandı` : '') +
    (result.unlinked.length ? `. Reçetesiz ${result.unlinked.length} yemek aktarılamadı.` : '.');

  const sendLive = () => {
    const live = readLiveMutfak();
    if (!live) {
      addToast({ type: 'warning', title: 'Mutfaktakip bulunamadı', message: 'Doğrudan gönderim için aynı tarayıcıda Mutfaktakip açılmış olmalı. Dosya yöntemini kullanın.' });
      return;
    }
    const ids = new Set(live.recipes.map((r) => r.id));
    const result = mergeMenusIntoMutfak(live.days, menus, foodItems, ids, persons, from, to);
    if (result.touchedDays === 0) {
      addToast({ type: 'info', title: 'Aktarılacak bir şey yok', message: 'Aralıkta reçetesi bağlı yemek içeren gün bulunamadı.' });
      return;
    }
    if (!window.confirm(`${from} – ${to} arasındaki ${result.touchedDays} günün öğünleri Mutfaktakip'e yazılacak (mevcut günler birleştirilir, kesinleşmiş raporlara dokunulmaz). Devam?`)) return;
    writeLiveMutfakDays(result.days);
    addToast({ type: 'success', title: "Mutfaktakip'e gönderildi", message: summarize(result) });
  };

  const sendViaFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const data = parseMutfakBackup(await file.text());
      const ids = new Set(data.recipes.map((r) => r.id));
      const result = mergeMenusIntoMutfak(data.days, menus, foodItems, ids, persons, from, to);
      const blob = new Blob([buildMutfakBackup(data.recipes, result.days)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mutfak-yedek-${getTodayDateKey()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      addToast({ type: 'success', title: 'Güncel yedek hazır', message: `${summarize(result)} Dosyayı Mutfaktakip'te "Yedek Yükle" ile açın.` });
    } catch (error) {
      addToast({ type: 'error', title: 'İşlem başarısız', message: error instanceof Error ? error.message : 'Geçersiz dosya.' });
    }
  };

  const btn = 'min-h-[3rem] flex items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium active:opacity-80 transition-colors';

  return (
    <section className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-5">
      <div className="flex items-center gap-2">
        <BookOpen className="w-5 h-5 text-emerald-400" />
        <h3 className="text-base font-semibold text-white">Mutfaktakip Bağlantısı</h3>
      </div>
      <p className="text-sm text-white/50 leading-relaxed">
        Mutfaktakip'teki reçeteleri alır, menüdeki yemeklerle eşleştirir; malzeme listesi bu reçetelerden hesaplanır. İsterseniz planlanan menüyü
        Mutfaktakip'in günlük menü ekranına da gönderebilirsiniz.
      </p>

      {/* 1. Reçeteleri al */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-white/60">1 · Reçeteleri al</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button type="button" onClick={importLive} className={`${btn} bg-emerald-600 text-white`}>
            <RefreshCw className="w-4 h-4" /> Bu tarayıcıdan al / güncelle
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} className={`${btn} bg-white/5 border border-white/10 text-white/80`}>
            <Upload className="w-4 h-4" /> Yedek dosyasından al
          </button>
        </div>
        <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={importFile} />
        <p className="text-[11px] text-white/35">
          {recipeList.length > 0 ? `${recipeList.length} reçete kayıtlı · ${linkedCount}/${linkable.length} yemek bağlı` : 'Henüz reçete alınmadı.'}
        </p>
      </div>

      {/* 2. Eşleştirme */}
      {recipeList.length > 0 && unlinkedItems.length > 0 && (
        <div className="space-y-2">
          <button type="button" onClick={() => setShowUnlinked((v) => !v)} aria-expanded={showUnlinked} className="w-full flex items-center justify-between min-h-[2.75rem] text-xs font-semibold text-white/60">
            <span className="flex items-center gap-1.5"><Link2 className="w-3.5 h-3.5" /> 2 · Eşleşmeyen yemekler ({unlinkedItems.length})</span>
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
                    <ItemPicker
                      items={pickerItems}
                      value={null}
                      onChange={(id) => id && linkRecipe(item.id, id)}
                      title={`"${item.name}" için reçete seç`}
                      placeholder="Başka reçete seç…"
                      suggestedIds={match?.suggestions.map((r) => r.id)}
                      suggestedLabel="benzer"
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* 3. Menüyü gönder */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-white/60">3 · Menüyü Mutfaktakip'e gönder</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-white/50 space-y-1">
            Başlangıç
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-3 text-white" />
          </label>
          <label className="text-xs text-white/50 space-y-1">
            Bitiş
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-3 text-white" />
          </label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button type="button" onClick={sendLive} disabled={recipeList.length === 0} className={`${btn} bg-indigo-600 text-white disabled:opacity-30`}>
            <Send className="w-4 h-4" /> Doğrudan gönder
          </button>
          <button type="button" onClick={() => sendFileRef.current?.click()} disabled={recipeList.length === 0} className={`${btn} bg-white/5 border border-white/10 text-white/80 disabled:opacity-30`}>
            <Download className="w-4 h-4" /> Dosya ile (yedek güncelle)
          </button>
        </div>
        <input ref={sendFileRef} type="file" accept=".json,application/json" className="hidden" onChange={sendViaFile} />
        <p className="text-[11px] text-white/35 leading-relaxed">
          Öğle → "Öğle Yemeği", akşam → "Akşam Yemeği", ara öğün → "Ara Öğün". Kişi sayıları yeni günlerde Ayarlar'daki sayılardan ({persons.lunch}/{persons.dinner}) alınır.
          "Doğrudan" yöntem iki uygulama aynı alan adındaysa çalışır; aksi halde Mutfaktakip yedeğinizi seçin, güncellenmiş yedeği indirip orada "Yedek Yükle" yapın.
        </p>
      </div>
    </section>
  );
}
