/** True when the dashboard is running as an installed PWA (not a browser tab). */
export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  if (nav.standalone) return true;
  return ['fullscreen', 'standalone', 'minimal-ui'].some((mode) =>
    window.matchMedia(`(display-mode: ${mode})`).matches
  );
}

type RelatedWebApp = { platform: string; url?: string; id?: string };

const PWA_INSTALLED_KEY = 'reborn_pwa_installed';
const BRIDGE_INSTALLED_KEY = 'reborn_bridge_installed';

function isAndroidTabletBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /android/i.test(navigator.userAgent);
}

function isPosLikePath(pathname = typeof window !== 'undefined' ? window.location.pathname : ''): boolean {
  return /\/merchant\/(pos|waiter|order-center|order-hub)(\/|$)/.test(pathname);
}

/** Bridge Reborn APK responding on localhost:9101 (Android WebPOS companion). */
export async function isBridgeRebornInstalled(): Promise<boolean> {
  if (!isAndroidTabletBrowser()) return false;
  try {
    if (localStorage.getItem(BRIDGE_INSTALLED_KEY) === '1') return true;
  } catch {
    /* ignore */
  }
  try {
    const res = await fetch('http://127.0.0.1:9101/health', { method: 'GET' });
    if (!res.ok) return false;
    const data = (await res.json()) as { ok?: boolean; platform?: string };
    const installed = data.ok === true && data.platform === 'android';
    if (installed) {
      try {
        localStorage.setItem(BRIDGE_INSTALLED_KEY, '1');
      } catch {
        /* ignore */
      }
    }
    return installed;
  } catch {
    return false;
  }
}

/** Chrome/Android may open an installed PWA in a normal browser tab — detect that case. */
export async function isRebornPwaInstalled(): Promise<boolean> {
  if (isStandalonePwa()) return true;
  try {
    if (localStorage.getItem(PWA_INSTALLED_KEY) === '1') return true;
  } catch {
    /* private mode */
  }
  const nav = navigator as Navigator & { getInstalledRelatedApps?: () => Promise<RelatedWebApp[]> };
  if (!nav.getInstalledRelatedApps) return false;
  try {
    const related = await nav.getInstalledRelatedApps();
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const installed = related.some((app) => {
      if (app.platform !== 'webapp') return false;
      const url = String(app.url || '');
      const id = String(app.id || '');
      if (origin && url.startsWith(origin)) return true;
      return (
        url.includes('manifest.webmanifest') ||
        id === '/' ||
        id.endsWith('/') ||
        id.includes('rebornsense.com') ||
        id.includes('chaslay.com') ||
        url.includes('/merchant/pos')
      );
    });
    if (installed) {
      try {
        localStorage.setItem(PWA_INSTALLED_KEY, '1');
      } catch {
        /* ignore */
      }
    }
    return installed;
  } catch {
    return false;
  }
}

let rebornPwaInstalledCache: boolean | null = null;
let bridgeInstalledCache: boolean | null = null;

/** Warm install cache on boot so beforeinstallprompt can be suppressed synchronously. */
export function probeRebornPwaInstalled(): void {
  if (typeof window === 'undefined') return;
  if (isStandalonePwa()) {
    rebornPwaInstalledCache = true;
    try {
      localStorage.setItem(PWA_INSTALLED_KEY, '1');
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    if (localStorage.getItem(BRIDGE_INSTALLED_KEY) === '1') {
      bridgeInstalledCache = true;
    }
    if (localStorage.getItem(PWA_INSTALLED_KEY) === '1') {
      rebornPwaInstalledCache = true;
    }
  } catch {
    /* ignore */
  }
  void isRebornPwaInstalled().then((installed) => {
    rebornPwaInstalledCache = installed;
  });
  if (isAndroidTabletBrowser() && isPosLikePath()) {
    void isBridgeRebornInstalled().then((installed) => {
      bridgeInstalledCache = installed;
    });
  }
}

function shouldSuppressRebornInstallPrompt(): boolean {
  if (isStandalonePwa()) return true;
  if (rebornPwaInstalledCache === true || bridgeInstalledCache === true) return true;
  try {
    if (localStorage.getItem(PWA_INSTALLED_KEY) === '1') return true;
    if (localStorage.getItem(BRIDGE_INSTALLED_KEY) === '1') return true;
  } catch {
    return false;
  }
  return false;
}

/**
 * Stop Chrome from re-prompting to install when Reborn is already on the home screen
 * or Bridge Reborn is installed (Android tablets often use Chrome + Bridge, not a PWA tab).
 */
export function bindRebornPwaInstallGuard(): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const onBip = (event: Event) => {
    if (/^\/kiosk(\/|$)/.test(window.location.pathname)) return;
    if (!shouldSuppressRebornInstallPrompt()) return;
    event.preventDefault();
  };

  const onInstalled = () => {
    rebornPwaInstalledCache = true;
    try {
      localStorage.setItem(PWA_INSTALLED_KEY, '1');
      sessionStorage.setItem('reborn_pwa_just_installed', '1');
    } catch {
      /* ignore */
    }
    if (!isStandalonePwa() && typeof document !== 'undefined') {
      document.querySelector('link[rel="manifest"]')?.remove();
    }
  };

  window.addEventListener('beforeinstallprompt', onBip, { capture: true });
  window.addEventListener('appinstalled', onInstalled);
  return () => {
    window.removeEventListener('beforeinstallprompt', onBip, { capture: true });
    window.removeEventListener('appinstalled', onInstalled);
  };
}
