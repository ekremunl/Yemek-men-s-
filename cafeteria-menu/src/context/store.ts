// src/context/store.ts
'use client';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { FoodItem, DailyMenu, CategoryKey, ConflictWarning } from '@/types';
import { SEED_DATA } from '@/lib/seedData';
import { generateId, isSameWeek, parseDate } from '@/lib/utils';

interface Toast {
  id: string;
  type: 'warning' | 'error' | 'success' | 'info';
  title: string;
  message: string;
}

interface AppState {
  // Food pools
  foodItems: FoodItem[];
  addFoodItem: (name: string, category: CategoryKey) => void;
  removeFoodItem: (id: string) => void;

  // Monthly menus
  menus: DailyMenu[];
  setMenuDay: (date: string, field: keyof Omit<DailyMenu, 'date'>, itemId: string | null) => void;
  clearMenuDay: (date: string) => void;

  // Current month navigation
  currentYear: number;
  currentMonth: number;
  setCurrentMonth: (year: number, month: number) => void;

  // Conflict detection
  checkConflicts: (date: string, mainCourseId: string) => ConflictWarning[];

  // Toasts
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;

  // Active tab
  activeTab: 'planner' | 'pool' | 'export';
  setActiveTab: (tab: 'planner' | 'pool' | 'export') => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      foodItems: SEED_DATA,
      menus: [],
      currentYear: new Date().getFullYear(),
      currentMonth: new Date().getMonth(),
      toasts: [],
      activeTab: 'planner',

      addFoodItem: (name, category) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        // Prevent duplicate names in the same category
        const exists = get().foodItems.some(
          (f) => f.category === category && f.name.toLowerCase() === trimmed.toLowerCase()
        );
        if (exists) {
          get().addToast({ type: 'error', title: 'Zaten Mevcut', message: `"${trimmed}" bu kategoride zaten var.` });
          return;
        }
        set((state) => ({
          foodItems: [
            ...state.foodItems,
            { id: generateId(), name: trimmed, category },
          ],
        }));
        get().addToast({ type: 'success', title: 'Eklendi', message: `"${trimmed}" başarıyla eklendi.` });
      },

      removeFoodItem: (id) => {
        // Also clear from menus
        set((state) => ({
          foodItems: state.foodItems.filter((f) => f.id !== id),
          menus: state.menus.map((m) => ({
            ...m,
            soup: m.soup === id ? null : m.soup,
            mainCourse: m.mainCourse === id ? null : m.mainCourse,
            sideDish: m.sideDish === id ? null : m.sideDish,
            complement: m.complement === id ? null : m.complement,
          })),
        }));
      },

      setMenuDay: (date, field, itemId) => {
        set((state) => {
          const existing = state.menus.find((m) => m.date === date);
          if (existing) {
            return {
              menus: state.menus.map((m) =>
                m.date === date ? { ...m, [field]: itemId } : m
              ),
            };
          }
          const newMenu: DailyMenu = {
            date,
            soup: null,
            mainCourse: null,
            sideDish: null,
            complement: null,
            [field]: itemId,
          };
          return { menus: [...state.menus, newMenu] };
        });

        // Check conflicts for main course
        if (field === 'mainCourse' && itemId) {
          const conflicts = get().checkConflicts(date, itemId);
          if (conflicts.length > 0) {
            const c = conflicts[0];
            get().addToast({
              type: 'warning',
              title: `⚠️ Tekrar Uyarısı: ${c.conflictType === 'weekly' ? 'Aynı Hafta' : 'Aynı Ay'}`,
              message: `"${c.itemName}" bu ${c.conflictType === 'weekly' ? 'haftada' : 'ayda'} zaten planlandı: ${c.conflictDates.join(', ')}`,
            });
          }
        }
      },

      clearMenuDay: (date) => {
        set((state) => ({
          menus: state.menus.filter((m) => m.date !== date),
        }));
      },

      setCurrentMonth: (year, month) => set({ currentYear: year, currentMonth: month }),

      checkConflicts: (date, mainCourseId) => {
        const { menus, foodItems } = get();
        const item = foodItems.find((f) => f.id === mainCourseId);
        if (!item) return [];

        const conflicts: ConflictWarning[] = [];
        const targetDate = parseDate(date);
        const targetMonth = targetDate.getMonth();
        const targetYear = targetDate.getFullYear();

        const sameDayMenus = menus.filter((m) => m.date !== date && m.mainCourse === mainCourseId);

        const weeklyConflicts = sameDayMenus.filter((m) => isSameWeek(date, m.date));
        const monthlyConflicts = sameDayMenus.filter((m) => {
          const d = parseDate(m.date);
          return d.getMonth() === targetMonth && d.getFullYear() === targetYear;
        });

        if (weeklyConflicts.length > 0) {
          conflicts.push({
            itemId: mainCourseId,
            itemName: item.name,
            conflictType: 'weekly',
            conflictDates: weeklyConflicts.map((m) => m.date),
          });
        } else if (monthlyConflicts.length > 0) {
          conflicts.push({
            itemId: mainCourseId,
            itemName: item.name,
            conflictType: 'monthly',
            conflictDates: monthlyConflicts.map((m) => m.date),
          });
        }

        return conflicts;
      },

      addToast: (toast) => {
        const id = generateId();
        set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
        setTimeout(() => {
          get().removeToast(id);
        }, 5000);
      },

      removeToast: (id) => {
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
      },

      setActiveTab: (tab) => set({ activeTab: tab }),
    }),
    {
      name: 'cafeteria-menu-store',
      storage: createJSONStorage(() => (typeof window !== 'undefined' ? localStorage : { getItem: () => null, setItem: () => {}, removeItem: () => {} })),
      partialize: (state) => ({
        foodItems: state.foodItems,
        menus: state.menus,
        currentYear: state.currentYear,
        currentMonth: state.currentMonth,
      }),
    }
  )
);
