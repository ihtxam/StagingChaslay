import { useEffect, useState } from 'react';
import {
  DEFAULT_DESKTOP_BRANDING,
  fetchPublicDesktopBranding,
  type DesktopBranding,
} from '@/lib/desktop-branding';
import { isDesktopApp, notifyDesktopAppReady } from '@/lib/platform';

function applyBrandingToBootOverlay(branding: DesktopBranding) {
  const root = document.getElementById('reborn-desktop-boot');
  if (!root) return;
  root.style.background = branding.backgroundColor;
  const img = root.querySelector('img');
  if (img) {
    img.src = branding.splashUrl;
    img.alt = branding.appName;
  }
  const tagline = root.querySelector('p');
  if (tagline) tagline.textContent = branding.tagline;
}

export default function DesktopLoadingOverlay() {
  const [branding, setBranding] = useState<DesktopBranding>(DEFAULT_DESKTOP_BRANDING);
  const [showFallback, setShowFallback] = useState(
    () => isDesktopApp() && !document.getElementById('reborn-desktop-boot'),
  );

  useEffect(() => {
    if (!isDesktopApp()) return;
    void fetchPublicDesktopBranding()
      .then((next) => {
        setBranding(next);
        applyBrandingToBootOverlay(next);
      })
      .catch(() => undefined);
  }, []);

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
      className="desktop-loading-overlay fixed inset-0 z-[180] flex flex-col items-center justify-center gap-5 text-[#faf8f3]"
      style={{ background: branding.backgroundColor }}
      role="status"
      aria-live="polite"
      aria-label={`Loading ${branding.appName}`}
    >
      <img
        src={branding.splashUrl}
        alt={branding.appName}
        className="h-auto w-[min(220px,70vw)] select-none"
        draggable={false}
      />
      <p className="text-sm tracking-wide opacity-80">{branding.tagline}</p>
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/90"
        aria-hidden="true"
      />
    </div>
  );
}
