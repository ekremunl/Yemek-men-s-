// src/lib/pdf.ts
// Gerçek PDF dosyası üretir (yazdırma penceresine bağlı değildir; mobilde de çalışır).
// Türkçe karakterler için küçültülmüş DejaVu Sans yazı tipi /public/fonts altından yüklenir.
import type { DailyMenu, FoodItem } from '@/types';
import { COURSE_LABELS_TR, MEAL_COURSE_FIELDS, summarizeCalories } from '@/lib/menu';
import { DAY_NAMES_TR, MONTH_NAMES_TR, createLocalDate, getCalendarDateKey, getDaysInMonth } from '@/lib/utils';

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

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.addFileToVFS('DejaVuSans.ttf', regular);
  doc.addFileToVFS('DejaVuSans-Bold.ttf', bold);
  doc.addFont('DejaVuSans.ttf', 'DejaVu', 'normal');
  doc.addFont('DejaVuSans-Bold.ttf', 'DejaVu', 'bold');
  doc.setFont('DejaVu', 'bold');
  doc.setFontSize(13);
  doc.text(`${MONTH_NAMES_TR[month]} ${year} — Yemek Listesi`, 10, 12);

  const itemById = new Map(foodItems.map((i) => [i.id, i]));
  const name = (id: string | null | undefined) => (id ? itemById.get(id)?.name ?? '' : '');
  const hasCalories = foodItems.some((i) => i.calories);

  const head = [
    [
      { content: 'Tarih', rowSpan: 2 },
      { content: 'Öğle Yemeği', colSpan: 4 },
      { content: 'Akşam Yemeği', colSpan: 4 },
      { content: 'Ara Öğün', rowSpan: 2 },
      ...(hasCalories ? [{ content: 'kcal', rowSpan: 2 }] : []),
    ],
    [...MEAL_COURSE_FIELDS, ...MEAL_COURSE_FIELDS].map((f) => COURSE_LABELS_TR[f]),
  ];

  const weekendRows = new Set<number>();
  const body = Array.from({ length: getDaysInMonth(year, month) }, (_, i) => {
    const day = i + 1;
    const date = createLocalDate(year, month, day);
    const dow = date.getDay();
    if (dow === 0 || dow === 6) weekendRows.add(i);
    const menu = menus.find((m) => m.date === getCalendarDateKey(year, month, day));
    const total = hasCalories ? summarizeCalories(menu, itemById).total : 0;
    return [
      `${day} ${DAY_NAMES_TR[(dow + 6) % 7]}`,
      ...MEAL_COURSE_FIELDS.map((f) => name(menu?.lunch[f])),
      ...MEAL_COURSE_FIELDS.map((f) => name(menu?.dinner[f])),
      name(menu?.snack),
      ...(hasCalories ? [total ? String(total) : ''] : []),
    ];
  });

  autoTable(doc, {
    head: head as never,
    body,
    startY: 16,
    margin: { left: 8, right: 8, top: 14, bottom: 8 },
    theme: 'grid',
    styles: { font: 'DejaVu', fontSize: 6.8, cellPadding: 1.2, overflow: 'linebreak', valign: 'middle', lineWidth: 0.1 },
    headStyles: { fillColor: [67, 56, 202], textColor: 255, fontStyle: 'bold', halign: 'center' },
    columnStyles: { 0: { cellWidth: 14, fontStyle: 'bold' } },
    didParseCell: (data) => {
      if (data.section === 'body' && weekendRows.has(data.row.index)) data.cell.styles.fillColor = [243, 244, 246];
    },
  });

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
