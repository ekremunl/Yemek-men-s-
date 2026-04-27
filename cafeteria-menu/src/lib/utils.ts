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

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function getFirstDayOfMonth(year: number, month: number): number {
  // Returns 0=Sun...6=Sat, adjusted so Monday=0
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function getWeekNumber(dateStr: string): number {
  const d = parseDate(dateStr);
  const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
  const dayOfMonth = d.getDate();
  const firstDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
  return Math.ceil((dayOfMonth + firstDayOfWeek) / 7);
}

export function isSameWeek(dateStr1: string, dateStr2: string): boolean {
  const d1 = parseDate(dateStr1);
  const d2 = parseDate(dateStr2);
  if (d1.getMonth() !== d2.getMonth() || d1.getFullYear() !== d2.getFullYear()) return false;
  return getWeekNumber(dateStr1) === getWeekNumber(dateStr2);
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
