import { useEffect, useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import {
  dismissKioskInstallHint,
  hasKioskInstallPrompt,
  isKioskInstallHintDismissed,
  isKioskPwaInstalled,
  isKioskStandalone,
  promptKioskInstall,
} from '@/lib/kiosk-pwa';
import { useI18n } from '@/lib/i18n';

type HintMode = 'hidden' | 'install' | 'use-icon';

export default function KioskInstallHint() {
  const { t } = useI18n();
  const [mode, setMode] = useState<HintMode>('hidden');
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (isKioskStandalone() || isKioskInstallHintDismissed()) {
      setMode('hidden');
      return;
    }

    let cancelled = false;
    void (async () => {
      const installed = await isKioskPwaInstalled();
      if (cancelled) return;
      if (installed) {
        setMode('use-icon');
        return;
      }
      if (hasKioskInstallPrompt()) {
        setMode('install');
      } else {
        setMode('hidden');
      }
    })();

    const onBip = () => {
      if (isKioskStandalone() || isKioskInstallHintDismissed()) return;
      void isKioskPwaInstalled().then((installed) => {
        if (installed) {
          setMode('use-icon');
        } else if (hasKioskInstallPrompt()) {
          setMode('install');
        }
      });
    };
    window.addEventListener('beforeinstallprompt', onBip);

    return () => {
      cancelled = true;
      window.removeEventListener('beforeinstallprompt', onBip);
    };
  }, []);

  if (mode === 'hidden') return null;

  const dismiss = () => {
    dismissKioskInstallHint();
    setMode('hidden');
  };

  const onInstall = async () => {
    setInstalling(true);
    const outcome = await promptKioskInstall();
    setInstalling(false);
    if (outcome === 'accepted') {
      dismiss();
    }
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[90] mx-auto flex max-w-lg items-start gap-3 rounded-xl border border-emerald-500/40 bg-stone-900/95 p-4 text-white shadow-2xl backdrop-blur-sm">
      {mode === 'use-icon' ? (
        <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
      ) : (
        <Download className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
      )}
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {mode === 'use-icon' ? t('kioskPwaUseIconTitle') : t('kioskPwaInstallTitle')}
        </p>
        <p className="mt-1 text-sm text-stone-300">
          {mode === 'use-icon' ? t('kioskPwaUseIconBody') : t('kioskPwaInstallBody')}
        </p>
        {mode === 'install' ? (
          <button
            type="button"
            className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold hover:bg-emerald-500 disabled:opacity-60"
            disabled={installing}
            onClick={() => void onInstall()}
          >
            {installing ? t('kioskPwaInstalling') : t('kioskPwaInstallAction')}
          </button>
        ) : null}
      </div>
      <button
        type="button"
        className="shrink-0 rounded-lg p-1 text-stone-400 hover:bg-stone-800 hover:text-white"
        aria-label={t('close')}
        onClick={dismiss}
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}
