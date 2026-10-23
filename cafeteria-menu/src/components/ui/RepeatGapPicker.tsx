// src/components/ui/RepeatGapPicker.tsx
'use client';
import { cn } from '@/lib/utils';

const PRESETS = [7, 10, 14, 21, 30];

interface Props {
  /** Yemeğe özel aralık (gün); undefined = genel aralık. */
  value: number | undefined;
  /** Genel (varsayılan) aralık, gün olarak. */
  defaultGap: number;
  onChange: (days: number | null) => void;
}

/** "En az kaç gün arayla çıksın" seçici: hazır değerler + elle giriş. Boş = genel aralık. */
export default function RepeatGapPicker({ value, defaultGap, onChange }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-pressed={value === undefined}
          className={cn('min-h-[2.5rem] px-3 rounded-full border text-xs font-medium', value === undefined ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-white/10 bg-white/5 text-white/60')}
        >
          Genel ({defaultGap} gün)
        </button>
        {PRESETS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-pressed={value === n}
            className={cn('min-h-[2.5rem] px-3 rounded-full border text-xs font-medium', value === n ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-white/10 bg-white/5 text-white/60')}
          >
            {n} gün
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-[11px] text-white/45">
        Başka:
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={60}
          key={value ?? 'default'}
          defaultValue={value && !PRESETS.includes(value) ? value : ''}
          placeholder="gün"
          onBlur={(e) => {
            const n = parseInt(e.target.value, 10);
            if (Number.isFinite(n) && n >= 1) onChange(n);
          }}
          className="w-20 bg-slate-800 border border-white/10 rounded-lg px-2.5 py-2 text-sm text-white focus:outline-none focus:border-white/30"
        />
        <span>günde bir</span>
      </label>
    </div>
  );
}
