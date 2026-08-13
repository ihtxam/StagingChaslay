/* ChaslayReborn dashboard — service worker for PWA + WebPOS offline shell.
 * Caches the app shell /assets so the installed window can open offline.
 * API/data are never cached; WebPOS catalog/sales use IndexedDB in the page.
 */
const CACHE = 'chaslay-shell-v2';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.png', '/merchant/pos'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API / auth traffic — WebPOS offline uses IndexedDB instead.
  if (url.pathname.startsWith('/api')) return;

  // Navigations: network-first, fall back to cached shell (incl. /merchant/pos)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => {
            c.put('/index.html', copy).catch(() => undefined);
            if (url.pathname.startsWith('/merchant')) {
              c.put(request, res.clone()).catch(() => undefined);
            }
          });
          return res;
        })
        .catch(() =>
          caches
            .match(request)
            .then((r) => r || caches.match('/merchant/pos') || caches.match('/index.html') || caches.match('/'))
        )
    );
    return;
  }

  // Static assets: stale-while-revalidate for /assets and icons
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (
            res.ok &&
            (url.pathname.startsWith('/assets/') ||
              url.pathname.startsWith('/icons/') ||
              url.pathname.endsWith('.js') ||
              url.pathname.endsWith('.css') ||
              url.pathname.endsWith('.woff2'))
          ) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => undefined);
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
