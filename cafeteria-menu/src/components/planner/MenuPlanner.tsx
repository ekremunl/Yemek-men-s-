// src/components/planner/MenuPlanner.tsx
'use client';
import { useState } from 'react';
import { LayoutGrid, List, Sparkles } from 'lucide-react';
import { useAppStore } from '@/context/store';
import CalendarView from './CalendarView';
import ListView from './ListView';
import { cn, getMonthMenus, MONTH_NAMES_TR } from '@/lib/utils';

type ViewMode = 'calendar' | 'list';

export default function MenuPlanner() {
  const [view, setView] = useState<ViewMode>('calendar');
  const { currentYear, currentMonth, menus, generateBalancedMonthMenus } = useAppStore((state) => ({
    currentYear: state.currentYear,
    currentMonth: state.currentMonth,
    menus: state.menus,
    generateBalancedMonthMenus: state.generateBalancedMonthMenus,
  }));

  const existingMenus = getMonthMenus(menus, currentYear, currentMonth);
  const selectedMonthLabel = `${MONTH_NAMES_TR[currentMonth]} ${currentYear}`;

  const handleAutoGenerate = () => {
    if (
      existingMenus.length > 0 &&
      !window.confirm(
        `${selectedMonthLabel} için mevcut planlar yenilensin mi? Bu işlem yalnızca seçili aya ait menüleri yeniden oluşturur.`
      )
    ) {
      return;
    }

    generateBalancedMonthMenus(currentYear, currentMonth);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Aylık Menü Planlayıcı</h2>
          <p className="text-sm text-white/50 mt-1">
            Günlere tıklayarak öğle, akşam ve ara öğün planlarını oluşturun
          </p>
          <p className="text-xs text-emerald-300/80 mt-2">
            Seçili ay: <span className="font-semibold text-emerald-200">{selectedMonthLabel}</span>
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            onClick={handleAutoGenerate}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-emerald-900/20"
          >
            <Sparkles className="w-4 h-4" />
            <span>{selectedMonthLabel} Menüsünü Oluştur</span>
          </button>
          <div className="flex items-center bg-white/5 rounded-xl p-1 border border-white/10">
            <button
              onClick={() => setView('calendar')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                view === 'calendar' ? 'bg-indigo-600 text-white' : 'text-white/50 hover:text-white'
              )}
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">Takvim</span>
            </button>
            <button
              onClick={() => setView('list')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                view === 'list' ? 'bg-indigo-600 text-white' : 'text-white/50 hover:text-white'
              )}
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:inline">Liste</span>
            </button>
          </div>
        </div>
      </div>

      {view === 'calendar' ? <CalendarView /> : <ListView />}
    </div>
  );
}
