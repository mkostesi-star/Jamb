/* Keeps Yamb Café working offline: the app shell is cached, and the latest version is fetched whenever there is a connection. */
const CACHE = 'jamb-v11.8';
const CORE = [
  './', 'index.html', 'engine.js?v=1180', 'ai.js?v=1180', 'i18n.js?v=1180', 'audio.js?v=1180', 'music.js?v=1180', 'fx.js?v=1180', 'scan.js?v=1180', 'vendor/supabase.js?v=1180', 'cloud.js?v=1180', 'app.js?v=1180', 'manifest.webmanifest',
  'icons/v10/icon-192.png', 'icons/v10/apple-touch-icon.png', 'icons/v10/favicon-64.png',
  'art/shop/phone-768.webp', 'art/shop/wide-1376.webp', 'art/table-teal.webp', 'art/tray.webp', 'art/saucer.webp', 'art/daily-800.webp',
  'fonts/caveat-latin-ext.woff2', 'fonts/caveat-latin.woff2', 'fonts/courier-prime-latin-400.woff2', 'fonts/courier-prime-latin-700.woff2', 'fonts/courier-prime-latin-ext-400.woff2', 'fonts/courier-prime-latin-ext-700.woff2', 'fonts/fraunces-latin-ext.woff2', 'fonts/fraunces-latin.woff2', 'fonts/instrument-sans-latin-ext.woff2', 'fonts/instrument-sans-latin.woff2',
  'art/cast/ema.webp', 'art/cast/nono.webp', 'art/cast/mira.webp', 'art/cast/joza.webp', 'art/cast/profesor.webp',
  'art/dice/1.webp', 'art/dice/2.webp', 'art/dice/3.webp', 'art/dice/4.webp', 'art/dice/5.webp', 'art/dice/6.webp',
  'art/cup/1.webp', 'art/cup/2.webp', 'art/cup/3.webp', 'art/cup/4.webp', 'art/cup/5.webp', 'art/cup/6.webp', 'art/cup/spin.webp', 'art/page/newspaper.webp', 'art/page/bill.webp', 'art/page/stampcard.webp', 'art/page/stamp.webp', 'art/page/cork.webp', 'art/page/print.webp', 'art/page/tape.webp', 'art/page/bell.webp', 'art/page/board.webp', 'art/page/chair.webp', 'audio/sfx/spin-end.mp3', 'audio/sfx/clink.mp3', 'audio/sfx/saucer.mp3', 'audio/sfx/write.mp3', 'audio/sfx/tap.mp3', 'audio/sfx/page.mp3', 'audio/sfx/bell.mp3', 'audio/sfx/stir.mp3', 'audio/sfx/dishes.mp3', 'audio/sfx/cheer-short.mp3', 'audio/sfx/drop.mp3', 'audio/sfx/tick.mp3', 'audio/sfx/tock.mp3', 'audio/sfx/spin-loop.mp3'
];
const CDN = ['cdn.jsdelivr.net'];

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

/* Notifications: a Daily Yamb reminder or a duel result, sent by the Edge Function push (server/functions/push).
   A tap brings the game to the front (or opens it) on the right page. */
self.addEventListener('push', e => {
  let m = {};
  try { m = e.data ? e.data.json() : {}; } catch (x) { m = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(m.title || 'Yamb Café', {
    body: m.body || '', icon: 'icons/v10/icon-192.png', badge: 'icons/v10/badge-96.png',
    tag: m.tag || 'yamb', renotify: m.tag === 'duel', data: { url: m.url || '/' }
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/', self.location.origin);
  const d = url.searchParams.get('d');
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const c = list.find(w => new URL(w.url).origin === self.location.origin);
    if (c) { if (d) c.postMessage({ yamb: 'open', d }); return c.focus(); }
    return self.clients.openWindow(url.href);
  }));
});
