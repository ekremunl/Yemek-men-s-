// src/components/ui/Sidebar.tsx
'use client';
import { CalendarDays, Database, Download, ChefHat } from 'lucide-react';
import { useAppStore } from '@/context/store';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'planner' as const, label: 'Menü Planlayıcı', labelShort: 'Planlayıcı', icon: CalendarDays },
  { id: 'pool' as const, label: 'Ürün Havuzu', labelShort: 'Havuz', icon: Database },
  { id: 'export' as const, label: 'Dışa Aktar', labelShort: 'Aktar', icon: Download },
];

export default function Sidebar() {
  const { activeTab, setActiveTab } = useAppStore((s) => ({
    activeTab: s.activeTab,
    setActiveTab: s.setActiveTab,
  }));

  return (
    <aside className="w-full lg:w-64 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 mb-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
          <ChefHat className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="font-bold text-white text-sm leading-tight">Yemekhane</h1>
          <p className="text-xs text-white/40 leading-tight">Menü Planlayıcı</p>
        </div>
      </div>

      <nav className="space-y-1 px-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all font-medium text-sm',
                isActive
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom badge */}
      <div className="hidden lg:block mt-auto px-4 py-4 absolute bottom-0 w-64">
        <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
          <p className="text-xs text-white/30 leading-relaxed">
            Okul Yatakhanesi<br />
            <span className="text-white/50 font-medium">Yemek Listesi Yönetim Sistemi</span>
          </p>
        </div>
      </div>
    </aside>
  );
}
