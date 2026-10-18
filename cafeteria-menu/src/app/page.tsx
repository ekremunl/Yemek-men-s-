// src/app/page.tsx
'use client';
import { useAppStore } from '@/context/store';
import Sidebar from '@/components/ui/Sidebar';
import BottomNav from '@/components/ui/BottomNav';
import ToastContainer from '@/components/ui/ToastContainer';
import MenuPlanner from '@/components/planner/MenuPlanner';
import PoolManager from '@/components/pool/PoolManager';
import ExportPanel from '@/components/export/ExportPanel';
import IngredientsPanel from '@/components/ingredients/IngredientsPanel';
import SettingsPanel from '@/components/settings/SettingsPanel';

export default function Home() {
  const activeTab = useAppStore((s) => s.activeTab);

  return (
    <div className="min-h-dvh bg-slate-950 flex flex-col lg:flex-row">
      {/* Masaüstü: sol kenar çubuğu. Mobil: alt sekme çubuğu (BottomNav). */}
      <div className="hidden lg:block lg:relative lg:min-h-screen lg:border-r border-white/5 bg-slate-900/50">
        <Sidebar />
      </div>

      <main className="flex-1 min-w-0">
        <div className="max-w-5xl mx-auto px-3 sm:px-6 pt-safe py-4 sm:py-8 pb-28 lg:pb-8">
          {activeTab === 'planner' && <MenuPlanner />}
          {activeTab === 'pool' && <PoolManager />}
          {activeTab === 'ingredients' && <IngredientsPanel />}
          {activeTab === 'export' && <ExportPanel />}
          {activeTab === 'settings' && <SettingsPanel />}
        </div>
      </main>

      <BottomNav />
      <ToastContainer />
    </div>
  );
}
