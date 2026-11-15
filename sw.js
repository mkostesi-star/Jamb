/* Keeps Yamb Café working offline: the app shell is cached, and the latest version is fetched whenever there is a connection. */
const CACHE = 'jamb-v9.3';
const CORE = [
  './', 'index.html', 'engine.js?v=93', 'ai.js?v=93', 'i18n.js?v=93', 'audio.js?v=93', 'music.js?v=93', 'fx.js?v=93', 'scan.js?v=93', 'vendor/supabase.js?v=93', 'cloud.js?v=93', 'app.js?v=93', 'manifest.webmanifest',
  'icons/v7/icon-192.png', 'icons/v7/apple-touch-icon.png', 'icons/v7/favicon-64.png',
  'art/cafe-800.webp', 'art/cafe-1280.webp', 'art/cafe-800.jpg', 'art/menucard.webp', 'art/tray.webp', 'art/saucer.webp', 'art/wood-768.webp', 'art/winner-800.webp', 'art/daily-800.webp',
  'art/cast/ema.webp', 'art/cast/nono.webp', 'art/cast/mira.webp', 'art/cast/joza.webp', 'art/cast/profesor.webp',
  'art/dice/1.webp', 'art/dice/2.webp', 'art/dice/3.webp', 'art/dice/4.webp', 'art/dice/5.webp', 'art/dice/6.webp',
  'art/cup/1.webp', 'art/cup/2.webp', 'art/cup/3.webp', 'art/cup/4.webp', 'art/cup/5.webp', 'art/cup/6.webp', 'art/cup/spin.webp', 'audio/sfx/spin-end.mp3', 'audio/sfx/clink.mp3', 'audio/sfx/saucer.mp3', 'audio/sfx/write.mp3', 'audio/sfx/tap.mp3', 'audio/sfx/page.mp3', 'audio/sfx/bell.mp3', 'audio/sfx/stir.mp3', 'audio/sfx/dishes.mp3', 'audio/sfx/cheer-short.mp3', 'audio/sfx/drop.mp3', 'audio/sfx/tick.mp3', 'audio/sfx/tock.mp3', 'audio/sfx/spin-loop.mp3'
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
    /* Only the game itself is the app shell. Other pages on the site (the privacy page) keep their own entry,
       so opening them can never replace the game in the offline copy. */
    const shell = req.mode === 'navigate' && (url.pathname === '/' || url.pathname.endsWith('/index.html'));
    const key = shell ? './' : req;
    e.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(key, copy));
          }
          return res;
        })
        .catch(() => caches.match(key, { ignoreSearch: true }).then(hit => hit || (shell ? caches.match('./') : undefined)))
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
