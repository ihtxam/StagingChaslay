/** Customer shop storefronts must not use the Reborn POS PWA / offline shell. */

const PANEL_PREFIXES = ['app.', 'admin.', 'api.', 'pay.', 'status.'];
const PLATFORM_SUBDOMAINS = new Set(['app', 'admin', 'api', 'order', 'shop', 'pay', 'status', 'www']);

export function isShopStorefrontHost(
  hostname = typeof window !== 'undefined' ? window.location.hostname : '',
  pathname = typeof window !== 'undefined' ? window.location.pathname : ''
): boolean {
  const host = String(hostname || '').toLowerCase().split(':')[0] || '';
  const path = String(pathname || '');
  if (/^\/shop(\/|$)/.test(path)) return true;
  if (host.startsWith('shop.')) return true;
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
