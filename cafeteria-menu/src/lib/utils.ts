// src/lib/utils.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { DailyMenu } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

export function createLocalDate(year: number, month: number, day: number, hour = 12): Date {
  return new Date(year, month, day, hour, 0, 0, 0);
}

export function getDaysInMonth(year: number, month: number): number {
  return createLocalDate(year, month + 1, 0).getDate();
}

export function getFirstDayOfMonth(year: number, month: number): number {
  // Returns 0=Sun...6=Sat, adjusted so Monday=0
  const day = createLocalDate(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getCalendarDateKey(year: number, month: number, day: number): string {
  return formatDate(createLocalDate(year, month, day));
}

export function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return createLocalDate(y, m - 1, d);
}

export function getTodayDateKey(): string {
  return formatDate(new Date());
}

export function getMonthDayEntries(year: number, month: number) {
  const daysInMonth = getDaysInMonth(year, month);
  return Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const date = createLocalDate(year, month, day);
    return {
      day,
      dateStr: getCalendarDateKey(year, month, day),
      dayName: DAY_NAMES_TR_FULL[(date.getDay() + 6) % 7],
    };
  });
}

export function getWeekNumber(dateStr: string): number {
  const d = parseDate(dateStr);
  const firstDay = createLocalDate(d.getFullYear(), d.getMonth(), 1);
  const dayOfMonth = d.getDate();
  const firstDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
  return Math.ceil((dayOfMonth + firstDayOfWeek) / 7);
}

export function isSameWeek(dateStr1: string, dateStr2: string): boolean {
  const d1 = parseDate(dateStr1);
  const d2 = parseDate(dateStr2);

  const getStartOfWeek = (date: Date) => {
    const start = new Date(date);
    const day = start.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + diff);
    start.setHours(0, 0, 0, 0);
    return start;
  };

  return getStartOfWeek(d1).getTime() === getStartOfWeek(d2).getTime();
}

export function getMonthMenus(menus: DailyMenu[], year: number, month: number): DailyMenu[] {
  return menus.filter((m) => {
    const d = parseDate(m.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });
}

export const MONTH_NAMES_TR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

export const DAY_NAMES_TR = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
export const DAY_NAMES_TR_FULL = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

export function formatShortDateTR(dateStr: string): string {
  const d = parseDate(dateStr);
  return `${d.getDate()} ${MONTH_NAMES_TR[d.getMonth()]}`;
}

export function formatDateLabelTR(date: Date): string {
  const dayName = DAY_NAMES_TR_FULL[(date.getDay() + 6) % 7];
  return `${dayName}, ${date.getDate()} ${MONTH_NAMES_TR[date.getMonth()]} ${date.getFullYear()}`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
