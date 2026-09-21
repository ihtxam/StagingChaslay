import { useEffect, useState } from 'react';
import { Minimize2, RefreshCw, Settings } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@/lib/i18n';
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
  const navigate = useNavigate();
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

  const onSettings = () => {
    navigate('/merchant/desktop-settings');
  };

  return (
    <div
      className="desktop-chrome-bar fixed inset-x-0 top-0 z-[200] flex h-9 items-center justify-end gap-1 border-b border-black/10 bg-[#1a2428]/95 px-2 text-white backdrop-blur-sm"
      data-tauri-drag-region
    >
      {needsShellUpdate ? (
        <span className="mr-auto truncate px-1 text-[11px] text-amber-200/90" title={t('desktopChromeUpdateRequired')}>
          {t('desktopChromeUpdateRequired')}
        </span>
      ) : null}
      <button
        type="button"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-white/85 hover:bg-white/10 disabled:opacity-50"
        onClick={() => void onReload()}
        disabled={busy}
        aria-label={t('desktopChromeRefresh')}
        title={t('desktopChromeRefresh')}
      >
        <RefreshCw size={15} className={busy ? 'animate-spin' : undefined} />
      </button>
      <button
        type="button"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-white/85 hover:bg-white/10 disabled:opacity-50"
        onClick={() => void onMinimize()}
        disabled={busy}
        aria-label={t('desktopChromeMinimize')}
        title={t('desktopChromeMinimize')}
      >
        <Minimize2 size={15} />
      </button>
      <button
        type="button"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-white/85 hover:bg-white/10"
        onClick={onSettings}
        aria-label={t('settings')}
        title={t('settings')}
      >
        <Settings size={15} />
      </button>
    </div>
  );
}
