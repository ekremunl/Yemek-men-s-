// src/components/planner/MenuPlanner.tsx
'use client';
import { useState } from 'react';
import { AlertTriangle, Download, LayoutGrid, List, Lock, Sparkles, X } from 'lucide-react';
import { useAppStore } from '@/context/store';
import CalendarView from './CalendarView';
import ListView from './ListView';
import RepeatSummary from './RepeatSummary';
import ExportPanel from '@/components/export/ExportPanel';
import BottomSheet from '@/components/ui/BottomSheet';
import { cn, getMonthMenus, MONTH_NAMES_TR } from '@/lib/utils';

type ViewMode = 'calendar' | 'list';

export default function MenuPlanner() {
  const [view, setView] = useState<ViewMode>('calendar');
  const [exportOpen, setExportOpen] = useState(false);
  const {
    currentYear, currentMonth, menus, generateBalancedMonthMenus, generationError, clearGenerationError,
    lockedDates, setActiveTab,
  } = useAppStore((state) => ({
    currentYear: state.currentYear,
    currentMonth: state.currentMonth,
    menus: state.menus,
    generateBalancedMonthMenus: state.generateBalancedMonthMenus,
    generationError: state.generationError,
    clearGenerationError: state.clearGenerationError,
    lockedDates: state.lockedDates,
    setActiveTab: state.setActiveTab,
  }));

  const existingMenus = getMonthMenus(menus, currentYear, currentMonth);
  const selectedMonthLabel = `${MONTH_NAMES_TR[currentMonth]} ${currentYear}`;
  const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
  const lockedInMonth = lockedDates.filter((d) => d.startsWith(monthPrefix)).length;

  const handleAutoGenerate = () => {
    if (
      existingMenus.length > 0 &&
      !window.confirm(
        `${selectedMonthLabel} için mevcut planlar yenilensin mi? Kilitli günler (${lockedInMonth}) korunur, diğerleri yeniden oluşturulur.`
      )
    ) {
      return;
    }

    generateBalancedMonthMenus(currentYear, currentMonth);
  };

  const unlockMonth = () => {
    const state = useAppStore.getState();
    useAppStore.setState({ lockedDates: state.lockedDates.filter((d) => !d.startsWith(monthPrefix)) });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Aylık Menü Planlayıcı</h2>
          <p className="text-sm text-white/50 mt-1 hidden sm:block">
            Günlere dokunarak öğle, akşam ve ara öğün planlarını oluşturun
          </p>
        </div>
        <div className="flex items-stretch gap-2">
          <button
            onClick={handleAutoGenerate}
            className="flex-1 lg:flex-none inline-flex items-center justify-center gap-2 px-4 min-h-[3rem] rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-emerald-900/20"
          >
            <Sparkles className="w-4 h-4 shrink-0" />
            <span className="truncate">{MONTH_NAMES_TR[currentMonth]} Menüsünü Oluştur</span>
          </button>
          <button
            type="button"
            onClick={() => setExportOpen(true)}
            aria-label="Dışa aktar"
            title="PDF / Excel"
            className="w-12 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white/70 active:bg-white/15"
          >
            <Download className="w-4 h-4" />
          </button>
          <div className="flex items-center bg-white/5 rounded-xl p-1 border border-white/10">
            {(
              [
                ['calendar', LayoutGrid, 'Takvim'],
                ['list', List, 'Liste'],
              ] as const
            ).map(([key, Icon, label]) => (
              <button
                key={key}
                onClick={() => setView(key)}
                aria-label={label}
                aria-pressed={view === key}
                className={cn(
                  'flex items-center gap-1.5 px-3 min-h-[2.75rem] rounded-lg text-sm font-medium transition-colors',
                  view === key ? 'bg-indigo-600 text-white' : 'text-white/50 hover:text-white'
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {generationError && (
        <div role="alert" className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-red-200">{generationError.title}</p>
              <p className="text-xs text-red-100/80 mt-1 leading-relaxed break-words">{generationError.message}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('pool')}
                  className="px-3 min-h-[2.5rem] rounded-lg bg-white/10 text-xs font-medium text-white active:bg-white/20"
                >
                  Havuza git
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('settings')}
                  className="px-3 min-h-[2.5rem] rounded-lg bg-white/10 text-xs font-medium text-white active:bg-white/20"
                >
                  Kural ayarları
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={clearGenerationError}
              aria-label="Uyarıyı kapat"
              className="w-10 h-10 -m-2 flex items-center justify-center text-white/50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {lockedInMonth > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-200/90">
          <Lock className="w-3.5 h-3.5 shrink-0" />
          <span className="flex-1">{lockedInMonth} gün kilitli: yeniden üretimde değişmez.</span>
          <button type="button" onClick={unlockMonth} className="min-h-[2.25rem] px-2 underline underline-offset-2">
            Kilitleri kaldır
          </button>
        </div>
      )}

      {view === 'calendar' ? <CalendarView /> : <ListView />}

      <RepeatSummary />

      <BottomSheet open={exportOpen} onClose={() => setExportOpen(false)} full maxWidthClass="md:max-w-3xl">
        <ExportPanel />
      </BottomSheet>
    </div>
  );
}
