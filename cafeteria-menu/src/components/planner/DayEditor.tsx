// src/components/planner/DayEditor.tsx
'use client';
import { Soup, UtensilsCrossed, Salad, Apple, X, AlertTriangle, RotateCcw } from 'lucide-react';
import { useAppStore } from '@/context/store';
import { CategoryKey, DailyMenu } from '@/types';
import { CATEGORY_META } from '@/lib/seedData';
import { cn, parseDate, DAY_NAMES_TR_FULL, MONTH_NAMES_TR } from '@/lib/utils';

const CAT_ICONS: Record<CategoryKey, React.ReactNode> = {
  soups: <Soup className="w-4 h-4" />,
  mainCourses: <UtensilsCrossed className="w-4 h-4" />,
  sideDishes: <Salad className="w-4 h-4" />,
  complements: <Apple className="w-4 h-4" />,
};

const FIELD_MAP: Record<CategoryKey, keyof Omit<DailyMenu, 'date'>> = {
  soups: 'soup',
  mainCourses: 'mainCourse',
  sideDishes: 'sideDish',
  complements: 'complement',
};

const ACCENT_COLORS: Record<CategoryKey, string> = {
  soups: 'text-amber-400 border-amber-500/40',
  mainCourses: 'text-red-400 border-red-500/40',
  sideDishes: 'text-emerald-400 border-emerald-500/40',
  complements: 'text-blue-400 border-blue-500/40',
};

const SELECT_FOCUS: Record<CategoryKey, string> = {
  soups: 'focus:border-amber-500/60',
  mainCourses: 'focus:border-red-500/60',
  sideDishes: 'focus:border-emerald-500/60',
  complements: 'focus:border-blue-500/60',
};

interface Props {
  date: string;
  onClose: () => void;
}

export default function DayEditor({ date, onClose }: Props) {
  const { foodItems, menus, setMenuDay, clearMenuDay, checkConflicts } = useAppStore((s) => ({
    foodItems: s.foodItems,
    menus: s.menus,
    setMenuDay: s.setMenuDay,
    clearMenuDay: s.clearMenuDay,
    checkConflicts: s.checkConflicts,
  }));

  const menu = menus.find((m) => m.date === date);
  const d = parseDate(date);
  const dayName = DAY_NAMES_TR_FULL[(d.getDay() + 6) % 7];
  const dateLabel = `${d.getDate()} ${MONTH_NAMES_TR[d.getMonth()]} ${d.getFullYear()}`;

  const getSelected = (catKey: CategoryKey): string => {
    const field = FIELD_MAP[catKey];
    return (menu?.[field] as string) || '';
  };

  const handleChange = (catKey: CategoryKey, value: string) => {
    const field = FIELD_MAP[catKey];
    setMenuDay(date, field, value || null);
  };

  const mainCourseId = menu?.mainCourse || null;
  const conflicts = mainCourseId ? checkConflicts(date, mainCourseId) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <p className="text-xs text-white/50 uppercase tracking-widest font-medium">{dayName}</p>
            <h3 className="text-lg font-bold text-white mt-0.5">{dateLabel}</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => clearMenuDay(date)}
              title="Günü Temizle"
              className="p-2 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Selectors */}
        <div className="px-6 py-4 space-y-4">
          {CATEGORY_META.map((cat) => {
            const items = foodItems.filter((f) => f.category === cat.key);
            const selected = getSelected(cat.key);
            const isMainConflict = cat.key === 'mainCourses' && conflicts.length > 0;

            return (
              <div key={cat.key}>
                <label className={cn('flex items-center gap-2 text-xs font-semibold uppercase tracking-wider mb-1.5', ACCENT_COLORS[cat.key].split(' ')[0])}>
                  {CAT_ICONS[cat.key]}
                  {cat.labelTR}
                  {isMainConflict && (
                    <span className="ml-auto flex items-center gap-1 text-amber-400 text-xs font-medium normal-case">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Çakışma!
                    </span>
                  )}
                </label>
                <select
                  value={selected}
                  onChange={(e) => handleChange(cat.key, e.target.value)}
                  className={cn(
                    'w-full bg-slate-800 border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none transition-colors appearance-none cursor-pointer',
                    isMainConflict
                      ? 'border-amber-500/60 bg-amber-500/5'
                      : `border-white/10 ${SELECT_FOCUS[cat.key]}`
                  )}
                >
                  <option value="">— Seçiniz —</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>

                {isMainConflict && (
                  <div className="mt-1.5 flex items-start gap-1.5 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-300/80">
                      {conflicts[0].conflictType === 'weekly'
                        ? `Bu yemek aynı haftada planlandı: ${conflicts[0].conflictDates.join(', ')}`
                        : `Bu yemek bu ayda zaten var: ${conflicts[0].conflictDates.join(', ')}`}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors text-sm"
          >
            Kaydet & Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
