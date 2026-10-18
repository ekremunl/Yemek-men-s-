// src/components/settings/SettingsPanel.tsx
'use client';
import { Smartphone } from 'lucide-react';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import BackupPanel from '@/components/export/BackupPanel';
import RuleSettingsPanel from './RuleSettingsPanel';
import MutfakPanel from './MutfakPanel';

export default function SettingsPanel() {
  const { canInstall, installed, isIos, install } = useInstallPrompt();

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white">Ayarlar & Bağlantı</h2>
        <p className="text-sm text-white/50 mt-1">Menü kuralları, Mutfaktakip bağlantısı, yedekleme</p>
      </div>

      <section className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-indigo-400" />
          <h3 className="text-base font-semibold text-white">Uygulama olarak kur</h3>
        </div>
        {installed ? (
          <p className="text-sm text-emerald-300">Uygulama ana ekrandan çalışıyor. Veriler yalnızca bu cihazda saklanır, internet gerekmez.</p>
        ) : canInstall ? (
          <button type="button" onClick={install} className="w-full min-h-[3rem] rounded-xl bg-indigo-600 text-white text-sm font-semibold active:bg-indigo-500">
            Ana ekrana ekle
          </button>
        ) : isIos ? (
          <p className="text-sm text-white/60 leading-relaxed">iPhone/iPad: Safari'de Paylaş düğmesine dokunun, ardından “Ana Ekrana Ekle”yi seçin.</p>
        ) : (
          <p className="text-sm text-white/60 leading-relaxed">Tarayıcı menüsünden “Uygulamayı yükle” veya “Ana ekrana ekle”yi seçin. Kurulumdan sonra çevrimdışı da açılır.</p>
        )}
      </section>

      <RuleSettingsPanel />
      <MutfakPanel />
      <BackupPanel />
    </div>
  );
}
