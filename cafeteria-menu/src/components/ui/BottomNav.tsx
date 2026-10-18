// src/components/ui/BottomNav.tsx
'use client';
import { useAppStore } from '@/context/store';
import { cn } from '@/lib/utils';
import { TABS } from './tabs';

/** Mobil alt sekme çubuğu: başparmakla ulaşılır, çentik/ana çubuk alanını (safe-area) dikkate alır. */
export default function BottomNav() {
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);

  return (
    <nav
      aria-label="Ana gezinme"
      className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-slate-900/95 backdrop-blur pb-safe print:hidden"
    >
      <ul className="grid grid-cols-5">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <li key={tab.id}>
              <button
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  window.scrollTo({ top: 0 });
                }}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'w-full min-h-[3.5rem] flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors',
                  isActive ? 'text-indigo-300' : 'text-white/45 active:text-white'
                )}
              >
                <Icon className={cn('w-5 h-5', isActive && 'text-indigo-400')} />
                <span>{tab.labelShort}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
