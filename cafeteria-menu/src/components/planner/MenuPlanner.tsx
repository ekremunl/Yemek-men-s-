// src/components/planner/MenuPlanner.tsx
'use client';
import { useState } from 'react';
import { LayoutGrid, List } from 'lucide-react';
import CalendarView from './CalendarView';
import ListView from './ListView';
import { cn } from '@/lib/utils';

type ViewMode = 'calendar' | 'list';

export default function MenuPlanner() {
  const [view, setView] = useState<ViewMode>('calendar');

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Aylık Menü Planlayıcı</h2>
          <p className="text-sm text-white/50 mt-1">Günlere tıklayarak menü oluşturun</p>
        </div>
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

      {view === 'calendar' ? <CalendarView /> : <ListView />}
    </div>
  );
}
