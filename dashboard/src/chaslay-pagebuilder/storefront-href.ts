/** Prefix internal shop links with the storefront base path (e.g. /shop/my-cafe). */

export type StorefrontSurface = 'home' | 'shop';

function stripOrigin(path: string): string {
  if (!/^https?:\/\//i.test(path)) return path;
  try {
    const url = new URL(path);
    return url.pathname + (url.hash || '');
  } catch {
    return path;
  }
}

function pathOnly(link: string): string {
  const raw = String(link || '').trim();
  const withoutOrigin = stripOrigin(raw);
  const path = withoutOrigin.split(/[?#]/)[0].replace(/\/+$/, '');
  if (!path) return withoutOrigin.startsWith('#') ? withoutOrigin : '/';
  return path;
}

/** Whether a CMS/nav link should open the shop ordering menu. */
export function isShopMenuNavLink(link: string | undefined | null): boolean {
  const raw = String(link || '').trim();
  if (!raw) return false;
  const lower = raw.toLowerCase();
  if (lower === '#menu') return true;
  const path = pathOnly(lower);
  if (path === '/menu' || path.endsWith('/menu')) return true;
  if (path === '/order' || path === '/order-now' || path === '/ordernow') return true;
  if (path.endsWith('/order') && !path.includes('/order/')) return true;
  return false;
}

/** Whether a CMS/nav link points at the storefront homepage. */
export function isHomeNavLink(link: string | undefined | null): boolean {
  const raw = String(link || '').trim().toLowerCase();
  if (raw === '#home') return true;
  if (!raw || raw === '#') return false;
  const path = pathOnly(raw);
  return path === '/' || path === '/home';
}

export function resolveStorefrontHref(
  link: string | undefined | null,
  basePath: string,
  isStorefront: boolean,
  opts?: { surface?: StorefrontSurface }
): string {
  const raw = String(link || '').trim();
  if (!raw || raw === '#') return raw || '#';
  if (!isStorefront || !basePath) return raw;
  if (/^(mailto:|tel:)/i.test(raw)) return raw;
  if (/^https?:\/\//i.test(raw) && !isShopMenuNavLink(raw) && !isHomeNavLink(raw)) return raw;

  const surface: StorefrontSurface = opts?.surface || 'home';
  const menuUrl = `${basePath}/menu`;

  if (isShopMenuNavLink(raw)) return menuUrl;

  if (raw.startsWith('#')) {
    if (raw.toLowerCase() === '#home') {
      return surface === 'shop' ? basePath || '/' : raw;
    }
    if (surface === 'shop') return `${basePath}${raw}`;
    return raw;
  }

  if (basePath && (raw === basePath || raw.startsWith(`${basePath}/`))) return raw;

  if (raw.startsWith('/')) {
    if (raw === '/' || raw === '/home') return basePath || '/';
    if (raw.startsWith('/pages/')) return `${basePath}${raw}`;
    return `${basePath}${raw}`;
  }
  if (raw.startsWith('pages/')) return `${basePath}/${raw}`;
  return `${basePath}/${raw}`;
}
