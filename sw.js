/* Keeps Jamb working offline: the app shell is cached, and the latest version is fetched whenever there is a connection. */
const CACHE = 'jamb-v5';
const CORE = [
  './', 'index.html', 'engine.js?v=5', 'ai.js?v=5', 'i18n.js?v=5', 'audio.js?v=5', 'scan.js?v=5', 'app.js?v=5', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png',
  'icons/apple-touch-icon.png', 'icons/favicon-64.png'
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
