import { useEffect, useState } from 'react';
import { APP_TAGLINE, REBORN_LOGO_WHITE } from '@/lib/brand';
import { isDesktopApp, notifyDesktopAppReady } from '@/lib/platform';

export default function DesktopLoadingOverlay() {
  const [showFallback, setShowFallback] = useState(
    () => isDesktopApp() && !document.getElementById('reborn-desktop-boot'),
  );

  useEffect(() => {
    if (!isDesktopApp()) return;

    const timer = window.setTimeout(() => {
      document.getElementById('reborn-desktop-boot')?.remove();
      setShowFallback(false);
      void notifyDesktopAppReady();
    }, 150);

    return () => window.clearTimeout(timer);
  }, []);

  if (!showFallback) return null;

  return (
    <div
      className="desktop-loading-overlay fixed inset-0 z-[180] flex flex-col items-center justify-center gap-5 bg-[#17252b] text-[#faf8f3]"
      role="status"
      aria-live="polite"
      aria-label="Loading RebornPOS"
    >
      <img
        src={REBORN_LOGO_WHITE}
        alt="RebornPOS"
        className="h-auto w-[min(220px,70vw)] select-none"
        draggable={false}
      />
      <p className="text-sm tracking-wide opacity-80">{APP_TAGLINE}</p>
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/90"
        aria-hidden="true"
      />
    </div>
  );
}
