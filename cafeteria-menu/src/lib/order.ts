// src/lib/order.ts
import type { OrderItem } from '@/types';
import type { IngredientLine } from '@/lib/shopping';

/** Reçete birimini sipariş birimine çevirir: g→kg, ml→L, adet→Adet; bilinmeyenler Adet olur. */
export function ingredientToOrderItem(line: IngredientLine): OrderItem {
  const up = (q: number) => Math.ceil(q * 100) / 100;
  switch (line.unit) {
    case 'g': return { name: line.name, qty: up(line.qty / 1000), unit: 'kg' };
    case 'kg': return { name: line.name, qty: up(line.qty), unit: 'kg' };
    case 'ml': return { name: line.name, qty: up(line.qty / 1000), unit: 'L' };
    case 'L': return { name: line.name, qty: up(line.qty), unit: 'L' };
    case 'paket': return { name: line.name, qty: up(line.qty), unit: 'Paket' };
    case 'kutu': return { name: line.name, qty: up(line.qty), unit: 'Kutu' };
    default: return { name: line.name, qty: up(line.qty), unit: 'Adet' };
  }
}

export const fmtOrderQty = (q: number) => (Number.isInteger(q) ? String(q) : String(parseFloat(q.toFixed(2))).replace('.', ','));

export function orderToText(items: OrderItem[], date = new Date()): string {
  const dateStr = date.toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const lines = items.map((o) => `  ${fmtOrderQty(o.qty)} ${o.unit.padEnd(6)} ${o.name}`);
  const rule = '─'.repeat(32);
  return `HAFTALIK SİPARİŞ\n${dateStr}\n${rule}\n${lines.join('\n')}\n${rule}\nToplam: ${items.length} ürün`;
}
