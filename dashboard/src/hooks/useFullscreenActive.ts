import { useEffect, useState } from 'react';

/** Browser Fullscreen API element is active. */
export function isDocumentFullscreen(): boolean {
  return typeof document !== 'undefined' && !!document.fullscreenElement;
}

/** Installed PWA with manifest display:fullscreen (kiosk-sized window). */
export function isPwaDisplayFullscreen(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: fullscreen)').matches;
}

/** True when the app is in a kiosk-like fullscreen (browser FS or PWA display mode). */
export function isKioskFullscreen(): boolean {
  return isDocumentFullscreen() || isPwaDisplayFullscreen();
}

export function useFullscreenActive(): boolean {
  const [active, setActive] = useState(() => isKioskFullscreen());

  useEffect(() => {
    const refresh = () => setActive(isKioskFullscreen());
    document.addEventListener('fullscreenchange', refresh);
    const mq = window.matchMedia('(display-mode: fullscreen)');
    mq.addEventListener('change', refresh);
    refresh();
    return () => {
      document.removeEventListener('fullscreenchange', refresh);
      mq.removeEventListener('change', refresh);
    };
  }, []);

  return active;
}
