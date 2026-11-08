const CACHE_NAME = 'vb-stats-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/vb.css',
  './js/model.js',
  './js/store.js',
  './js/player.js',
  './js/app.js',
  '../icons/icon-192.png',
  '../icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('vb-stats-') && k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Only handle our own app shell; never cache video or YouTube traffic.
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.destination === 'video' || req.headers.has('range')) return;
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE_NAME).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
