// src/lib/pdf.ts
// Gerçek PDF dosyası üretir (yazdırma penceresine bağlı değildir; mobilde de çalışır).
// Türkçe karakterler için küçültülmüş DejaVu Sans yazı tipi /public/fonts altından yüklenir.
import type { DailyMenu, FoodItem } from '@/types';
import { MEAL_COURSE_FIELDS } from '@/lib/menu';
import { DAY_NAMES_TR_FULL, MONTH_NAMES_TR, createLocalDate, getCalendarDateKey, getDaysInMonth } from '@/lib/utils';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

async function fetchFontBase64(file: string): Promise<string> {
  const response = await fetch(`${BASE}/fonts/${file}`);
  if (!response.ok) throw new Error('Yazı tipi yüklenemedi');
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
  }
  return btoa(binary);
}

/**
 * Aylık menü PDF'i: e-okul pansiyon yemek menüsü düzeni.
 * Dikey A4, sütunlar: Tarih | Öğle | Akşam | Ara Öğün. Her hücrede yemekler büyük harfle, virgülle yan yana.
 * Kahvaltı, okul/müdür adları ve imza alanı yoktur. Tek sayfaya sığması için yazı boyutu otomatik seçilir.
 */
export async function buildMonthPdf(
  year: number,
  month: number,
  menus: DailyMenu[],
  foodItems: FoodItem[]
): Promise<Blob> {
  const [{ jsPDF }, autoTableModule, regular, bold] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    fetchFontBase64('DejaVuSans.ttf'),
    fetchFontBase64('DejaVuSans-Bold.ttf'),
  ]);
  const autoTable = autoTableModule.default;

  const itemById = new Map(foodItems.map((i) => [i.id, i]));
  const upper = (text: string) => text.toLocaleUpperCase('tr-TR');
  const mealText = (ids: (string | null | undefined)[]) => {
    const names = ids.map((id) => (id ? itemById.get(id)?.name ?? '' : '')).filter(Boolean);
    return names.length ? `${upper(names.join(', '))}.` : '';
  };

  const pad = (n: number) => String(n).padStart(2, '0');
  const body = Array.from({ length: getDaysInMonth(year, month) }, (_, i) => {
    const day = i + 1;
    const menu = menus.find((m) => m.date === getCalendarDateKey(year, month, day));
    const dow = createLocalDate(year, month, day).getDay();
    return [
      `${pad(day)} ${MONTH_NAMES_TR[month]} ${year}\n${DAY_NAMES_TR_FULL[(dow + 6) % 7]}`,
      mealText(menu ? MEAL_COURSE_FIELDS.map((f) => menu.lunch[f]) : []),
      mealText(menu ? MEAL_COURSE_FIELDS.map((f) => menu.dinner[f]) : []),
      mealText([menu?.snack]),
    ];
  });

  const startY = 24;
  const bottom = 8;
  const rowHeight = Math.min(12, (297 - startY - bottom) / (body.length + 1));

  const render = (fontSize: number) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    doc.addFileToVFS('DejaVuSans.ttf', regular);
    doc.addFileToVFS('DejaVuSans-Bold.ttf', bold);
    doc.addFont('DejaVuSans.ttf', 'DejaVu', 'normal');
    doc.addFont('DejaVuSans-Bold.ttf', 'DejaVu', 'bold');
    doc.setFont('DejaVu', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`${MONTH_NAMES_TR[month]} Ayı Pansiyon Yemek Menüsü`, 105, 16, { align: 'center' });

    autoTable(doc, {
      head: [['Tarih', 'Öğle', 'Akşam', 'Ara Öğün']],
      body,
      startY,
      margin: { left: 10, right: 10, top: 10, bottom },
      theme: 'grid',
      tableWidth: 190,
      styles: {
        font: 'DejaVu', fontSize, cellPadding: { top: 1.2, bottom: 1.2, left: 1.6, right: 1.4 },
        overflow: 'linebreak', valign: 'middle', lineColor: [0, 0, 0], lineWidth: 0.2, textColor: [0, 0, 0],
        minCellHeight: rowHeight,
      },
      headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: fontSize + 0.5 },
      columnStyles: { 0: { cellWidth: 30, fontStyle: 'bold' }, 1: { cellWidth: 66 }, 2: { cellWidth: 66 }, 3: { cellWidth: 28 } },
    });
    return doc;
  };

  // Tek sayfaya sığan en büyük yazı boyutunu seç.
  let doc = render(8);
  for (const size of [7.5, 7, 6.5, 6, 5.5]) {
    if (doc.getNumberOfPages() === 1) break;
    doc = render(size);
  }
  return doc.output('blob');
}

// ---------------------------------------------------------------------------
// Günlük mutfak raporu (tek A4 sayfa, iki sütun)
// ---------------------------------------------------------------------------

export interface DayReportData {
  dateLabel: string;
  headcounts: { lunch: number; dinner: number };
  summary: { label: string; names: string[] }[];
  cards: { label: string; rows: { name: string; qty: number; unit: string }[] }[];
}

const fmtQty = (q: number) => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(q);

export async function buildDayReportPdf(data: DayReportData): Promise<Blob> {
  const [{ jsPDF }, regular, bold] = await Promise.all([import('jspdf'), fetchFontBase64('DejaVuSans.ttf'), fetchFontBase64('DejaVuSans-Bold.ttf')]);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  doc.addFileToVFS('DejaVuSans.ttf', regular);
  doc.addFileToVFS('DejaVuSans-Bold.ttf', bold);
  doc.addFont('DejaVuSans.ttf', 'DejaVu', 'normal');
  doc.addFont('DejaVuSans-Bold.ttf', 'DejaVu', 'bold');

  const M = 10;
  const W = 210 - M * 2;
  doc.setFont('DejaVu', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 107, 92);
  doc.text('GÜNLÜK RAPOR', M, 12);
  doc.setFontSize(16);
  doc.setTextColor(20, 30, 30);
  doc.text('Günlük Tüketim Raporu', M, 19);
  doc.setFontSize(10);
  doc.text(data.dateLabel, 210 - M, 13, { align: 'right' });
  doc.setFont('DejaVu', 'normal');
  doc.setFontSize(8);
  doc.text(`Öğle: ${data.headcounts.lunch} kişi · Akşam: ${data.headcounts.dinner} kişi`, 210 - M, 18, { align: 'right' });
  doc.setDrawColor(20, 30, 30);
  doc.setLineWidth(0.5);
  doc.line(M, 22, 210 - M, 22);

  // Menü özeti (4 sütun)
  let y = 27;
  const colW = W / 4;
  let summaryH = 0;
  data.summary.forEach((s, i) => {
    const x = M + i * colW;
    doc.setFont('DejaVu', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(15, 107, 92);
    doc.text(s.label.replace(' Yemeği', '').toUpperCase(), x, y);
    doc.setFont('DejaVu', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(20, 30, 30);
    const text = s.names.length ? s.names.join(', ') : '—';
    const lines = doc.splitTextToSize(text, colW - 3) as string[];
    doc.text(lines, x, y + 4);
    summaryH = Math.max(summaryH, 4 + lines.length * 3.2);
  });
  y += summaryH + 4;
  doc.setDrawColor(200, 210, 205);
  doc.setLineWidth(0.2);
  doc.line(M, y - 2, 210 - M, y - 2);

  // Kartları iki sütuna dengeli böl (sıra korunur)
  const cards = data.cards;
  const weights = cards.map((c) => c.rows.length + 3);
  const total = weights.reduce((a, b) => a + b, 0);
  let split = 1, best = Infinity, acc = 0;
  weights.forEach((w, i) => {
    acc += w;
    const diff = Math.abs(acc - (total - acc));
    if (diff < best) { best = diff; split = i + 1; }
  });
  const columns = [cards.slice(0, split), cards.slice(split)];

  const available = 297 - M - y;
  const heightFor = (lh: number) =>
    Math.max(...columns.map((col) => col.reduce((sum, c) => sum + lh * 1.5 + Math.max(1, c.rows.length) * lh + 3, 0)));
  let lh = 5.2;
  while (lh > 2.6 && heightFor(lh) > available) lh -= 0.2;
  const fontSize = Math.min(9, lh * 1.75);
  const gap = 6;
  const cw = (W - gap) / 2;

  columns.forEach((col, ci) => {
    const x0 = M + ci * (cw + gap);
    let cy = y + 2;
    col.forEach((card) => {
      doc.setFont('DejaVu', 'bold');
      doc.setFontSize(fontSize + 1.5);
      doc.setTextColor(20, 30, 30);
      doc.text(`${card.label}`, x0, cy + lh);
      doc.setFont('DejaVu', 'normal');
      doc.setFontSize(fontSize - 1);
      doc.setTextColor(110, 120, 120);
      doc.text(`${card.rows.length} kalem`, x0 + cw, cy + lh, { align: 'right' });
      cy += lh * 1.5;
      doc.setDrawColor(20, 30, 30);
      doc.setLineWidth(0.3);
      doc.line(x0, cy - lh * 0.35, x0 + cw, cy - lh * 0.35);
      doc.setFontSize(fontSize);
      doc.setTextColor(20, 30, 30);
      if (card.rows.length === 0) {
        doc.setTextColor(150, 160, 160);
        doc.text('Kayıt yok', x0, cy + lh * 0.6);
        cy += lh;
      }
      card.rows.forEach((row) => {
        const qty = `${fmtQty(row.qty)} ${row.unit}`;
        doc.setFont('DejaVu', 'bold');
        const qw = doc.getTextWidth(qty);
        doc.setFont('DejaVu', 'normal');
        let name = row.name || '—';
        while (name.length > 3 && doc.getTextWidth(name) > cw - qw - 3) name = name.slice(0, -2);
        if (name !== (row.name || '—')) name += '…';
        doc.text(name, x0, cy + lh * 0.6);
        doc.setFont('DejaVu', 'bold');
        doc.text(qty, x0 + cw, cy + lh * 0.6, { align: 'right' });
        doc.setDrawColor(225, 230, 226);
        doc.setLineWidth(0.15);
        doc.line(x0, cy + lh * 0.85, x0 + cw, cy + lh * 0.85);
        cy += lh;
      });
      cy += 3;
    });
  });

  return doc.output('blob');
}
