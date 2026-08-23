/* ChaslayReborn dashboard  service worker for PWA + WebPOS offline shell.
 * Caches the app shell /assets so the installed window can open offline.
 * API/data are never cached; WebPOS catalog/sales use IndexedDB in the page.
 */
const CACHE = 'chaslay-shell-v6';

/** Static files that must not depend on auth or SPA routing. */
const PRECACHE = [
  '/index.html',
  '/offline.html',
  '/manifest.webmanifest',
  '/favicon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

function isCacheableAsset(pathname) {
  return (
    pathname.startsWith('/assets/') ||
    pathname.startsWith('/icons/') ||
    pathname.endsWith('.js') ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.woff2') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.webp')
  );
}

function isAppNavigation(pathname) {
  if (pathname.startsWith('/api') || pathname.startsWith('/openpage')) return false;
  if (/\.[a-z0-9]{2,8}$/i.test(pathname)) return false;
  return true;
}

async function cachePutSafe(cache, request, response) {
  try {
    await cache.put(request, response);
  } catch {
    /* quota / opaque response  ignore */
  }
}

async function navigationFallback() {
  const cache = await caches.open(CACHE);
  return (
    (await cache.match('/index.html')) ||
    (await cache.match('/')) ||
    (await cache.match('/offline.html'))
  );
}

/** Parse built index.html and precache hashed /assets/* bundles. */
async function precacheAssetsFromIndex(cache) {
  try {
    const res = await fetch('/index.html', { cache: 'no-cache' });
    if (!res.ok) return;
    const html = await res.text();
    await cachePutSafe(cache, '/index.html', new Response(html, { headers: res.headers }));
    const assets = [
      ...html.matchAll(/(?:src|href)="(\/(?:assets|icons)\/[^"?#]+)"/g),
    ].map((m) => m[1]);
    await Promise.all(assets.map((path) => cache.add(path).catch(() => undefined)));
  } catch {
    /* install still succeeds with shell files */
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.allSettled(PRECACHE.map((url) => cache.add(url)));
      await precacheAssetsFromIndex(cache);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API / auth traffic  WebPOS offline uses IndexedDB instead.
  if (url.pathname.startsWith('/api')) return;

  // Navigations: network-first; keep all in-scope SPA routes inside the installed window.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(request);
          if (res.ok && res.type === 'basic') {
            const cache = await caches.open(CACHE);
            await cachePutSafe(cache, '/index.html', res.clone());
            if (isAppNavigation(url.pathname)) {
              await cachePutSafe(cache, request, res.clone());
              await cachePutSafe(cache, new Request(url.pathname), res.clone());
            }
            void precacheAssetsFromIndex(cache);
          }
          return res;
        } catch {
          const cache = await caches.open(CACHE);
          const cachedRoute = await cache.match(request);
          if (cachedRoute) return cachedRoute;
          const cachedPath = await cache.match(new Request(url.pathname));
          if (cachedPath) return cachedPath;
          if (isAppNavigation(url.pathname)) {
            const shell = await navigationFallback();
            if (shell) return shell;
          }
          return (await cache.match('/offline.html')) || (await navigationFallback());
        }
      })()
    );
    return;
  }

  // Hashed build assets: network-first so deploys never serve stale JS/CSS (blank POS after update).
  if (isCacheableAsset(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        try {
          const res = await fetch(request);
          if (res.ok) {
            await cachePutSafe(cache, request, res.clone());
          }
          return res;
        } catch {
          const cached = await cache.match(request);
          if (cached) return cached;
          throw new Error('offline');
        }
      })()
    );
  }
});
