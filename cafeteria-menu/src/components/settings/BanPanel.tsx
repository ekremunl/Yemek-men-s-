// src/components/settings/BanPanel.tsx
'use client';
import { useMemo } from 'react';
import { CalendarOff, X } from 'lucide-react';
import { useAppStore } from '@/context/store';
import { MAIN_GROUPS, MAIN_GROUP_LABEL, type BanEntry, type FoodItem, type MainGroup } from '@/types';
import { CATEGORY_META } from '@/lib/seedData';

const WEEKDAYS: [string, string][] = [['1', 'Pazartesi'], ['2', 'Salı'], ['3', 'Çarşamba'], ['4', 'Perşembe'], ['5', 'Cuma']];

interface BanListProps {
  title: string;
  hint?: string;
  entries: BanEntry[];
  onChange: (next: BanEntry[]) => void;
  items: FoodItem[];
}

/** Bir günün (ya da hafta sonunun) yasak listesi: grup, tek yemek ya da istisna eklenebilir. */
function BanList({ title, hint, entries, onChange, items }: BanListProps) {
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const bannedGroups = entries.filter((e) => e.startsWith('g:')).map((e) => e.slice(2) as MainGroup);
  const mains = items.filter((i) => i.category === 'mainCourses').sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  const others = items.filter((i) => i.category !== 'mainCourses').sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  const catLabel = (cat: string) => CATEGORY_META.find((c) => c.key === cat)?.labelTR ?? cat;

  const label = (entry: BanEntry): { text: string; tone: 'ban' | 'allow' } => {
    const id = entry.slice(2);
    if (entry.startsWith('g:')) return { text: `${MAIN_GROUP_LABEL[id as MainGroup] ?? id} (tümü)`, tone: 'ban' };
    const name = byId.get(id)?.name ?? 'silinmiş yemek';
    return entry.startsWith('a:') ? { text: `Serbest: ${name}`, tone: 'allow' } : { text: name, tone: 'ban' };
  };

  const add = (value: string) => {
    if (value && !entries.includes(value)) onChange([...entries, value]);
  };

  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm text-white">{title}</p>
        {hint && <p className="text-[11px] text-white/40 leading-snug">{hint}</p>}
      </div>
      {entries.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {entries.map((entry) => {
            const { text, tone } = label(entry);
            return (
              <span key={entry} className={`inline-flex items-center gap-1 rounded-full border pl-3 pr-1 text-xs ${tone === 'allow' ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200' : 'border-red-400/30 bg-red-500/15 text-red-200'}`}>
                {text}
                <button type="button" aria-label={`${text} kaldır`} onClick={() => onChange(entries.filter((e) => e !== entry))} className="w-8 h-8 flex items-center justify-center opacity-70"><X className="w-3 h-3" /></button>
              </span>
            );
          })}
        </div>
      )}
      <select
        value=""
        aria-label={`${title}: yasak ekle`}
        onChange={(e) => { add(e.target.value); e.target.value = ''; }}
        className="w-full min-h-[3rem] bg-white/5 border border-white/10 rounded-xl px-3 text-sm text-white/80"
      >
        <option value="">+ Yasak ekle…</option>
        <optgroup label="Gruplar (grubun tüm yemekleri)">
          {MAIN_GROUPS.filter((g) => !bannedGroups.includes(g)).map((g) => <option key={g} value={`g:${g}`}>{MAIN_GROUP_LABEL[g]}</option>)}
        </optgroup>
        <optgroup label="Ana yemekler (tek yemek)">
          {mains.filter((i) => !entries.includes(`d:${i.id}`)).map((i) => (
            <option key={i.id} value={`d:${i.id}`}>{i.name}{i.group ? ` · ${MAIN_GROUP_LABEL[i.group].replace(' yemekleri', '')}` : ''}</option>
          ))}
        </optgroup>
        {bannedGroups.length > 0 && (
          <optgroup label="İstisna: yasaklı gruptan serbest kalacak yemek">
            {mains.filter((i) => i.group && bannedGroups.includes(i.group) && !entries.includes(`a:${i.id}`)).map((i) => (
              <option key={i.id} value={`a:${i.id}`}>{i.name}</option>
            ))}
          </optgroup>
        )}
        <optgroup label="Diğer yemekler (çorba, yan yemek…)">
          {others.filter((i) => !entries.includes(`d:${i.id}`)).map((i) => <option key={i.id} value={`d:${i.id}`}>{i.name} · {catLabel(i.category)}</option>)}
        </optgroup>
      </select>
    </div>
  );
}

/** Gün yasakları (Pzt–Cum) ve hafta sonu yasaklı yemekler. */
export default function BanPanel() {
  const planSettings = useAppStore((s) => s.planSettings);
  const setPlanSettings = useAppStore((s) => s.setPlanSettings);
  const foodItems = useAppStore((s) => s.foodItems);

  const setDay = (day: string, next: BanEntry[]) => {
    const dayBans = { ...planSettings.dayBans };
    if (next.length) dayBans[day] = next;
    else delete dayBans[day];
    setPlanSettings({ dayBans });
  };

  return (
    <section className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-5">
      <div className="flex items-center gap-2">
        <CalendarOff className="w-5 h-5 text-red-300" />
        <h3 className="text-base font-semibold text-white">Yasaklar</h3>
      </div>
      <p className="text-sm text-white/50 leading-relaxed">
        Menü üretici başka kural tanımaz; yalnızca buradaki yasaklara uyar. Bir grubun tamamını ya da tek tek yemekleri yasaklayabilirsiniz.
      </p>

      <BanList
        title="Hafta sonu yasaklı yemekler (Cumartesi ve Pazar)"
        hint='Örn. "Bakliyat yemekleri" grubu yasak. Bir grubu yasaklayıp bazı yemekleri serbest bırakmak için önce grubu ekleyin, sonra "İstisna" bölümünden serbest kalacak yemeği seçin (ör. tavuk yasak, hazır paketli tavuk serbest).'
        entries={planSettings.weekendBans ?? []}
        onChange={(next) => setPlanSettings({ weekendBans: next })}
        items={foodItems}
      />

      <div className="border-t border-white/10 pt-4 space-y-4">
        <p className="text-sm font-semibold text-white/80">Gün yasakları</p>
        {WEEKDAYS.map(([day, label]) => (
          <BanList key={day} title={label} entries={planSettings.dayBans?.[day] ?? []} onChange={(next) => setDay(day, next)} items={foodItems} />
        ))}
      </div>
    </section>
  );
}
