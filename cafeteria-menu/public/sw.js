/* Yemekhane Menü Planlayıcı — çevrimdışı çalışma için basit service worker.
 *  - Sayfa (navigation): önce ağ, olmazsa önbellek.
 *  - Diğer aynı-kökenli GET istekleri (JS, CSS, ikon, yazı tipi): önbellekten ver, arkada yenile.
 *  Sürümü değiştirmek eski önbelleği temizler. */
const VERSION = 'v2';
const CACHE = 'yemek-menu-' + VERSION;
const SCOPE = self.registration.scope; // örn. https://kullanici.github.io/Yemek-men-s-/

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll([SCOPE, SCOPE + 'manifest.webmanifest', SCOPE + 'icons/icon-192.png']).catch(() => undefined),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('yemek-menu-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.href.startsWith(SCOPE)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(SCOPE, copy));
          return response;
        })
        .catch(() => caches.match(request).then((hit) => hit || caches.match(SCOPE))),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((hit) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => hit);
      return hit || network;
    }),
  );
});
