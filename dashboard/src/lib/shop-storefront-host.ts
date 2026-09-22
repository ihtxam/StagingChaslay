/** Customer shop storefronts must not use the Reborn POS PWA / offline shell. */

const PANEL_PREFIXES = ['app.', 'admin.', 'api.', 'pay.', 'status.'];
/** Runtime fallbacks aligned with `isShopPathHubHost` in brand.ts (path shops at /{slug}). */
const SHOP_PATH_HUB_HOSTS = new Set(['order.rebornsense.com', 'shop.chaslay.com']);
const PLATFORM_SUBDOMAINS = new Set(['app', 'admin', 'api', 'order', 'shop', 'pay', 'status', 'www']);

const SHOP_CUSTOMER_SEGMENTS =
  'menu|checkout|order|account|gift-cards|gift|reservations|table|register|forgot-password|pages';

/** True when the current URL is a customer shop surface (not merchant panel). */
export function isShopCustomerSurface(
  pathname = typeof window !== 'undefined' ? window.location.pathname : '',
  hostname = typeof window !== 'undefined' ? window.location.hostname : ''
): boolean {
  const path = String(pathname || '');
  if (/^\/shop\/[^/]+(\/|$)/.test(path)) return true;
  if (new RegExp(`/(?:${SHOP_CUSTOMER_SEGMENTS})(?:/|$)`).test(path)) return true;
  if (new RegExp(`^/[^/]+/(?:${SHOP_CUSTOMER_SEGMENTS})(?:/|$)`).test(path)) return true;
  return isShopStorefrontHost(hostname, path);
}

export function isShopStorefrontHost(
  hostname = typeof window !== 'undefined' ? window.location.hostname : '',
  pathname = typeof window !== 'undefined' ? window.location.pathname : ''
): boolean {
  const host = String(hostname || '').toLowerCase().split(':')[0] || '';
  const path = String(pathname || '');
  if (/^\/shop(\/|$)/.test(path)) return true;
  // Path shops: order.rebornsense.com/{slug}, shop.chaslay.com/{slug}
  if (host.startsWith('shop.') || SHOP_PATH_HUB_HOSTS.has(host)) return true;
  if (PANEL_PREFIXES.some((prefix) => host.startsWith(prefix))) return false;
  if (host === 'localhost' || host === '127.0.0.1') return false;
  if (host.endsWith('.chaslay.com') || host.endsWith('.rebornsense.com')) {
    const sub = host.split('.')[0];
    return !PLATFORM_SUBDOMAINS.has(sub);
  }
  return true;
}

export async function unregisterRebornShellOnShop(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!isShopStorefrontHost()) return;
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((reg) => reg.unregister()));
    }
  } catch {
    /* ignore */
  }
  try {
    if (typeof caches !== 'undefined') {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key.startsWith('reborn-shell')).map((key) => caches.delete(key))
      );
    }
  } catch {
    /* ignore */
  }
}
