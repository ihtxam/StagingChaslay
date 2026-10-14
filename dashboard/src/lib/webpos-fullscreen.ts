import { isAndroidTabletBrowser, isStandalonePwa } from '@/lib/pwa';

type FullscreenElementWithLegacy = HTMLElement & {
  webkitRequestFullscreen?: (options?: FullscreenOptions) => Promise<void>;
};

/**
 * Android installed PWAs often use display-mode:standalone while the manifest
 * requests fullscreen. The OS nav bar stays visible until the Fullscreen API runs
 * with navigationUI:hide — do not treat manifest fullscreen as immersive.
 */
export function androidPwaNeedsImmersiveFullscreen(): boolean {
  if (typeof window === 'undefined') return false;
  return isStandalonePwa() && isAndroidTabletBrowser();
}

/** Manifest / OS window is kiosk-sized (display-mode: fullscreen). */
export function isPwaDisplayFullscreen(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: fullscreen)').matches;
}

/** Skip redundant Fullscreen API only when the window is truly immersive. */
export function isPwaWindowAlreadyImmersive(): boolean {
  if (typeof document !== 'undefined' && document.fullscreenElement) return true;
  if (!isPwaDisplayFullscreen()) return false;
  return !androidPwaNeedsImmersiveFullscreen();
}

export async function requestImmersiveDocumentFullscreen(): Promise<boolean> {
  if (typeof document === 'undefined') return false;
  if (document.fullscreenElement) return true;
  const el = document.documentElement as FullscreenElementWithLegacy;
  const hideNav: FullscreenOptions = { navigationUI: 'hide' };
  const useHideNav = androidPwaNeedsImmersiveFullscreen();

  const tryRequest = async (options?: FullscreenOptions) => {
    if (el.requestFullscreen) {
      await el.requestFullscreen(options);
      return;
    }
    if (el.webkitRequestFullscreen) {
      await el.webkitRequestFullscreen(options);
    }
  };

  try {
    if (useHideNav) {
      await tryRequest(hideNav);
    } else {
      await tryRequest();
    }
    return !!document.fullscreenElement;
  } catch {
    if (useHideNav) {
      try {
        await tryRequest();
        return !!document.fullscreenElement;
      } catch {
        return false;
      }
    }
    return false;
  }
}
