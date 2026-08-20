import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

const DEFAULT_MIN_MS = 6000;

/**
 * Full-width blocking banner for POS auth / license errors.
 * Stays visible until dismissed or minMs elapsed (whichever is later for critical messages).
 */
export default function WebPosBlockingAlert({
  open,
  title,
  message,
  onDismiss,
  minMs = DEFAULT_MIN_MS,
  variant = 'error',
}: {
  open: boolean;
  title?: string;
  message: string;
  onDismiss?: () => void;
  minMs?: number;
  variant?: 'error' | 'warning';
}) {
  const { t } = useI18n();
  const [canDismiss, setCanDismiss] = useState(false);

  useEffect(() => {
    if (!open) {
      setCanDismiss(false);
      return;
    }
    setCanDismiss(false);
    const timer = window.setTimeout(() => setCanDismiss(true), minMs);
    return () => window.clearTimeout(timer);
  }, [open, message, minMs]);

  if (!open || !message.trim()) return null;

  const bg =
    variant === 'warning'
      ? 'bg-amber-600 border-amber-400 text-white'
      : 'bg-red-700 border-red-400 text-white';

  return (
    <div
      className="fixed inset-x-0 top-0 z-[200] flex justify-center px-3 pt-[max(0.75rem,env(safe-area-inset-top))]"
      role="alertdialog"
      aria-live="assertive"
      aria-modal="true"
    >
      <div
        className={`flex w-full max-w-lg items-start gap-3 rounded-xl border px-4 py-4 shadow-2xl ${bg}`}
      >
        <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          {title ? <p className="text-base font-bold leading-snug">{title}</p> : null}
          <p className={`text-sm leading-relaxed ${title ? 'mt-1' : ''}`}>{message}</p>
          {!canDismiss ? (
            <p className="mt-2 text-xs opacity-80">{t('webPosErrorBannerHold')}</p>
          ) : null}
        </div>
        {onDismiss ? (
          <button
            type="button"
            disabled={!canDismiss}
            onClick={onDismiss}
            className="shrink-0 rounded-lg p-1.5 hover:bg-white/15 disabled:opacity-40"
            aria-label={t('webPosClose')}
          >
            <X className="h-5 w-5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
