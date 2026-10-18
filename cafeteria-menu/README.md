# Yemekhane Menü Planlayıcı

Tek kişilik kullanım için, telefona kurulabilen (PWA), çevrimdışı çalışan aylık yemekhane menü planlayıcı.
Veriler yalnızca cihazın tarayıcısında (`localStorage`) saklanır; sunucu yoktur.

## Özellikler

**Planlama**
- Aylık otomatik menü (kısıt tabanlı motor: protein, bakliyat, bekleme süresi, hafta sonu, eşlikçi kuralları)
- Mobilde hafta görünümü (sola/sağa kaydır), masaüstünde ay ızgarası; liste görünümü
- Günü **kilitle**: yeniden üretimde değişmez · **Haftayı yenile** · tek yemek için **kurala uygun öneri** (🔄)
- Yemek seçimi aranabilir alt panelde; kural çiğneyen adaylar nedeniyle birlikte işaretlenir
- Üretim başarısız olursa nedeni kalıcı bir uyarı kartında gösterilir
- Kural ayarları (bekleme günü, üst üste protein, hafta sonu senkronu, eşlikçi zorunluluğu)
- Yemeklere kalori (kcal) girilir; gün/öğün toplamı gösterilir

**Malzeme listesi ve Mutfaktakip**
- Mutfaktakip reçeteleri içe aktarılır, yemeklerle adından otomatik eşleşir (kalanlar elle/öneriyle bağlanır)
- Seçilen aralık (bugün / hafta / ay / özel) için toplam malzeme: kişi başı miktar × kişi sayısı
- Menü, Mutfaktakip'in günlük menü ekranına gönderilebilir (kesinleşmiş raporlara dokunulmaz)

**Dışa aktarma / yedek**
- Gerçek PDF (Türkçe karakterli, tek sayfa) indir/paylaş, Excel, JSON yedek (geri al ile silme dahil)

## Mutfaktakip bağlantısı
İki uygulama **aynı alan adında** yayınlanıyorsa (ör. `kullanici.github.io`) `localStorage` ortaktır; "Bu tarayıcıdan al" ve
"Doğrudan gönder" çalışır. Farklı alan adındaysa Mutfaktakip'in yedek dosyasını seçin; güncellenmiş yedeği indirip
Mutfaktakip'te "Yedek Yükle" ile açın.

## Geliştirme
```bash
npm install
npm run dev
npm test        # motor, köprü, store, mutfak/malzeme testleri
npm run build   # statik çıktı: out/
```
`next.config.mjs` içindeki `basePath` (`/Yemek-men-s-`) GitHub Pages yoluna göredir; PWA ve yazı tipi yolları bunu kullanır.
