import { useEffect, useState } from 'react';
import { Minus, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { useI18n } from '@/lib/i18n';
import DesktopHubNav from '@/components/DesktopHubNav';
import { OnScreenKeyboardToggle } from '@/components/OnScreenKeyboard';
import {
  desktopMinimize,
  desktopReload,
  formatDesktopInvokeError,
  isDesktopApp,
  isMissingDesktopCommandError,
  probeDesktopChromeCapabilities,
  type DesktopChromeCapabilities,
} from '@/lib/platform';

export default function DesktopChromeBar() {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [chromeCaps, setChromeCaps] = useState<DesktopChromeCapabilities | null>(null);

  useEffect(() => {
    if (!isDesktopApp()) return;
    void probeDesktopChromeCapabilities().then(setChromeCaps);
  }, []);

  if (!isDesktopApp()) return null;

  const needsShellUpdate = chromeCaps !== null && !chromeCaps.nativeMinimize;

  const onReload = async () => {
    setBusy(true);
    try {
      const how = await desktopReload();
      if (how === 'fallback' && needsShellUpdate) {
        toast(t('desktopChromeReloadFallback'));
      }
    } catch (err) {
      toast.error(t('desktopChromeActionFailed'));
      console.warn('[DesktopChromeBar] reload failed:', formatDesktopInvokeError(err));
    } finally {
      setBusy(false);
    }
  };

  const onMinimize = async () => {
    if (needsShellUpdate) {
      toast.error(t('desktopChromeUpdateRequired'));
      return;
    }
    setBusy(true);
    try {
      await desktopMinimize();
    } catch (err) {
      toast.error(t('desktopChromeActionFailed'));
      console.warn('[DesktopChromeBar] minimize failed:', formatDesktopInvokeError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="desktop-chrome-bar fixed inset-x-0 top-0 z-[200] flex h-10 items-center gap-1 border-b border-black/10 bg-[#1a2428]/95 px-2 text-slate-50 backdrop-blur-sm"
      data-tauri-drag-region
    >
      <DesktopHubNav className="mr-auto" />
      {needsShellUpdate ? (
        <span className="hidden max-w-[28%] truncate px-1 text-[11px] text-amber-200/90 sm:inline" title={t('desktopChromeUpdateRequired')}>
          {t('desktopChromeUpdateRequired')}
        </span>
      ) : null}
      <OnScreenKeyboardToggle
        className="desktop-chrome-btn inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-50/90 hover:bg-white/10 hover:text-white data-[active=true]:bg-teal-600/90 data-[active=true]:text-white"
        iconSize={15}
      />
      <button
        type="button"
        className="desktop-chrome-btn inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-50/90 hover:bg-white/10 hover:text-white disabled:opacity-50"
        onClick={() => void onReload()}
        disabled={busy}
        aria-label={t('desktopChromeRefresh')}
        title={t('desktopChromeRefresh')}
      >
        <RefreshCw size={15} className={busy ? 'animate-spin' : undefined} />
      </button>
      <button
        type="button"
        className="desktop-chrome-btn inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-50/90 hover:bg-white/10 hover:text-white disabled:opacity-50"
        onClick={() => void onMinimize()}
        disabled={busy}
        aria-label={t('desktopChromeMinimize')}
        title={t('desktopChromeMinimize')}
      >
        <Minus size={15} strokeWidth={2.5} />
      </button>
    </div>
  );
}
