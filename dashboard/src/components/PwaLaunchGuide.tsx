import { useEffect, useState } from 'react';
import { ExternalLink, Smartphone, X } from 'lucide-react';
import { isAndroidDevice } from '@/lib/print-agent-platform';
import {
  isBrowserPreferredForWebPos,
  isLaunchGuideDismissed,
  isRebornPwaInstalled,
  isStandalonePwa,
  JUST_INSTALLED_KEY,
  markBrowserPreferredForWebPos,
  markLaunchGuideDismissed,
  openInstalledRebornPwa,
  PWA_OPEN_IN_APP_MARK,
} from '@/lib/pwa';

function isPosLikePath(): boolean {
  if (typeof window === 'undefined') return false;
  return /\/merchant\/(pos|waiter|order-center|order-hub)(\/|$)/.test(window.location.pathname);
}

/** Bottom banner: "Open in app" when Reborn PWA is installed but the user is in Chrome. */
export default function PwaLaunchGuide() {
  const [open, setOpen] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isPosLikePath()) return;
    if (isBrowserPreferredForWebPos()) return;

    let cancelled = false;
    void (async () => {
      if (isStandalonePwa()) {
        try {
          sessionStorage.removeItem(JUST_INSTALLED_KEY);
        } catch {
          /* ignore */
        }
        return;
      }

      let show = false;
      try {
        show = sessionStorage.getItem(JUST_INSTALLED_KEY) === '1';
      } catch {
        /* ignore */
      }

      if (!show && isAndroidDevice()) {
        if (isLaunchGuideDismissed()) return;
        const installed = await isRebornPwaInstalled();
        if (!cancelled && installed) show = true;
      }

      if (!cancelled && show) {
        setJustInstalled(sessionStorage.getItem(JUST_INSTALLED_KEY) === '1');
        setOpen(true);
      }
    })();

    const onInstalled = () => {
      setJustInstalled(true);
      setOpen(true);
    };
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      cancelled = true;
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!open) return null;

  const openInApp = () => {
    try {
      sessionStorage.removeItem(JUST_INSTALLED_KEY);
    } catch {
      /* ignore */
    }
    openInstalledRebornPwa();
  };

  const continueInChrome = () => {
    try {
      sessionStorage.removeItem(JUST_INSTALLED_KEY);
    } catch {
      /* ignore */
    }
    markBrowserPreferredForWebPos();
    setOpen(false);
  };

  const dismissBanner = () => {
    try {
      sessionStorage.removeItem(JUST_INSTALLED_KEY);
    } catch {
      /* ignore */
    }
    markLaunchGuideDismissed();
    setOpen(false);
  };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[200] flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      data-pwa-banner={PWA_OPEN_IN_APP_MARK}
    >
      <div
        role="dialog"
        aria-modal="false"
        aria-label={justInstalled ? 'Reborn installed' : 'Open Reborn in app'}
        className="flex w-full max-w-lg items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 shadow-2xl"
      >
        <Smartphone className="h-6 w-6 shrink-0 text-teal-600" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--text)]">
            {justInstalled ? 'Reborn installed' : 'Open in app'}
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            {justInstalled
              ? 'Tap Open in app to switch to the home-screen app.'
              : 'Reborn is installed on this device. Open the app for the best POS experience.'}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row sm:items-center">
          <button type="button" className="btn-primary px-3 py-1.5 text-sm" onClick={openInApp}>
            <ExternalLink className="mr-1 inline h-4 w-4" aria-hidden />
            Open in app
          </button>
          {!justInstalled ? (
            <button
              type="button"
              className="btn-ghost px-2 py-1 text-xs text-[var(--text-muted)]"
              onClick={continueInChrome}
            >
              Continue in Chrome
            </button>
          ) : (
            <button
              type="button"
              className="btn-ghost px-2 py-1 text-xs text-[var(--text-muted)]"
              onClick={dismissBanner}
            >
              Not now
            </button>
          )}
        </div>
        <button
          type="button"
          className="shrink-0 rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--bg-muted)]"
          aria-label="Dismiss"
          onClick={justInstalled ? dismissBanner : continueInChrome}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
