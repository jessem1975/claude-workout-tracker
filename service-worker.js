const CACHE_NAME = 'workout-tracker-v3';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/storage.js',
  './js/exercises.js',
  './js/exercise-registry.js',
  './js/videos.js',
  './js/plan.js',
  './js/plans.js',
  './js/progression.js',
  './js/timer.js',
  './js/session.js',
  './js/import.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];
// js/vendor/xlsx.core.min.js is intentionally not precached — it's large
// and only needed if the user imports a plan from Excel. It gets cached
// automatically (via the fetch handler below) the first time it's used.

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
