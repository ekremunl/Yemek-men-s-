// src/components/ui/tabs.ts
import { CalendarDays, ChefHat, ClipboardList, Database, Settings } from 'lucide-react';
import type { ActiveTab } from '@/types';

export const TABS = [
  { id: 'planner' as ActiveTab, label: 'Menü Planlayıcı', labelShort: 'Plan', icon: CalendarDays },
  { id: 'pool' as ActiveTab, label: 'Ürün Havuzu', labelShort: 'Havuz', icon: Database },
  { id: 'kitchen' as ActiveTab, label: 'Mutfak (Günlük Rapor)', labelShort: 'Mutfak', icon: ChefHat },
  { id: 'order' as ActiveTab, label: 'Sipariş', labelShort: 'Sipariş', icon: ClipboardList },
  { id: 'settings' as ActiveTab, label: 'Ayarlar & Veri', labelShort: 'Ayarlar', icon: Settings },
];
