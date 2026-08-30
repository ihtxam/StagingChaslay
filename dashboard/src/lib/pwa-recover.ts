/** Recover installed WebPOS / dashboard PWAs after a bad deploy or stale service-worker cache. */

const STALE_RECOVER_KEY = 'webpos_stale_recover_at';
const STALE_RECOVER_COOLDOWN_MS = 45_000;

const STALE_ERROR_RE =
  /Failed to fetch dynamically imported module|Importing a module script failed|Unexpected token|is not a function|is not defined|Cannot read propert/i;

export function isStandalonePwaSession(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  if (nav.standalone) return true;
  return ['fullscreen', 'standalone', 'minimal-ui'].some((mode) =>
    window.matchMedia(`(display-mode: ${mode})`).matches
  );
}

export function looksLikeStaleBundleError(error: unknown): boolean {
  const msg =
    error instanceof Error
      ? `${error.message}\n${error.stack || ''}`
      : String(error ?? '');
  return STALE_ERROR_RE.test(msg);
}

async function clearShellCaches(): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  } catch {
    /* ignore */
  }
}

/** One-shot: unregister SW, drop shell caches, hard reload (avoids infinite loops). */
export async function recoverStaleWebPosBundle(reason?: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const last = Number(sessionStorage.getItem(STALE_RECOVER_KEY) || '0');
    if (last && Date.now() - last < STALE_RECOVER_COOLDOWN_MS) return false;
    sessionStorage.setItem(STALE_RECOVER_KEY, String(Date.now()));
  } catch {
    return false;
  }

  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch {
    /* continue to cache clear + reload */
  }

  await clearShellCaches();

  const url = new URL(window.location.href);
  url.searchParams.set('webpos_recover', String(Date.now()));
  if (reason) url.searchParams.set('webpos_recover_reason', reason.slice(0, 80));
  window.location.replace(url.toString());
  return true;
}

/** Prompt a waiting service worker to activate so network-first assets load on next navigation. */
export async function activateWaitingServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return;
    await reg.update();
    const waiting = reg.waiting;
    if (waiting) {
      waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  } catch {
    /* best-effort */
  }
}
