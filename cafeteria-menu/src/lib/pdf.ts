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
