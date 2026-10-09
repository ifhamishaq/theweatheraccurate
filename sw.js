// Service worker — The Weather Accurate
// Strategy: precache the app shell, serve it instantly, refresh in the background.
// Fonts/vendor are immutable (cache-first). Weather API is network-first with a short timeout.
importScripts('./notify-core.js');

const VERSION = 'v5';
const SHELL_CACHE = 'wa-shell-' + VERSION;
const STATIC_CACHE = 'wa-static-' + VERSION;
const API_CACHE = 'wa-api-v2';
const API_MAX_ENTRIES = 30;

const SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './notify-core.js',
  './manifest.json',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/favicon-32.png',
  './assets/icons/badge-96.png',
  './assets/fonts/inter-latin-wght-normal.woff2',
  './assets/fonts/instrument-serif-latin-400-normal.woff2',
  './assets/fonts/instrument-serif-latin-400-italic.woff2'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  const keep = [SHELL_CACHE, STATIC_CACHE, API_CACHE];
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function timeout(ms) { return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)); }

async function trimCache(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length > max) await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)));
}

// Weather data: fresh when possible, last known when offline or slow
async function networkFirstApi(request) {
  const cache = await caches.open(API_CACHE);
  try {
    const response = await Promise.race([fetch(request), timeout(6000)]);
    if (response && response.ok) {
      cache.put(request, response.clone());
      trimCache(API_CACHE, API_MAX_ENTRIES);
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'offline' }), {
      status: 503, headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Immutable files (fonts, vendor, icons): cache-first
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

// App shell: instant from cache, quietly updated for next time
async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });
  const network = fetch(request).then((response) => {
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached || (await network) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Weather / air-quality data
  if (url.hostname === 'api.open-meteo.com' || url.hostname === 'air-quality-api.open-meteo.com') {
    event.respondWith(networkFirstApi(request));
    return;
  }
  // Location lookups are never cached (privacy) and need no interception
  if (url.origin !== self.location.origin) return;

  // Page navigations: show the cached shell immediately, even offline
  if (request.mode === 'navigate') {
    event.respondWith(
      staleWhileRevalidate(new Request('./index.html')).then((r) => r || fetch(request))
    );
    return;
  }

  if (/\/assets\/(fonts|vendor|icons)\//.test(url.pathname)) {
    event.respondWith(cacheFirst(request).catch(() => Response.error()));
    return;
  }
  event.respondWith(staleWhileRevalidate(request));
});

// ---- Notifications ----
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'weather-check') event.waitUntil(WeatherNotify.runCheck(self.registration));
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || './';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});
