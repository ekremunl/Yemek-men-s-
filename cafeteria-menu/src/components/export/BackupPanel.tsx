// src/components/export/BackupPanel.tsx
'use client';
import { useRef, useState } from 'react';
import { DatabaseBackup, Download, Upload, Share2 } from 'lucide-react';
import { useAppStore } from '@/context/store';
import { DailyMenu, FoodItem, KitchenDay, LinkedRecipe, OrderItem, PersonCounts, PlanSettings } from '@/types';

const BACKUP_APP = 'yemekhane-menu-planlayici';
const BACKUP_FORMAT = 1;

interface BackupFile {
  app: typeof BACKUP_APP;
  format: number;
  exportedAt: string;
  data: {
    foodItems: FoodItem[];
    menus: DailyMenu[];
    currentYear: number;
    currentMonth: number;
    // Sonradan eklenen alanlar (eski yedeklerde yok).
    recipes?: Record<string, LinkedRecipe>;
    lockedDates?: string[];
    planSettings?: PlanSettings;
    persons?: PersonCounts;
    kitchenDays?: Record<string, KitchenDay>;
    orderItems?: OrderItem[];
    orderPool?: string[];
  };
}

type ImportMode = 'replace' | 'merge';

function isValidBackup(value: unknown): value is BackupFile {
  if (!value || typeof value !== 'object') return false;
  const b = value as Partial<BackupFile>;
  return (
    b.app === BACKUP_APP &&
    typeof b.format === 'number' &&
    !!b.data &&
    Array.isArray(b.data.foodItems) &&
    Array.isArray(b.data.menus) &&
    typeof b.data.currentYear === 'number' &&
    typeof b.data.currentMonth === 'number'
  );
}

function buildFileName(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `yemek-menusu-yedek-${stamp}.json`;
}

export default function BackupPanel() {
  const addToast = useAppStore((s) => s.addToast);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<ImportMode>('replace');
  const [pending, setPending] = useState<BackupFile | null>(null);

  const canShare =
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    typeof File !== 'undefined';

  const createBackupFile = (): File => {
    const { foodItems, menus, currentYear, currentMonth, recipes, lockedDates, planSettings, persons, kitchenDays, orderItems, orderPool } = useAppStore.getState();
    const backup: BackupFile = {
      app: BACKUP_APP,
      format: BACKUP_FORMAT,
      exportedAt: new Date().toISOString(),
      data: { foodItems, menus, currentYear, currentMonth, recipes, lockedDates, planSettings, persons, kitchenDays, orderItems, orderPool },
    };
    return new File([JSON.stringify(backup, null, 2)], buildFileName(), { type: 'application/json' });
  };

  const handleDownload = () => {
    const file = createBackupFile();
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    addToast({ type: 'success', title: 'Yedek indirildi', message: file.name });
  };

  const handleShare = async () => {
    const file = createBackupFile();
    try {
      if (!navigator.canShare({ files: [file] })) {
        handleDownload();
        return;
      }
      await navigator.share({ files: [file], title: 'Yemek menüsü yedeği' });
    } catch (error) {
      // Kullanıcı paylaşımı iptal ettiyse sessizce geç
      if ((error as Error)?.name !== 'AbortError') {
        addToast({ type: 'error', title: 'Paylaşılamadı', message: 'Bunun yerine "Yedeği İndir" düğmesini kullanın.' });
      }
    }
  };

  const handleFileChosen = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // aynı dosya tekrar seçilebilsin
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!isValidBackup(parsed)) throw new Error('invalid');
      setPending(parsed);
    } catch {
      setPending(null);
      addToast({ type: 'error', title: 'Geçersiz yedek', message: 'Seçilen dosya bu uygulamanın yedeği değil.' });
    }
  };

  const applyImport = () => {
    if (!pending) return;
    const incoming = pending.data;
    const current = useAppStore.getState();

    if (mode === 'replace') {
      useAppStore.setState({
        foodItems: incoming.foodItems,
        menus: incoming.menus,
        currentYear: incoming.currentYear,
        currentMonth: incoming.currentMonth,
        ...(incoming.recipes ? { recipes: incoming.recipes } : {}),
        ...(incoming.lockedDates ? { lockedDates: incoming.lockedDates } : {}),
        ...(incoming.planSettings ? { planSettings: incoming.planSettings } : {}),
        ...(incoming.persons ? { persons: incoming.persons } : {}),
        ...(incoming.kitchenDays ? { kitchenDays: incoming.kitchenDays } : {}),
        ...(incoming.orderItems ? { orderItems: incoming.orderItems } : {}),
        ...(incoming.orderPool ? { orderPool: incoming.orderPool } : {}),
      });
    } else {
      // Birleştir: yemek havuzu kimliğe göre birleşir, aynı tarihte yedektekiler öncelikli olur.
      const knownIds = new Set(current.foodItems.map((i) => i.id));
      const mergedItems = [...current.foodItems, ...incoming.foodItems.filter((i) => !knownIds.has(i.id))];
      const byDate = new Map<string, DailyMenu>(current.menus.map((m) => [m.date, m]));
      incoming.menus.forEach((m) => byDate.set(m.date, m));
      useAppStore.setState({
        foodItems: mergedItems,
        menus: Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date)),
        recipes: { ...current.recipes, ...(incoming.recipes ?? {}) },
        lockedDates: Array.from(new Set([...current.lockedDates, ...(incoming.lockedDates ?? [])])).sort(),
        kitchenDays: { ...current.kitchenDays, ...(incoming.kitchenDays ?? {}) },
        orderPool: Array.from(new Set([...current.orderPool, ...(incoming.orderPool ?? [])])).sort((a, b) => a.localeCompare(b, 'tr')),
      });
    }

    setPending(null);
    addToast({
      type: 'success',
      title: 'Yedek yüklendi',
      message: mode === 'replace' ? 'Bu cihazdaki veriler yedekle değiştirildi.' : 'Yedek mevcut verilerle birleştirildi.',
    });
  };

  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <DatabaseBackup className="w-5 h-5 text-indigo-400" />
        <h3 className="text-base font-semibold text-white">Yedekle / Geri Yükle</h3>
      </div>
      <p className="text-sm text-white/50">
        Veriler yalnızca bu cihazın tarayıcısında saklanır. Telefon ve bilgisayar arasında taşımak için bir cihazda
        yedek alın, dosyayı diğerine gönderip orada yükleyin.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={handleDownload}
          className="flex items-center justify-center gap-2 min-h-[3rem] px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors"
        >
          <Download className="w-5 h-5" />
          Yedeği İndir
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center justify-center gap-2 min-h-[3rem] px-4 rounded-xl bg-slate-600 hover:bg-slate-500 text-white font-semibold transition-colors"
        >
          <Upload className="w-5 h-5" />
          Yedeği Yükle
        </button>
      </div>

      {canShare && (
        <button
          onClick={handleShare}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 font-medium transition-colors"
        >
          <Share2 className="w-5 h-5" />
          Yedeği Paylaş (WhatsApp, Drive, e-posta…)
        </button>
      )}

      <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleFileChosen} />

      {pending && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 space-y-3">
          <div className="text-sm text-white/80">
            <div className="font-semibold text-amber-300">Yedek dosyası hazır</div>
            <div className="text-white/60 mt-1">
              Tarih: {new Date(pending.exportedAt).toLocaleString('tr-TR')} · {pending.data.menus.length} günlük menü ·{' '}
              {pending.data.foodItems.length} yemek
            </div>
          </div>

          <div className="space-y-2 text-sm text-white/70">
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="radio" name="import-mode" checked={mode === 'replace'} onChange={() => setMode('replace')} className="mt-1" />
              <span>
                <b className="text-white">Değiştir:</b> bu cihazdaki tüm verilerin yerine yedeği koy
              </span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="radio" name="import-mode" checked={mode === 'merge'} onChange={() => setMode('merge')} className="mt-1" />
              <span>
                <b className="text-white">Birleştir:</b> iki tarafı da koru, aynı güne ait menüde yedek geçerli olsun
              </span>
            </label>
          </div>

          <div className="flex gap-2">
            <button onClick={applyImport} className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold transition-colors">
              Yüklemeyi Onayla
            </button>
            <button onClick={() => setPending(null)} className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 transition-colors">
              Vazgeç
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
