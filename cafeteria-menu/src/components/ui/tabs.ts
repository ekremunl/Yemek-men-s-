// src/components/ui/tabs.ts
import { CalendarDays, Database, Download, ShoppingBasket, Settings } from 'lucide-react';
import type { ActiveTab } from '@/types';

export const TABS = [
  { id: 'planner' as ActiveTab, label: 'Menü Planlayıcı', labelShort: 'Plan', icon: CalendarDays },
  { id: 'pool' as ActiveTab, label: 'Ürün Havuzu', labelShort: 'Havuz', icon: Database },
  { id: 'ingredients' as ActiveTab, label: 'Malzeme Listesi', labelShort: 'Malzeme', icon: ShoppingBasket },
  { id: 'export' as ActiveTab, label: 'Dışa Aktar', labelShort: 'Aktar', icon: Download },
  { id: 'settings' as ActiveTab, label: 'Ayarlar & Bağlantı', labelShort: 'Ayarlar', icon: Settings },
];
