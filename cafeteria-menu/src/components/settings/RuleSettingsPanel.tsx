// src/components/settings/RuleSettingsPanel.tsx
'use client';
import { Minus, Plus, RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import { useAppStore } from '@/context/store';
import { DEFAULT_RULE_SETTINGS } from '@/types';
import { cn } from '@/lib/utils';
import { getTagLabel } from '@/lib/tags';

// Gün yasağı için seçilebilen etiketler: menü motorunun tanıdığı etiketler (havuzdaki etiket anahtarlarıyla).
const BAN_TAGS = ['poultry', 'beef', 'fish', 'legume', 'dough', 'carb_heavy'];
// Anahtar = JS getDay() (0 = Pazar). Görünüm sırası Pazartesi'den başlar.
const WEEKDAYS: [string, string][] = [['1', 'Pazartesi'], ['2', 'Salı'], ['3', 'Çarşamba'], ['4', 'Perşembe'], ['5', 'Cuma'], ['6', 'Cumartesi'], ['0', 'Pazar']];

function Stepper({ label, hint, value, min, max, onChange }: { label: string; hint: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white">{label}</p>
        <p className="text-[11px] text-white/40 leading-snug">{hint}</p>
      </div>
      <div className="flex items-center rounded-xl border border-white/10 bg-white/5">
        <button type="button" aria-label={`${label} azalt`} disabled={value <= min} onClick={() => onChange(value - 1)} className="w-11 h-11 flex items-center justify-center text-white/70 disabled:opacity-30 active:bg-white/10 rounded-l-xl">
          <Minus className="w-4 h-4" />
        </button>
        <span className="w-8 text-center text-sm font-semibold tabular-nums">{value}</span>
        <button type="button" aria-label={`${label} artır`} disabled={value >= max} onClick={() => onChange(value + 1)} className="w-11 h-11 flex items-center justify-center text-white/70 disabled:opacity-30 active:bg-white/10 rounded-r-xl">
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="w-full flex items-center gap-3 text-left min-h-[3rem]">
      <span className="flex-1 min-w-0">
        <span className="block text-sm text-white">{label}</span>
        <span className="block text-[11px] text-white/40 leading-snug">{hint}</span>
      </span>
      <span className={cn('w-12 h-7 rounded-full p-0.5 transition-colors shrink-0', checked ? 'bg-indigo-600' : 'bg-white/15')}>
        <span className={cn('block w-6 h-6 rounded-full bg-white transition-transform', checked && 'translate-x-5')} />
      </span>
    </button>
  );
}

/** Menü üreticinin kural ayarları. Yeni üretimlerde ve "Öner" düğmelerinde geçerlidir. */
export default function RuleSettingsPanel() {
  const ruleSettings = useAppStore((s) => s.ruleSettings);
  const setRuleSettings = useAppStore((s) => s.setRuleSettings);

  return (
    <section className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="w-5 h-5 text-indigo-400" />
        <h3 className="text-base font-semibold text-white">Menü Kuralları</h3>
        <button type="button" onClick={() => setRuleSettings(DEFAULT_RULE_SETTINGS)} className="ml-auto flex items-center gap-1 min-h-[2.5rem] px-2 text-xs text-white/50 active:text-white">
          <RotateCcw className="w-3.5 h-3.5" />
          Varsayılan
        </button>
      </div>
      <Stepper label="Ana yemek bekleme süresi" hint="Aynı ana yemek kaç gün tekrar edemez (gün)" value={ruleSettings.mainCooldownDays} min={0} max={14} onChange={(n) => setRuleSettings({ mainCooldownDays: n })} />
      <Stepper label="Aynı protein üst üste" hint="Tavuk / kırmızı et / balık en fazla kaç gün art arda" value={ruleSettings.maxConsecutiveProteinDays} min={1} max={5} onChange={(n) => setRuleSettings({ maxConsecutiveProteinDays: n })} />
      <Toggle label="Hafta sonu akşamı öğleyle aynı" hint="Çorba, yan yemek ve tamamlayıcı Cumartesi/Pazar akşamına kopyalanır" checked={ruleSettings.weekendSync} onChange={(v) => setRuleSettings({ weekendSync: v })} />
      <Toggle label="Eşlikçi listeleri zorunlu" hint="Ana yemeğe seçtiğiniz eşlikçiler dışındaki çorba/yan yemek gelmez" checked={ruleSettings.requireCompanions} onChange={(v) => setRuleSettings({ requireCompanions: v })} />
      <div className="border-t border-white/10 pt-4 space-y-3">
        <div>
          <p className="text-sm text-white">Gün yasakları</p>
          <p className="text-[11px] text-white/40 leading-snug">Seçtiğiniz günlerde, seçtiğiniz türdeki yemekler hiçbir öğünde çıkmaz (ör. Pazartesi: Tavuk).</p>
        </div>
        {WEEKDAYS.map(([day, label]) => {
          const banned = ruleSettings.weekdayBans?.[day] ?? [];
          const update = (tags: string[]) => {
            const next = { ...(ruleSettings.weekdayBans ?? {}) };
            if (tags.length) next[day] = tags;
            else delete next[day];
            setRuleSettings({ weekdayBans: next });
          };
          return (
            <div key={day} className="flex items-start gap-2">
              <span className="w-24 shrink-0 pt-3 text-sm text-white/70">{label}</span>
              <div className="flex-1 min-w-0 flex flex-wrap items-center gap-1.5">
                {banned.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-red-500/15 border border-red-400/30 pl-3 pr-1 text-xs text-red-200">
                    {getTagLabel(tag)} yok
                    <button type="button" aria-label={`${label}: ${getTagLabel(tag)} yasağını kaldır`} onClick={() => update(banned.filter((t) => t !== tag))} className="w-8 h-8 flex items-center justify-center text-red-200/70">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <select
                  value=""
                  aria-label={`${label} için yasak ekle`}
                  onChange={(e) => e.target.value && update([...banned, e.target.value])}
                  className="min-h-[2.75rem] bg-white/5 border border-white/10 rounded-xl px-3 text-xs text-white/70"
                >
                  <option value="">+ Yasak ekle</option>
                  {BAN_TAGS.filter((t) => !banned.includes(t)).map((t) => (
                    <option key={t} value={t}>{getTagLabel(t)}</option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-white/35 leading-relaxed">
        Not: Bekleme süresini yükseltmek için havuzda yeterli ana yemek gerekir (en az 2 × (süre + 1)). Yetmezse üretim hata mesajıyla nedenini söyler.
      </p>
    </section>
  );
}
