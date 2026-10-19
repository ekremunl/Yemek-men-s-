# Yemekhane Yönetimi (Menü + Mutfak + Sipariş)

Tek kişilik kullanım için, telefona kurulabilen (PWA), çevrimdışı çalışan **tek uygulama**.
Daha önce ayrı olan üç uygulamayı birleştirir: menü planlayıcı, Mutfaktakip (günlük çıkış raporu) ve sipariş uygulaması.
Veriler yalnızca cihazın tarayıcısında (`localStorage`) saklanır; sunucu yoktur.

## Sekmeler
- **Plan:** aylık otomatik menü, hafta görünümü (kaydır), gün kilitleme, haftayı yenile, kurala uygun öneri, kalori, PDF/Excel dışa aktarma (üstteki ↓ düğmesi)
- **Havuz:** yemek havuzu, etiketler, eşlikçiler, kalori ve **reçete bağlantısı**
- **Mutfak:** *Günlük* (kişi sayıları, menüden gelen yemekler, elle reçete, fırın, doğrudan tüketim) · *Rapor* (otomatik malzeme hesabı, düzenlenebilir, PDF indir/paylaş) · *Reçeteler* (1 kişilik miktarlar)
- **Sipariş:** ürün gir, **menüden sipariş hesapla** (reçetelerden toplam malzeme → kg/L/Adet), kopyala/paylaş. Liste kalıcıdır.
- **Ayarlar:** menü kuralları, eski uygulamalardan veri alma, yemek ↔ reçete eşleştirme, yedek/geri yükle, uygulamayı kur

## Nasıl birleşiyor?
Havuzdaki bir yemeğe reçete bağlanınca: o günün **Mutfak raporu** menüden otomatik hesaplanır (kişi sayısı × 1 kişilik miktar),
ve aynı reçeteler **Sipariş** için haftalık toplam malzemeyi verir. Reçetesiz yemekler hesaba katılmaz ve sarı uyarıyla gösterilir.

## Eski uygulamalardan geçiş
Ayarlar → "Eski Uygulamalardan Veri Al":
- Mutfaktakip: reçeteler ve günlük kayıtlar (aynı alan adındaysa "bu tarayıcıdan", değilse yedek dosyasıyla)
- Sipariş: ürün adları (aynı alan adındaysa otomatik, değilse yapıştırarak)
Adı birebir tutan yemekler reçeteyle otomatik eşleşir; kalanlar önerilerle bağlanır.

## Geliştirme
```bash
npm install
npm run dev
npm test        # motor, mutfak/sipariş hesapları, store testleri
npm run build   # statik çıktı: out/
```
`next.config.mjs` içindeki `basePath` (`/Yemek-men-s-`) GitHub Pages yoluna göredir; PWA ve yazı tipi yolları bunu kullanır.
