/* Keeps Jamb working offline: the app shell is cached, and the latest version is fetched whenever there is a connection. */
const CACHE = 'jamb-v5-2';
const CORE = [
  './', 'index.html', 'engine.js?v=52', 'ai.js?v=52', 'i18n.js?v=52', 'audio.js?v=52', 'fx.js?v=52', 'scan.js?v=52', 'app.js?v=52', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png',
  'icons/apple-touch-icon.png', 'icons/favicon-64.png',
  'art/home-800.webp', 'art/home-1280.webp', 'art/home-800.jpg'
];
const CDN = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    const key = req.mode === 'navigate' ? './' : req;
    e.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(key, copy));
          }
          return res;
        })
        .catch(() => caches.match(key, { ignoreSearch: true }).then(hit => hit || caches.match('./')))
    );
    return;
  }

  if (CDN.includes(url.hostname)) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }))
    );
  }
});
