# Yemekhane Yönetimi (Menü + Mutfak + Sipariş)

Tek kişilik kullanım için, telefona kurulabilen (PWA), çevrimdışı çalışan **tek uygulama**.
Daha önce ayrı olan üç uygulamayı birleştirir: menü planlayıcı, Mutfaktakip (günlük çıkış raporu) ve sipariş uygulaması.
Veriler yalnızca cihazın tarayıcısında (`localStorage`) saklanır; sunucu yoktur.

## Sekmeler
- **Plan:** aylık otomatik menü, hafta görünümü (kaydır), gün kilitleme, haftayı yenile, tek yemek için öneri (🔄), kalori, PDF/Excel dışa aktarma (↓), "Tekrar özeti"
- **Havuz:** yemek havuzu. **Ana yemekler dört gruba ayrılır:** bakliyat, et, etli sebze, tavuk. Kalori ve reçete bağlantısı da buradan.
- **Mutfak:** *Günlük* · *Rapor* (otomatik malzeme hesabı, PDF) · *Reçeteler*
- **Sipariş:** ürün gir ya da menüden sipariş hesapla, kopyala/paylaş
- **Ayarlar:** **Yasaklar** (gün yasakları + hafta sonu yasaklı yemekler), eski uygulamalardan veri alma, yedek/geri yükle, uygulamayı kur

## Menü nasıl üretilir? (grup tabanlı, başka kural yok)
1. Ana yemekler **gruplardan** seçilir. Her hafta (Pzt–Paz) gruplar günlere **eşit dağıtılır**; her hafta farklı günlere düşer
   (örn. tavuk hep salı olmaz). Öğle ve akşam aynı gün farklı gruptan olur.
2. Gruptan seçerken **en uzun süredir seçilmemiş** yemek alınır. Geçmiş aylar dahil: gruptaki diğer yemekler seçilmeden
   aynı yemek tekrar etmez. Çorba, yan yemek, tamamlayıcı ve ara öğün de kendi kategorisinde aynı şekilde döner.
3. Tek kural **yasaklardır**: günlere göre (ör. Pazartesi tavuk yok) ve hafta sonu için. Bir grubu yasaklayıp bazı yemekleri
   **istisna** olarak serbest bırakabilirsiniz (ör. tavuk yasak, hazır paketli tavuk serbest).
Etiketler, eşlikçiler ve diğer kurallar kaldırıldı. Grubu seçilmemiş ana yemek menüye otomatik alınmaz.

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
