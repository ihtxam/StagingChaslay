/** Per-tab WebPOS location lock — independent of admin panel `manupos_selected_location`. */

const SESSION_KEY = 'webpos_terminal_location_id';

export function isWebPosFloorPath(pathname: string): boolean {
  const path = pathname.replace(/\/$/, '') || '/merchant';
  return path === '/merchant/pos' || path === '/merchant/waiter' || path.startsWith('/merchant/pos/');
}

export function readTerminalLocationIdFromUrl(search = ''): string | null {
  if (typeof window === 'undefined' && !search) return null;
  const q =
    search ||
    (typeof window !== 'undefined' ? window.location.search : '');
  const p = new URLSearchParams(q.startsWith('?') ? q : `?${q}`);
  const id = (p.get('loc_id') || p.get('locationId') || '').trim();
  return id || null;
}

export function getWebPosTerminalLocationId(): string | null {
  try {
    const fromUrl = readTerminalLocationIdFromUrl();
    if (fromUrl) {
      sessionStorage.setItem(SESSION_KEY, fromUrl);
      return fromUrl;
    }
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function setWebPosTerminalLocationId(id: string | null): void {
  try {
    if (!id) sessionStorage.removeItem(SESSION_KEY);
    else sessionStorage.setItem(SESSION_KEY, id);
  } catch {
    /* ignore */
  }
  if (typeof window === 'undefined' || !id) return;
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('loc_id', id);
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  } catch {
    /* ignore */
  }
}

/** Apply `?loc_id=` from the launch URL into session storage (call once on POS mount). */
export function syncWebPosTerminalLocationFromUrl(): string | null {
  const fromUrl = readTerminalLocationIdFromUrl();
  if (fromUrl) setWebPosTerminalLocationId(fromUrl);
  return getWebPosTerminalLocationId();
}

export function buildWebPosLaunchPath(locationId: string, base = '/merchant/pos'): string {
  const id = String(locationId || '').trim();
  if (!id) return base;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}loc_id=${encodeURIComponent(id)}`;
}
