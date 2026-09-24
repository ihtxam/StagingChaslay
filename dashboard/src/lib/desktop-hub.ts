/**
 * RebornPOS desktop shell — basic merchant tools only.
 * Advanced panel (CMS, payments, users, …) stays on the web back office.
 */

export const DESKTOP_HUB_NAV = [
  { id: 'pos', path: '/merchant/pos', labelKey: 'desktopHubPos' as const },
  { id: 'products', path: '/merchant/products', labelKey: 'products' as const },
  { id: 'categories', path: '/merchant/categories', labelKey: 'categories' as const },
  { id: 'reports', path: '/merchant/reports', labelKey: 'reports' as const },
  { id: 'store', path: '/merchant/desktop/store', labelKey: 'desktopHubStore' as const },
  { id: 'timings', path: '/merchant/desktop/timings', labelKey: 'desktopHubTimings' as const },
  { id: 'settings', path: '/merchant/desktop-settings', labelKey: 'settings' as const },
] as const;

const DESKTOP_ALLOWED_EXACT = new Set([
  '/login',
  '/merchant/pos',
  '/merchant/waiter',
  '/merchant/products',
  '/merchant/categories',
  '/merchant/reports',
  '/merchant/desktop-settings',
  '/merchant/desktop/store',
  '/merchant/desktop/timings',
]);

const DESKTOP_ALLOWED_PREFIXES = [
  '/merchant/products/',
  '/merchant/categories/',
];

/** Routes the desktop webview may open (POS + basic hub). */
export function isDesktopAppAllowedRoute(pathname: string): boolean {
  const path = normalizeDesktopPath(pathname);
  if (DESKTOP_ALLOWED_EXACT.has(path)) return true;
  return DESKTOP_ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/** Hub pages that hide the full merchant sidebar (not POS fullscreen). */
export function isDesktopHubPanelRoute(pathname: string): boolean {
  const path = normalizeDesktopPath(pathname);
  return (
    path === '/merchant/products' ||
    path.startsWith('/merchant/products/') ||
    path === '/merchant/categories' ||
    path.startsWith('/merchant/categories/') ||
    path === '/merchant/reports' ||
    path === '/merchant/desktop-settings' ||
    path === '/merchant/desktop/store' ||
    path === '/merchant/desktop/timings'
  );
}

export function normalizeDesktopPath(pathname: string): string {
  const raw = String(pathname || '').split('?')[0]?.split('#')[0] || '/merchant';
  const trimmed = raw.replace(/\/$/, '');
  return trimmed || '/merchant';
}

export function desktopHubRedirectTarget(pathname: string): string {
  const path = normalizeDesktopPath(pathname);
  if (path.startsWith('/merchant/reports')) return '/merchant/reports';
  if (path.startsWith('/merchant/products')) return '/merchant/products';
  if (path.startsWith('/merchant/categories')) return '/merchant/categories';
  if (path === '/merchant/settings' || path.startsWith('/merchant/settings')) {
    return '/merchant/desktop-settings';
  }
  return '/merchant/pos';
}

export function isDesktopHubNavActive(pathname: string, hubPath: string): boolean {
  const path = normalizeDesktopPath(pathname);
  const target = normalizeDesktopPath(hubPath);
  if (target === '/merchant/pos') return path === '/merchant/pos' || path === '/merchant/waiter';
  return path === target || path.startsWith(`${target}/`);
}
