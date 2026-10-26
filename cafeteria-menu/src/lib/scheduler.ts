// src/lib/scheduler.ts
//
// Aylık menü üreticisi (grup tabanlı, kuralsız):
//   1. Ana yemekler dört gruptan seçilir (bakliyat, et, etli sebze, tavuk).
//   2. Her hafta (Pzt–Paz) bu gruplar günlere EŞİT dağıtılır; her hafta farklı günlere düşer
//      (aynı grup geçen haftanın aynı gününe ve art arda günlere düşmemeye çalışır).
//   3. Öğle ve akşam ana yemeği aynı gün aynı gruptan olmaz.
//   4. Gruptan yemek seçerken "en uzun süredir seçilmemiş" yemek alınır: geçmiş aylar dahil, gruptaki diğer
//      yemekler seçilmeden aynı yemek tekrar edemez. Çorba/yan yemek/tamamlayıcı/ara öğün de kendi kategorisinde
//      aynı şekilde döner.
//   5. Tek kural: yasaklar (gün yasakları ve hafta sonu yasaklı yemekler).
import type { DailyMenu, FoodItem, MainGroup, PlanSettings } from '@/types';
import { MAIN_GROUPS, MAIN_GROUP_LABEL } from '@/types';

const COURSES = [
  ['soup', 'soups'],
  ['mainCourse', 'mainCourses'],
  ['sideDish', 'sideDishes'],
  ['complement', 'complements'],
] as const;
type Slot = 'lunch' | 'dinner';
const SLOTS: Slot[] = ['lunch', 'dinner'];

// ---------------------------------------------------------------------------
// Yardımcılar
// ---------------------------------------------------------------------------

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], rng: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const pad = (n: number) => String(n).padStart(2, '0');
const dateKey = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const parts = (date: string) => date.split('-').map(Number) as [number, number, number];
/** Gün numarası (karşılaştırma ve "kaç gün önce" için). */
export const dayNumber = (date: string) => {
  const [y, m, d] = parts(date);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
};
const dowOf = (date: string) => {
  const [y, m, d] = parts(date);
  return new Date(y, m - 1, d, 12).getDay();
};
const isWeekendDate = (date: string) => {
  const dow = dowOf(date);
  return dow === 0 || dow === 6;
};
/** Haftanın Pazartesi'si (YYYY-MM-DD). */
export function mondayOf(date: string): string {
  const [y, m, d] = parts(date);
  const day = new Date(y, m - 1, d, 12);
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  return dateKey(day.getFullYear(), day.getMonth(), day.getDate());
}

// ---------------------------------------------------------------------------
// Yasaklar
// ---------------------------------------------------------------------------

/** Bu yemek bu tarihte yasaklıysa nedenini, değilse null döner. */
export function banReason(item: FoodItem, date: string, settings: PlanSettings): string | null {
  const dow = dowOf(date);
  const weekend = dow === 0 || dow === 6;
  const entries = weekend ? settings.weekendBans ?? [] : settings.dayBans?.[String(dow)] ?? [];
  const where = weekend ? 'hafta sonu' : ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'][dow];
  const exempt = entries.includes(`a:${item.id}`);
  for (const entry of entries) {
    if (entry === `d:${item.id}`) return `${where} günü yasaklı`;
    if (!exempt && entry.startsWith('g:') && item.category === 'mainCourses' && item.group === entry.slice(2)) {
      return `${where} günü ${MAIN_GROUP_LABEL[item.group as MainGroup].toLocaleLowerCase('tr-TR')} yasaklı`;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Döngü (rotasyon) belleği
// ---------------------------------------------------------------------------

class Rotation {
  private last = new Map<string, number>();
  private uses = new Map<string, number>();
  constructor(private rng: () => number) {}

  mark(id: string | null | undefined, date: string) {
    if (!id) return;
    const n = dayNumber(date);
    if (n >= (this.last.get(id) ?? -Infinity)) this.last.set(id, n);
    this.uses.set(id, (this.uses.get(id) ?? 0) + 1);
  }

  markMenu(menu: DailyMenu) {
    SLOTS.forEach((slot) => COURSES.forEach(([field]) => this.mark(menu[slot][field], menu.date)));
    this.mark(menu.snack, menu.date);
  }

  /** En uzun süredir kullanılmayan önce; eşitlikte az kullanılan; sonra rastgele. */
  pick(candidates: FoodItem[]): FoodItem | undefined {
    if (candidates.length === 0) return undefined;
    const keyed = candidates.map((item) => ({
      item,
      last: this.last.get(item.id) ?? -Infinity,
      uses: this.uses.get(item.id) ?? 0,
      r: this.rng(),
    }));
    keyed.sort((a, b) => a.last - b.last || a.uses - b.uses || a.r - b.r);
    return keyed[0].item;
  }
}

// ---------------------------------------------------------------------------
// Haftalık grup planı
// ---------------------------------------------------------------------------

type GroupPlan = Map<string, MainGroup | undefined>; // `${date}|${slot}` → grup

interface PlanContext {
  groupsActive: MainGroup[];
  available: (date: string, group: MainGroup) => boolean;
  rng: () => number;
  groupCount: Record<MainGroup, number>;
  /** Önceki haftanın (gün-of-hafta → grup) atamaları: aynı güne aynı grup düşmemeye çalışılır. */
  previousWeek: Record<Slot, Map<number, MainGroup>>;
  /** Önceki haftanın son günü (Pazar) grupları: Pazartesi ile art arda aynı olmasın. */
  previousLast: Record<Slot, MainGroup | undefined>;
}

/** Bir hafta ve öğün için gün → grup dizisini seçer (eşit dağılım + çeşitlilik). */
function planWeekSlot(days: string[], slot: Slot, ctx: PlanContext, lunchOf: Map<string, MainGroup | undefined>): (MainGroup | undefined)[] {
  const n = days.length;
  const groups = ctx.groupsActive;
  const k = groups.length;
  if (k === 0) return days.map(() => undefined);

  // Hedef sayılar: n gün k gruba eşit; artanlar şimdiye kadar en az kullanılan gruplara.
  const base = Math.floor(n / k);
  const extra = n % k;
  const byDebt = shuffled(groups, ctx.rng).sort((a, b) => ctx.groupCount[a] - ctx.groupCount[b]);
  const target: Partial<Record<MainGroup, number>> = {};
  groups.forEach((g) => (target[g] = base));
  byDebt.slice(0, extra).forEach((g) => (target[g] = (target[g] ?? 0) + 1));
  const multiset: MainGroup[] = groups.flatMap((g) => Array(target[g]).fill(g));

  const valid = (arr: MainGroup[]) =>
    arr.every((g, i) => ctx.available(days[i], g) && (slot === 'lunch' || lunchOf.get(days[i]) !== g));
  const score = (arr: MainGroup[]) => {
    let s = 0;
    arr.forEach((g, i) => {
      const dow = dowOf(days[i]);
      if (ctx.previousWeek[slot].get(dow) === g) s += 3; // geçen haftanın aynı günü
      const before = i > 0 ? arr[i - 1] : ctx.previousLast[slot];
      if (before === g) s += 2; // art arda aynı grup
    });
    return s;
  };

  let best: MainGroup[] | null = null;
  let bestScore = Infinity;
  for (let attempt = 0; attempt < 600; attempt++) {
    const arr = shuffled(multiset, ctx.rng);
    if (!valid(arr)) {
      // Onarım: geçersiz konumları geçerli bir komşuyla takas etmeyi dene.
      for (let i = 0; i < n; i++) {
        const ok = (g: MainGroup, idx: number) => ctx.available(days[idx], g) && (slot === 'lunch' || lunchOf.get(days[idx]) !== g);
        if (ok(arr[i], i)) continue;
        for (let j = 0; j < n; j++) {
          if (j !== i && ok(arr[j], i) && ok(arr[i], j)) {
            [arr[i], arr[j]] = [arr[j], arr[i]];
            break;
          }
        }
      }
      if (!valid(arr)) continue;
    }
    const sc = score(arr);
    if (sc < bestScore) {
      best = arr;
      bestScore = sc;
      if (sc === 0) break;
    }
  }
  if (best) return best;

  // Eşit dağılım mümkün değil (yasaklar yüzünden): gün gün, en az kullanılan uygun gruptan seç.
  const local = Object.fromEntries(MAIN_GROUPS.map((g) => [g, 0])) as Record<MainGroup, number>;
  return days.map((date) => {
    const options = shuffled(groups, ctx.rng)
      .filter((g) => ctx.available(date, g) && (slot === 'lunch' || lunchOf.get(date) !== g))
      .sort((a, b) => local[a] - local[b] || ctx.groupCount[a] - ctx.groupCount[b]);
    const g = options[0];
    if (g) local[g] += 1;
    return g;
  });
}

// ---------------------------------------------------------------------------
// Ana fonksiyon
// ---------------------------------------------------------------------------

export interface ScheduleInput {
  items: FoodItem[];
  year: number;
  /** 0 tabanlı ay. */
  month: number;
  /** Kayıtlı tüm menüler (geçmiş aylar döngü belleği için kullanılır). */
  existingMenus: DailyMenu[];
  /** Aynen korunacak günler (kilitli / kapsam dışı). */
  frozenDates?: string[];
  settings: PlanSettings;
  seed?: number;
}

export interface ScheduleResult {
  /** Ayın tüm günleri için menü (dondurulmuş günlerde mevcut menü). */
  menus: DailyMenu[];
  warnings: string[];
  seed: number;
}

const emptyMenu = (date: string): DailyMenu => ({
  date,
  lunch: { soup: null, mainCourse: null, sideDish: null, complement: null },
  dinner: { soup: null, mainCourse: null, sideDish: null, complement: null },
  snack: null,
});

export function scheduleMonth(input: ScheduleInput): ScheduleResult {
  const { items, year, month, existingMenus, settings } = input;
  const seed = input.seed ?? Math.floor(Math.random() * 1_000_000);
  const rng = mulberry32(seed);
  const frozen = new Set(input.frozenDates ?? []);
  const warnings: string[] = [];
  const byId = new Map(items.map((i) => [i.id, i]));

  const dayCount = new Date(year, month + 1, 0).getDate();
  const monthDates = Array.from({ length: dayCount }, (_, i) => dateKey(year, month, i + 1));
  const firstDate = monthDates[0];

  // --- Havuzlar ---------------------------------------------------------------
  const pool = (cat: string) => items.filter((i) => i.category === cat);
  const mainsByGroup = (g: MainGroup) => items.filter((i) => i.category === 'mainCourses' && i.group === g);
  const groupsActive = MAIN_GROUPS.filter((g) => mainsByGroup(g).length > 0);
  const ungrouped = items.filter((i) => i.category === 'mainCourses' && !i.group).length;
  MAIN_GROUPS.filter((g) => !groupsActive.includes(g)).forEach((g) =>
    warnings.push(`"${MAIN_GROUP_LABEL[g]}" grubunda yemek yok; o günler diğer gruplardan dolduruldu.`)
  );
  if (ungrouped > 0) warnings.push(`${ungrouped} ana yemeğin grubu seçilmediği için menüye alınmadı (Havuz'dan grup seçin).`);

  // --- Döngü belleği: önceki aylar + dondurulmuş günler ---------------------------
  const rotation = new Rotation(rng);
  existingMenus.filter((m) => m.date < firstDate).sort((a, b) => a.date.localeCompare(b.date)).forEach((m) => rotation.markMenu(m));
  const keptByDate = new Map(existingMenus.filter((m) => frozen.has(m.date)).map((m) => [m.date, m]));
  const keptUse = new Map<number, Set<string>>();
  keptByDate.forEach((m, date) => {
    const ids = new Set<string>();
    SLOTS.forEach((s) => COURSES.forEach(([f]) => m[s][f] && ids.add(m[s][f] as string)));
    if (m.snack) ids.add(m.snack);
    keptUse.set(dayNumber(date), ids);
  });
  const nearKept = (id: string, date: string) => {
    const n = dayNumber(date);
    for (let d = -2; d <= 2; d++) if (d !== 0 && keptUse.get(n + d)?.has(id)) return true;
    return false;
  };

  // --- Haftalık grup planı -----------------------------------------------------
  const plan: GroupPlan = new Map();
  const groupCount = Object.fromEntries(MAIN_GROUPS.map((g) => [g, 0])) as Record<MainGroup, number>;
  const weeks = new Map<string, string[]>();
  monthDates.forEach((date) => {
    if (frozen.has(date)) return;
    const key = mondayOf(date);
    weeks.set(key, [...(weeks.get(key) ?? []), date]);
  });

  const groupOfMenuMain = (menu: DailyMenu | undefined, slot: Slot): MainGroup | undefined => {
    const id = menu?.[slot].mainCourse;
    return id ? byId.get(id)?.group : undefined;
  };
  const menuByDate = new Map(existingMenus.map((m) => [m.date, m]));
  const availableOn = (date: string, group: MainGroup) =>
    mainsByGroup(group).some((i) => !banReason(i, date, settings));

  let prevWeekAssign: Record<Slot, Map<number, MainGroup>> = { lunch: new Map(), dinner: new Map() };
  let prevLast: Record<Slot, MainGroup | undefined> = { lunch: undefined, dinner: undefined };
  // İlk hafta için: önceki günlerin (kayıtlı menülerin) grupları
  {
    const firstMonday = mondayOf(firstDate);
    const lastWeekMonday = dayNumber(firstMonday) - 7;
    for (let n = lastWeekMonday; n < dayNumber(firstMonday); n++) {
      const d = new Date(n * 86_400_000);
      const key = dateKey(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      SLOTS.forEach((slot) => {
        const g = groupOfMenuMain(menuByDate.get(key), slot);
        if (g) prevWeekAssign[slot].set(dowOf(key), g);
      });
    }
    SLOTS.forEach((slot) => {
      const sunday = new Date((dayNumber(firstMonday) - 1) * 86_400_000);
      prevLast[slot] = groupOfMenuMain(menuByDate.get(dateKey(sunday.getUTCFullYear(), sunday.getUTCMonth(), sunday.getUTCDate())), slot);
    });
  }

  Array.from(weeks.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([, days]) => {
      const ctx: PlanContext = { groupsActive, available: availableOn, rng, groupCount, previousWeek: prevWeekAssign, previousLast: prevLast };
      const lunchOf = new Map<string, MainGroup | undefined>();
      const thisWeek: Record<Slot, Map<number, MainGroup>> = { lunch: new Map(), dinner: new Map() };
      SLOTS.forEach((slot) => {
        const assigned = planWeekSlot(days, slot, ctx, lunchOf);
        days.forEach((date, i) => {
          const g = assigned[i];
          plan.set(`${date}|${slot}`, g);
          if (slot === 'lunch') lunchOf.set(date, g);
          if (g) {
            groupCount[g] += 1;
            thisWeek[slot].set(dowOf(date), g);
          }
        });
      });
      prevWeekAssign = thisWeek;
      prevLast = {
        lunch: plan.get(`${days[days.length - 1]}|lunch`),
        dinner: plan.get(`${days[days.length - 1]}|dinner`),
      };
    });

  // --- Yemek seçimi (gün gün) --------------------------------------------------
  let banRelaxed = 0;
  let companionRelaxed = 0;
  const outMenus: DailyMenu[] = [];

  monthDates.forEach((date) => {
    if (frozen.has(date)) {
      const kept = keptByDate.get(date);
      if (kept) {
        rotation.markMenu(kept);
        outMenus.push(kept);
      }
      return;
    }
    const menu = emptyMenu(date);
    const usedToday = new Set<string>();

    /** `blocked`: bu öğünün ana yemeğinin yanına gelmesi istenmeyen yemekler. */
    const choose = (candidates: FoodItem[], blocked?: Set<string>): FoodItem | undefined => {
      const free = candidates.filter((i) => !usedToday.has(i.id));
      const fitting = blocked && blocked.size ? free.filter((i) => !blocked.has(i.id)) : free;
      const allowed = fitting.filter((i) => !banReason(i, date, settings));
      const spaced = allowed.filter((i) => !nearKept(i.id, date));
      const hit = rotation.pick(spaced.length ? spaced : allowed);
      if (hit) return hit;
      // Her aday yasak ya da eşlikçi yasağındaysa: önce yalnızca gün yasağına uy, olmazsa hepsini yok say.
      const noCompanion = free.filter((i) => !banReason(i, date, settings));
      const second = rotation.pick(noCompanion);
      if (second) {
        companionRelaxed += 1;
        return second;
      }
      const relaxed = rotation.pick(free);
      if (relaxed) banRelaxed += 1;
      return relaxed;
    };

    SLOTS.forEach((slot) => {
      // Önce ana yemek (yanına gelmeyecek yemekler buna göre belirlenir), sonra diğer kurslar.
      const g = plan.get(`${date}|${slot}`);
      const anyGrouped = items.filter((i) => i.category === 'mainCourses' && i.group);
      const main = choose(g ? mainsByGroup(g) : []) ?? choose(anyGrouped);
      const blocked = new Set(main?.bannedCompanions ?? []);
      if (main) {
        menu[slot].mainCourse = main.id;
        usedToday.add(main.id);
        rotation.mark(main.id, date);
      }
      COURSES.filter(([field]) => field !== 'mainCourse').forEach(([field, cat]) => {
        const chosen = choose(pool(cat), blocked);
        if (chosen) {
          menu[slot][field] = chosen.id;
          usedToday.add(chosen.id);
          rotation.mark(chosen.id, date);
        }
      });
    });
    const snack = choose(pool('snacks'));
    if (snack) {
      menu.snack = snack.id;
      rotation.mark(snack.id, date);
    }
    outMenus.push(menu);
  });

  if (companionRelaxed > 0) warnings.push(`${companionRelaxed} yemek yerinde "yanına gelmesin" yasağına uyacak aday kalmadı; yasak yok sayıldı. Havuzda ilgili kategoride daha fazla yemek olsun.`);
  if (banRelaxed > 0) warnings.push(`${banRelaxed} yemek yeri için tüm adaylar yasaklıydı; yasak yok sayıldı. Yasak listelerini ya da havuzu gözden geçirin.`);
  return { menus: outMenus, warnings, seed };
}
