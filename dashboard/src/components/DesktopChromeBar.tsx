import { useCallback, useEffect, useState } from 'react';
import { Maximize2, Minimize2, RefreshCw, Settings } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '@/lib/i18n';
import {
  desktopReload,
  desktopToggleWindowMode,
  desktopWindowMode,
  isDesktopApp,
  type DesktopWindowMode,
} from '@/lib/platform';

export default function DesktopChromeBar() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<DesktopWindowMode>('fullscreen');
  const [busy, setBusy] = useState(false);

  const refreshMode = useCallback(async () => {
    if (!isDesktopApp()) return;
    try {
      setMode(await desktopWindowMode());
    } catch {
      /* best-effort */
    }
  }, []);

  useEffect(() => {
    void refreshMode();
  }, [refreshMode, location.pathname]);

  if (!isDesktopApp()) return null;

  const onReload = async () => {
    setBusy(true);
    try {
      await desktopReload();
    } finally {
      setBusy(false);
    }
  };

  const onToggleWindow = async () => {
    setBusy(true);
    try {
      const next = await desktopToggleWindowMode();
      setMode(next);
    } finally {
      setBusy(false);
    }
  };

  const onSettings = () => {
    if (location.pathname.startsWith('/merchant/pos')) {
      window.dispatchEvent(new CustomEvent('webpos:open-settings'));
      return;
    }
    navigate('/merchant/settings');
  };

  const fullscreenLike = mode === 'fullscreen' || mode === 'maximized';

  return (
    <div
      className="desktop-chrome-bar fixed inset-x-0 top-0 z-[200] flex h-9 items-center justify-end gap-1 border-b border-black/10 bg-[#1a2428]/95 px-2 text-white backdrop-blur-sm"
      data-tauri-drag-region
    >
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
        onClick={() => void onToggleWindow()}
        disabled={busy}
        aria-label={
          fullscreenLike ? t('desktopChromeRestoreWindow') : t('desktopChromeFullscreen')
        }
        title={fullscreenLike ? t('desktopChromeRestoreWindow') : t('desktopChromeFullscreen')}
      >
        {fullscreenLike ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
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
