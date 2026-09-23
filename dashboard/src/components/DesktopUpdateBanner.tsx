import { useEffect, useState } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useI18n } from '@/lib/i18n';
import {
  applyDesktopUpdate,
  checkDesktopUpdate,
  downloadDesktopUpdate,
  formatDesktopInvokeError,
  isDesktopApp,
  isMissingDesktopCommandError,
  type DesktopUpdateInfo,
  type DesktopUpdateProgress,
} from '@/lib/platform';

type BannerPhase = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'applying';

export default function DesktopUpdateBanner() {
  const { t } = useI18n();
  const [phase, setPhase] = useState<BannerPhase>('idle');
  const [updateInfo, setUpdateInfo] = useState<DesktopUpdateInfo | null>(null);
  const [progress, setProgress] = useState<DesktopUpdateProgress | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isDesktopApp()) return;

    let cancelled = false;

    const run = async () => {
      setPhase('checking');
      try {
        const info = await checkDesktopUpdate();
        if (cancelled || !info.available) {
          setPhase('idle');
          return;
        }
        setUpdateInfo(info);
        setPhase('available');
        setPhase('downloading');
        const downloadProgress = await downloadDesktopUpdate();
        if (cancelled) return;
        setProgress(downloadProgress);
        setPhase(downloadProgress.phase === 'ready' ? 'ready' : 'available');
      } catch (err) {
        if (cancelled) return;
        if (isMissingDesktopCommandError(err)) {
          setPhase('idle');
          return;
        }
        console.warn('[DesktopUpdateBanner] update check failed:', formatDesktopInvokeError(err));
        setPhase('idle');
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!isDesktopApp() || phase === 'idle' || phase === 'checking' || dismissed) {
    return null;
  }

  const versionLabel = updateInfo?.version ? `v${updateInfo.version}` : '';

  const onRestart = async () => {
    setPhase('applying');
    try {
      await applyDesktopUpdate();
    } catch (err) {
      setPhase('ready');
      toast.error(t('desktopUpdateApplyFailed'));
      console.warn('[DesktopUpdateBanner] apply failed:', formatDesktopInvokeError(err));
    }
  };

  const title =
    phase === 'ready' || phase === 'applying'
      ? t('desktopUpdateReadyTitle').replace('{version}', versionLabel)
      : t('desktopUpdateAvailableTitle').replace('{version}', versionLabel);

  const detail =
    phase === 'downloading'
      ? t('desktopUpdateDownloading')
      : phase === 'applying'
        ? t('desktopUpdateApplying')
        : updateInfo?.notes?.trim() || t('desktopUpdateReadyHint');

  return (
    <div
      className="desktop-update-banner fixed inset-x-0 top-9 z-[199] border-b border-teal-500/30 bg-[#122026]/95 px-3 py-2 text-slate-50 shadow-lg backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex max-w-5xl items-start gap-3">
        <div className="mt-0.5 shrink-0 text-teal-300">
          {phase === 'downloading' || phase === 'applying' ? (
            <RefreshCw size={16} className="animate-spin" />
          ) : (
            <Download size={16} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-teal-50">{title}</p>
          <p className="truncate text-xs text-slate-300/90">{detail}</p>
          {progress?.contentLength ? (
            <p className="mt-0.5 text-[11px] text-slate-400">
              {Math.min(100, Math.round((progress.downloaded / progress.contentLength) * 100))}%
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {phase === 'ready' || phase === 'available' ? (
            <button
              type="button"
              className="rounded-md bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-500 disabled:opacity-60"
              onClick={() => void onRestart()}
              disabled={phase === 'applying' || phase === 'downloading'}
            >
              {t('desktopUpdateRestartNow')}
            </button>
          ) : null}
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-300 hover:bg-white/10 hover:text-white"
            onClick={() => setDismissed(true)}
            aria-label={t('close')}
            title={t('desktopUpdateLater')}
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
