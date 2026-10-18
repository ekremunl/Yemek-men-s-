// src/components/planner/WeekView.tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { useAppStore } from '@/context/store';
import { addDays, eachDate, formatShortDateTR, getTodayDateKey, getWeekRange, parseDate } from '@/lib/utils';
import DayCard from './DayCard';
import DayEditor from './DayEditor';

/** Mobil hafta görünümü: 7 günlük kart listesi, kaydırarak (swipe) haftalar arası geçiş. */
export default function WeekView() {
  const { currentYear, currentMonth, setCurrentMonth, generateBalancedMonthMenus, lockedDates } = useAppStore((s) => ({
    currentYear: s.currentYear,
    currentMonth: s.currentMonth,
    setCurrentMonth: s.setCurrentMonth,
    generateBalancedMonthMenus: s.generateBalancedMonthMenus,
    lockedDates: s.lockedDates,
  }));

  const pad = (n: number) => String(n).padStart(2, '0');
  const firstOfMonth = `${currentYear}-${pad(currentMonth + 1)}-01`;
  const today = getTodayDateKey();
  const todayInMonth = today.startsWith(`${currentYear}-${pad(currentMonth + 1)}`);

  const [weekFrom, setWeekFrom] = useState(() => getWeekRange(todayInMonth ? today : firstOfMonth).from);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const days = eachDate(weekFrom, addDays(weekFrom, 6));

  // Ay dışarıdan değişirse (üstteki ay okları) o ayın ilk haftasına dön.
  useEffect(() => {
    const prefix = `${currentYear}-${pad(currentMonth + 1)}`;
    if (!eachDate(weekFrom, addDays(weekFrom, 6)).some((d) => d.startsWith(prefix))) {
      setWeekFrom(getWeekRange(todayInMonth ? today : firstOfMonth).from);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentYear, currentMonth]);

  const goToWeek = (from: string) => {
    setWeekFrom(from);
    // Ay etiketi haftanın Perşembe gününe göre (hafta çoğunlukla hangi aydaysa).
    const thursday = parseDate(addDays(from, 3));
    if (thursday.getFullYear() !== currentYear || thursday.getMonth() !== currentMonth) {
      setCurrentMonth(thursday.getFullYear(), thursday.getMonth());
    }
  };

  const regenerate = () => {
    const to = addDays(weekFrom, 6);
    const lockedCount = lockedDates.filter((d) => d >= weekFrom && d <= to).length;
    if (!window.confirm(`${formatShortDateTR(weekFrom)} – ${formatShortDateTR(to)} haftası yeniden üretilsin mi?${lockedCount ? ` (${lockedCount} kilitli gün korunur.)` : ''}`)) return;
    const groups = new Map<string, { year: number; month: number; from: string; to: string }>();
    for (const date of days) {
      const d = parseDate(date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const group = groups.get(key);
      if (group) group.to = date;
      else groups.set(key, { year: d.getFullYear(), month: d.getMonth(), from: date, to: date });
    }
    groups.forEach((g) => generateBalancedMonthMenus(g.year, g.month, { from: g.from, to: g.to }));
  };

  const onTouchStart = (event: React.TouchEvent) => {
    const t = event.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (event: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const t = event.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    // Yatay ve belirgin kaydırma: dikey kaydırmayla karışmasın.
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6) {
      goToWeek(addDays(weekFrom, dx < 0 ? 7 : -7));
    }
  };

  return (
    <div className="space-y-3" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => goToWeek(addDays(weekFrom, -7))}
          aria-label="Önceki hafta"
          className="w-11 h-11 flex items-center justify-center rounded-xl bg-white/5 text-white/70 active:bg-white/15"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => goToWeek(getWeekRange(today).from)}
          className="flex-1 min-h-[2.75rem] rounded-xl bg-white/5 text-sm font-semibold text-white active:bg-white/15"
        >
          {formatShortDateTR(weekFrom)} – {formatShortDateTR(addDays(weekFrom, 6))}
          <span className="block text-[10px] font-normal text-white/40">bugüne dönmek için dokunun</span>
        </button>
        <button
          type="button"
          onClick={() => goToWeek(addDays(weekFrom, 7))}
          aria-label="Sonraki hafta"
          className="w-11 h-11 flex items-center justify-center rounded-xl bg-white/5 text-white/70 active:bg-white/15"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-2.5">
        {days.map((date) => (
          <DayCard key={date} dateStr={date} onOpen={setSelectedDate} />
        ))}
      </div>

      <button
        type="button"
        onClick={regenerate}
        className="w-full min-h-[3rem] flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 text-sm font-medium text-white/80 active:bg-white/15"
      >
        <RefreshCw className="w-4 h-4" />
        Bu haftayı yeniden üret
      </button>
      <p className="text-center text-[11px] text-white/30">Haftalar arasında geçmek için sola/sağa kaydırın</p>

      {selectedDate && <DayEditor date={selectedDate} onClose={() => setSelectedDate(null)} />}
    </div>
  );
}
