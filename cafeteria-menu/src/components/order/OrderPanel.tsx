// src/components/order/OrderPanel.tsx
'use client';
import { useMemo, useState } from 'react';
import { ChefHat, ClipboardList, Copy, Plus, Share2, Trash2, X } from 'lucide-react';
import { useAppStore } from '@/context/store';
import { ORDER_UNITS } from '@/types';
import { fmtOrderQty, orderToText } from '@/lib/order';
import { cn } from '@/lib/utils';
import MenuToOrderSheet from './MenuToOrderSheet';

const field = 'min-w-0 bg-slate-800 border border-white/10 rounded-xl px-3 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30';

/** Haftalık sipariş: elle ürün gir ya da menüden hesapla; kopyala/paylaş. Liste kalıcıdır. */
export default function OrderPanel() {
  const { orderItems, orderPool, addOrderItems, removeOrderItem, clearOrder, removeFromOrderPool, addToast } = useAppStore((s) => ({
    orderItems: s.orderItems, orderPool: s.orderPool, addOrderItems: s.addOrderItems, removeOrderItem: s.removeOrderItem,
    clearOrder: s.clearOrder, removeFromOrderPool: s.removeFromOrderPool, addToast: s.addToast,
  }));

  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState<string>('Adet');
  const [menuOpen, setMenuOpen] = useState(false);
  const [showPool, setShowPool] = useState(false);

  const suggestions = useMemo(() => {
    const q = name.trim().toLocaleLowerCase('tr-TR');
    if (!q) return [];
    return orderPool.filter((p) => p.toLocaleLowerCase('tr-TR').includes(q) && p.toLocaleLowerCase('tr-TR') !== q).slice(0, 6);
  }, [name, orderPool]);

  const text = useMemo(() => (orderItems.length ? orderToText(orderItems) : ''), [orderItems]);

  const add = () => {
    const n = parseFloat(qty.replace(',', '.'));
    if (!name.trim()) return void addToast({ type: 'warning', title: 'Ürün adı gerekli', message: 'Bir ürün adı girin.' });
    if (!(n > 0)) return void addToast({ type: 'warning', title: 'Miktar gerekli', message: 'Geçerli bir miktar girin.' });
    addOrderItems([{ name: name.trim(), qty: n, unit }]);
    setName(''); setQty('');
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(text); addToast({ type: 'success', title: 'Kopyalandı', message: 'Sipariş panoya kopyalandı.' }); }
    catch { addToast({ type: 'error', title: 'Kopyalanamadı', message: 'Tarayıcı panoya erişimi engelledi.' }); }
  };
  const share = async () => {
    try { if (navigator.share) await navigator.share({ title: 'Haftalık Sipariş', text }); else await copy(); }
    catch (e) { if ((e as Error)?.name !== 'AbortError') addToast({ type: 'error', title: 'Paylaşılamadı', message: 'Bunun yerine kopyalayın.' }); }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white">Sipariş</h2>
        <p className="text-sm text-white/50 mt-1 hidden sm:block">Haftalık siparişi girin ya da menüden hesaplayın</p>
      </div>

      <button type="button" onClick={() => setMenuOpen(true)} className="w-full min-h-[3.25rem] flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white font-semibold active:bg-emerald-500">
        <ChefHat className="w-5 h-5" /> Menüden sipariş hesapla
      </button>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-white/70">Ürün ekle</h3>
        <div className="relative">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ürün adı" className={cn(field, 'w-full')} autoComplete="off" />
          {suggestions.length > 0 && (
            <ul className="absolute z-10 left-0 right-0 mt-1 rounded-xl border border-white/10 bg-slate-800 shadow-xl overflow-hidden">
              {suggestions.map((s) => (
                <li key={s}><button type="button" onClick={() => setName(s)} className="w-full text-left px-4 min-h-[2.75rem] text-sm text-white/85 active:bg-white/10">{s}</button></li>
              ))}
            </ul>
          )}
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
          <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" placeholder="Miktar" className={field} onKeyDown={(e) => e.key === 'Enter' && add()} />
          <select value={unit} onChange={(e) => setUnit(e.target.value)} className={field}>{ORDER_UNITS.map((u) => <option key={u}>{u}</option>)}</select>
        </div>
        <button type="button" onClick={add} className="w-full min-h-[3rem] flex items-center justify-center gap-2 rounded-xl bg-indigo-600 text-white font-semibold active:bg-indigo-500"><Plus className="w-4 h-4" /> Siparişe ekle</button>
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-white/70">Sipariş listesi <span className="text-white/40">({orderItems.length})</span></h3>
          {orderItems.length > 0 && (
            <button type="button" onClick={() => window.confirm('Tüm sipariş silinsin mi?') && clearOrder()} className="min-h-[2.5rem] px-2 flex items-center gap-1 text-xs text-red-300/80"><Trash2 className="w-3.5 h-3.5" /> Temizle</button>
          )}
        </div>
        {orderItems.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-sm text-white/40">
            <ClipboardList className="w-8 h-8 mx-auto mb-2 text-white/20" />
            Henüz ürün yok.
          </div>
        ) : (
          <ul className="rounded-2xl border border-white/10 divide-y divide-white/5 overflow-hidden">
            {orderItems.map((o, i) => (
              <li key={`${o.name}|${o.unit}`} className="flex items-center gap-2 pl-4 pr-1">
                <span className="flex-1 min-w-0 truncate py-3 text-sm text-white/90">{o.name}</span>
                <span className="text-sm font-semibold tabular-nums text-white shrink-0">{fmtOrderQty(o.qty)} {o.unit}</span>
                <button type="button" aria-label={`${o.name} sil`} onClick={() => removeOrderItem(i)} className="w-11 h-11 flex items-center justify-center text-red-400/70"><X className="w-4 h-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {orderItems.length > 0 && (
        <section className="space-y-3">
          <pre className="rounded-2xl border border-white/10 bg-black/30 p-4 text-xs text-emerald-200/90 whitespace-pre-wrap break-words font-mono">{text}</pre>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={copy} className="min-h-[3rem] flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold active:bg-emerald-500"><Copy className="w-4 h-4" /> Kopyala</button>
            <button type="button" onClick={share} className="min-h-[3rem] flex items-center justify-center gap-2 rounded-xl bg-white/5 border border-white/10 text-white/80 text-sm font-semibold active:bg-white/15"><Share2 className="w-4 h-4" /> Paylaş</button>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-white/10 bg-white/5">
        <button type="button" onClick={() => setShowPool((v) => !v)} aria-expanded={showPool} className="w-full flex items-center justify-between px-4 min-h-[3rem] text-sm font-semibold text-white/70">
          <span>Kayıtlı ürünler ({orderPool.length})</span><span>{showPool ? '−' : '+'}</span>
        </button>
        {showPool && (
          <div className="px-4 pb-4 flex flex-wrap gap-1.5">
            {orderPool.length === 0 && <p className="text-xs text-white/35">Sipariş girdikçe ürünler burada birikir.</p>}
            {orderPool.map((p, i) => (
              <span key={p} className="inline-flex items-center gap-1 text-xs rounded-full bg-white/5 border border-white/10 pl-3 pr-1 text-white/80">
                {p}<button type="button" aria-label={`${p} kaldır`} onClick={() => removeFromOrderPool(i)} className="w-8 h-8 flex items-center justify-center text-white/40"><X className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
        )}
      </section>

      <MenuToOrderSheet open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  );
}
