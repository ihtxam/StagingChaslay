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

export const PWA_INSTALLED_KEY = 'reborn_pwa_installed';
export const BRIDGE_INSTALLED_KEY = 'reborn_bridge_installed';
export const BROWSER_PREFERRED_KEY = 'reborn_pwa_browser_preferred';
export const GUIDE_DISMISSED_KEY = 'reborn_pwa_launch_guide_dismissed';
export const JUST_INSTALLED_KEY = 'reborn_pwa_just_installed';
const SESSION_SUPPRESS_KEY = 'reborn_install_prompt_suppressed';

/** Android WebPOS is designed for Chrome + Bridge — never nag for a second PWA install. */
export function isAndroidTabletBrowser(userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''): boolean {
  return /android/i.test(userAgent);
}

export function isPosLikePath(pathname = typeof window !== 'undefined' ? window.location.pathname : ''): boolean {
  return /\/merchant\/(pos|waiter|order-center|order-hub)(\/|$)/.test(pathname);
}

export function isKioskPath(pathname = typeof window !== 'undefined' ? window.location.pathname : ''): boolean {
  return /^\/kiosk(\/|$)/.test(pathname);
}

export type InstallPromptStorage = {
  pwaInstalled?: boolean;
  bridgeInstalled?: boolean;
  browserPreferred?: boolean;
  guideDismissed?: boolean;
};

/** Pure install-suppression rules (unit-tested). */
export function shouldSuppressRebornInstallPromptSync(
  opts: InstallPromptStorage & {
    standalone?: boolean;
    kioskPath?: boolean;
    androidPosBrowser?: boolean;
    sessionSuppressed?: boolean;
  }
): boolean {
  if (opts.kioskPath) return false;
  if (opts.standalone) return true;
  if (opts.sessionSuppressed) return true;
  if (opts.pwaInstalled) return true;
  if (opts.bridgeInstalled) return true;
  if (opts.browserPreferred) return true;
  if (opts.guideDismissed) return true;
  if (opts.androidPosBrowser) return true;
  return false;
}

function readStorageFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeStorageFlag(key: string): void {
  try {
    localStorage.setItem(key, '1');
  } catch {
    /* private mode */
  }
}

function readSessionFlag(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeSessionFlag(key: string): void {
  try {
    sessionStorage.setItem(key, '1');
  } catch {
    /* ignore */
  }
}

export function isBrowserPreferredForWebPos(): boolean {
  return readStorageFlag(BROWSER_PREFERRED_KEY);
}

export function isLaunchGuideDismissed(): boolean {
  return readStorageFlag(GUIDE_DISMISSED_KEY);
}

/** Persist "continue in Chrome" and stop all install prompts. */
export function markBrowserPreferredForWebPos(): void {
  writeStorageFlag(BROWSER_PREFERRED_KEY);
  writeStorageFlag(GUIDE_DISMISSED_KEY);
  writeSessionFlag(SESSION_SUPPRESS_KEY);
  removeInstallManifestIfNeeded();
}

export function markLaunchGuideDismissed(): void {
  writeStorageFlag(GUIDE_DISMISSED_KEY);
  writeSessionFlag(SESSION_SUPPRESS_KEY);
  removeInstallManifestIfNeeded();
}

export function markRebornPwaInstalled(): void {
  writeStorageFlag(PWA_INSTALLED_KEY);
  writeSessionFlag(SESSION_SUPPRESS_KEY);
  removeInstallManifestIfNeeded();
}

export function markBridgeRebornInstalled(): void {
  writeStorageFlag(BRIDGE_INSTALLED_KEY);
  writeSessionFlag(SESSION_SUPPRESS_KEY);
  removeInstallManifestIfNeeded();
}

export function removeInstallManifestIfNeeded(): void {
  if (typeof document === 'undefined') return;
  if (isKioskPath()) return;
  document.querySelector('link[rel="manifest"]')?.remove();
}

function currentSuppressContext(): InstallPromptStorage & {
  standalone: boolean;
  kioskPath: boolean;
  androidPosBrowser: boolean;
  sessionSuppressed: boolean;
} {
  const standalone = isStandalonePwa();
  const kioskPath = isKioskPath();
  const androidPosBrowser =
    isAndroidTabletBrowser() && isPosLikePath() && !standalone && !kioskPath;
  return {
    standalone,
    kioskPath,
    androidPosBrowser,
    sessionSuppressed: readSessionFlag(SESSION_SUPPRESS_KEY),
    pwaInstalled: readStorageFlag(PWA_INSTALLED_KEY),
    bridgeInstalled: readStorageFlag(BRIDGE_INSTALLED_KEY),
    browserPreferred: readStorageFlag(BROWSER_PREFERRED_KEY),
    guideDismissed: readStorageFlag(GUIDE_DISMISSED_KEY),
  };
}

function shouldSuppressRebornInstallPrompt(): boolean {
  return shouldSuppressRebornInstallPromptSync(currentSuppressContext());
}

/** Bridge Reborn APK responding on localhost:9101 (Android WebPOS companion). */
export async function isBridgeRebornInstalled(): Promise<boolean> {
  if (!isAndroidTabletBrowser()) return false;
  if (readStorageFlag(BRIDGE_INSTALLED_KEY)) return true;
  try {
    const res = await fetch('http://127.0.0.1:9101/health', { method: 'GET' });
    if (!res.ok) return false;
    const data = (await res.json()) as { ok?: boolean; platform?: string };
    const installed = data.ok === true && data.platform === 'android';
    if (installed) markBridgeRebornInstalled();
    return installed;
  } catch {
    return readStorageFlag(BRIDGE_INSTALLED_KEY);
  }
}

/** Chrome/Android may open an installed PWA in a normal browser tab — detect that case. */
export async function isRebornPwaInstalled(): Promise<boolean> {
  if (isStandalonePwa()) return true;
  if (readStorageFlag(PWA_INSTALLED_KEY)) return true;
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
    if (installed) markRebornPwaInstalled();
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
    markRebornPwaInstalled();
    return;
  }
  if (readStorageFlag(BRIDGE_INSTALLED_KEY)) bridgeInstalledCache = true;
  if (readStorageFlag(PWA_INSTALLED_KEY)) rebornPwaInstalledCache = true;
  if (shouldSuppressRebornInstallPrompt()) removeInstallManifestIfNeeded();

  void isRebornPwaInstalled().then((installed) => {
    rebornPwaInstalledCache = installed;
    if (installed) removeInstallManifestIfNeeded();
  });
  if (isAndroidTabletBrowser()) {
    void isBridgeRebornInstalled().then((installed) => {
      bridgeInstalledCache = installed;
      if (installed) removeInstallManifestIfNeeded();
    });
  }
}

/**
 * Stop Chrome from re-prompting to install when Reborn is already on the home screen,
 * Bridge Reborn is installed, or the merchant chose to keep using Chrome.
 */
export function bindRebornPwaInstallGuard(): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const onBip = (event: Event) => {
    if (isKioskPath()) return;
    if (rebornPwaInstalledCache === true || bridgeInstalledCache === true) {
      event.preventDefault();
      writeSessionFlag(SESSION_SUPPRESS_KEY);
      return;
    }
    if (!shouldSuppressRebornInstallPrompt()) return;
    event.preventDefault();
    writeSessionFlag(SESSION_SUPPRESS_KEY);
  };

  const onInstalled = () => {
    rebornPwaInstalledCache = true;
    try {
      localStorage.setItem(PWA_INSTALLED_KEY, '1');
      sessionStorage.setItem(JUST_INSTALLED_KEY, '1');
      sessionStorage.setItem(SESSION_SUPPRESS_KEY, '1');
    } catch {
      /* ignore */
    }
    removeInstallManifestIfNeeded();
  };

  window.addEventListener('beforeinstallprompt', onBip, { capture: true });
  window.addEventListener('appinstalled', onInstalled);
  return () => {
    window.removeEventListener('beforeinstallprompt', onBip, { capture: true });
    window.removeEventListener('appinstalled', onInstalled);
  };
}
