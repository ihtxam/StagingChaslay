/**
 * Shop-only Order Center vs WebPOS routing.
 * Keep this free of React so redirect-loop cases stay unit-tested.
 */

export function normalizeMerchantPath(path: string): string {
  return path.split('?')[0].replace(/\/$/, '') || '/merchant';
}

export function isOrderCenterPath(path: string): boolean {
  const normalized = normalizeMerchantPath(path);
  return normalized === '/merchant/order-center' || normalized === '/merchant/order-hub';
}

export function isWebPosPath(path: string): boolean {
  const normalized = normalizeMerchantPath(path);
  return normalized === '/merchant/pos' || normalized.startsWith('/merchant/pos/');
}

/**
 * When a guarded page is denied, send the user to their login home.
 * Returning null means "stay put" — never bounce to /pos just because home === current
 * (that loop is Order Center ↔ WebPOS on shop-only Android tablets).
 */
export function resolveDeniedRouteFallback(opts: {
  currentPath: string;
  homePath: string;
}): string | null {
  const current = normalizeMerchantPath(opts.currentPath);
  const home = normalizeMerchantPath(opts.homePath);
  if (!home || home === current) return null;
  return home;
}

/** Order Center operators (and shop-only tablets) must not wait on product-flag fetch. */
export function allowOrderCenterRoute(opts: {
  showOrderCenter: boolean;
  productFlagsReady: boolean;
  isOrderCenterOnlyStaff: boolean;
}): boolean {
  if (opts.isOrderCenterOnlyStaff) return true;
  if (!opts.productFlagsReady) return true;
  return opts.showOrderCenter;
}

/**
 * Shop-only merchants have no till. Bridge / PWA start_url still opens /merchant/pos —
 * send them to Order Center (or the panel) instead of leaving WebPOS mounted.
 */
export function resolveMissingPosRedirect(opts: {
  hasPos: boolean;
  showOrderCenter: boolean;
  productFlagsReady: boolean;
}): string | null {
  if (!opts.productFlagsReady || opts.hasPos) return null;
  return opts.showOrderCenter ? '/merchant/order-center' : '/merchant';
}

const BRIDGE_APP_PATHS = new Set([
  '/merchant/pos',
  '/merchant/waiter',
  '/merchant/order-center',
  '/merchant/order-hub',
  '/merchant/storekeeper',
  '/merchant/kiosk',
  '/merchant/delivery/driver',
]);

/** Safe path for Android Bridge to reopen after setup (never a full URL). */
export function sanitizeBridgeWebAppPath(raw: unknown): string {
  const path = normalizeMerchantPath(String(raw || ''));
  if (BRIDGE_APP_PATHS.has(path)) return path;
  if (path.startsWith('/merchant/pos/')) return '/merchant/pos';
  return '/merchant/pos';
}
