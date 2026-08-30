import { useEffect, useState } from 'react';
import { Smartphone, X } from 'lucide-react';
import { isAndroidDevice } from '@/lib/print-agent-platform';
import { isRebornPwaInstalled, isStandalonePwa } from '@/lib/pwa';

const JUST_INSTALLED_KEY = 'reborn_pwa_just_installed';
const GUIDE_DISMISSED_KEY = 'reborn_pwa_launch_guide_dismissed';

function isPosLikePath(): boolean {
  if (typeof window === 'undefined') return false;
  return /\/merchant\/(pos|waiter|order-center|order-hub)(\/|$)/.test(window.location.pathname);
}

export default function PwaLaunchGuide() {
  const [open, setOpen] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isPosLikePath()) return;

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
        try {
          if (sessionStorage.getItem(GUIDE_DISMISSED_KEY) === '1') return;
        } catch {
          /* ignore */
        }
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

  const dismiss = () => {
    try {
      sessionStorage.removeItem(JUST_INSTALLED_KEY);
      sessionStorage.setItem(GUIDE_DISMISSED_KEY, '1');
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <Smartphone className="mt-0.5 h-6 w-6 shrink-0 text-teal-600" aria-hidden />
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-[var(--text)]">
              {justInstalled ? 'Reborn installed' : 'Open the installed app'}
            </h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              {justInstalled
                ? 'Installation finished in Chrome. Close this browser tab, then open Reborn from your home screen icon — not from Chrome again.'
                : 'Reborn is already on this tablet. Close Chrome and open the Reborn home screen icon. Installing again from Chrome only adds duplicate shortcuts and will not update the app.'}
            </p>
            <button type="button" className="btn-primary mt-4 w-full" onClick={dismiss}>
              Got it
            </button>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--bg-muted)]"
            aria-label="Close"
            onClick={dismiss}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
