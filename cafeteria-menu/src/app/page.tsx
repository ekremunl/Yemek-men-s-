// src/app/page.tsx
'use client';
import { useAppStore } from '@/context/store';
import Sidebar from '@/components/ui/Sidebar';
import ToastContainer from '@/components/ui/ToastContainer';
import MenuPlanner from '@/components/planner/MenuPlanner';
import PoolManager from '@/components/pool/PoolManager';
import ExportPanel from '@/components/export/ExportPanel';

export default function Home() {
  const activeTab = useAppStore((s) => s.activeTab);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col lg:flex-row">
      {/* Sidebar - mobile top, desktop left */}
      <div className="lg:relative lg:min-h-screen border-b lg:border-b-0 lg:border-r border-white/5 bg-slate-900/50">
        <Sidebar />
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          {activeTab === 'planner' && <MenuPlanner />}
          {activeTab === 'pool' && <PoolManager />}
          {activeTab === 'export' && <ExportPanel />}
        </div>
      </main>

      <ToastContainer />
    </div>
  );
}
