/** Kiosk PWA — stable install identity and launch token for /kiosk/ start_url. */

export const KIOSK_MANIFEST_HREF = '/kiosk.webmanifest';
export const KIOSK_LAUNCH_TOKEN_KEY = 'reborn_kiosk_launch_token';
export const KIOSK_INSTALL_HINT_DISMISSED_KEY = 'reborn_kiosk_install_hint_dismissed';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let deferredKioskInstall: BeforeInstallPromptEvent | null = null;

export function isKioskPath(pathname = typeof window !== 'undefined' ? window.location.pathname : ''): boolean {
  return /^\/kiosk(\/|$)/.test(pathname);
}

/** True when the kiosk is running as an installed PWA (not a browser tab). */
export function isKioskStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  if (nav.standalone) return true;
  return ['fullscreen', 'standalone', 'minimal-ui'].some((mode) =>
    window.matchMedia(`(display-mode: ${mode})`).matches
  );
}

export function saveKioskLaunchToken(token: string): void {
  const trimmed = token.trim();
  if (!trimmed) return;
  try {
    localStorage.setItem(KIOSK_LAUNCH_TOKEN_KEY, trimmed);
  } catch {
    /* private mode */
  }
}

export function readKioskLaunchToken(): string | null {
  try {
    const v = localStorage.getItem(KIOSK_LAUNCH_TOKEN_KEY);
    return v?.trim() || null;
  } catch {
    return null;
  }
}

export function dismissKioskInstallHint(): void {
  try {
    localStorage.setItem(KIOSK_INSTALL_HINT_DISMISSED_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function isKioskInstallHintDismissed(): boolean {
  try {
    return localStorage.getItem(KIOSK_INSTALL_HINT_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

/** Swap the page manifest to the kiosk-specific one (stable id / scope). */
export function ensureKioskManifest(): () => void {
  if (typeof document === 'undefined') return () => undefined;

  const existing = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  const prevHref = existing?.getAttribute('href') ?? null;

  let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"][data-kiosk-pwa]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'manifest';
    link.dataset.kioskPwa = '1';
    document.head.appendChild(link);
  }
  link.href = KIOSK_MANIFEST_HREF;

  if (existing && existing !== link) {
    existing.remove();
  }

  const theme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  const prevTheme = theme?.getAttribute('content') ?? null;
  theme?.setAttribute('content', '#059669');

  const appName = document.querySelector<HTMLMetaElement>('meta[name="application-name"]');
  const prevAppName = appName?.getAttribute('content') ?? null;
  appName?.setAttribute('content', 'Reborn Kiosk');

  const appleTitle = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
  const prevAppleTitle = appleTitle?.getAttribute('content') ?? null;
  appleTitle?.setAttribute('content', 'Kiosk');

  return () => {
    link?.remove();
    if (prevHref) {
      const restore = document.createElement('link');
      restore.rel = 'manifest';
      restore.href = prevHref;
      document.head.appendChild(restore);
    }
    if (prevTheme != null) theme?.setAttribute('content', prevTheme);
    if (prevAppName != null) appName?.setAttribute('content', prevAppName);
    if (prevAppleTitle != null) appleTitle?.setAttribute('content', prevAppleTitle);
  };
}

export function bindKioskInstallPrompt(): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const onBip = (event: Event) => {
    if (!isKioskPath()) return;
    event.preventDefault();
    if (isKioskStandalone() || isKioskInstallHintDismissed()) return;
    void isKioskPwaInstalled().then((installed) => {
      if (installed) return;
      deferredKioskInstall = event as BeforeInstallPromptEvent;
    });
  };

  window.addEventListener('beforeinstallprompt', onBip);
  return () => {
    window.removeEventListener('beforeinstallprompt', onBip);
    deferredKioskInstall = null;
  };
}

export function hasKioskInstallPrompt(): boolean {
  return deferredKioskInstall != null;
}

export async function promptKioskInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const prompt = deferredKioskInstall;
  if (!prompt) return 'unavailable';
  deferredKioskInstall = null;
  try {
    await prompt.prompt();
    const choice = await prompt.userChoice;
    return choice.outcome;
  } catch {
    return 'unavailable';
  }
}

type RelatedWebApp = { platform: string; url?: string; id?: string };

/** True when Chrome reports the kiosk PWA is already installed on this device. */
export async function isKioskPwaInstalled(): Promise<boolean> {
  if (isKioskStandalone()) return true;
  const nav = navigator as Navigator & { getInstalledRelatedApps?: () => Promise<RelatedWebApp[]> };
  if (!nav.getInstalledRelatedApps) return false;
  try {
    const related = await nav.getInstalledRelatedApps();
    return related.some((app) => {
      if (app.platform !== 'webapp') return false;
      const url = String(app.url || '');
      const id = String(app.id || '');
      return url.includes('kiosk.webmanifest') || id === '/kiosk' || id.endsWith('/kiosk');
    });
  } catch {
    return false;
  }
}
