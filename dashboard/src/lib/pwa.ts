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
    const installed = related.some((app) => {
      if (app.platform !== 'webapp') return false;
      const url = String(app.url || '');
      const id = String(app.id || '');
      return (
        url.includes('manifest.webmanifest') ||
        id === '/' ||
        id.endsWith('/') ||
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
  void isRebornPwaInstalled().then((installed) => {
    rebornPwaInstalledCache = installed;
  });
}

function shouldSuppressRebornInstallPrompt(): boolean {
  if (isStandalonePwa()) return true;
  if (rebornPwaInstalledCache === true) return true;
  try {
    return localStorage.getItem(PWA_INSTALLED_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Stop Chrome from re-prompting to install when Reborn is already on the home screen
 * but the merchant opened a browser tab (common on Android tablets).
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
    } catch {
      /* ignore */
    }
  };

  window.addEventListener('beforeinstallprompt', onBip);
  window.addEventListener('appinstalled', onInstalled);
  return () => {
    window.removeEventListener('beforeinstallprompt', onBip);
    window.removeEventListener('appinstalled', onInstalled);
  };
}
