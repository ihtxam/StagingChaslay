import { Loader2, RotateCcw, AlertCircle, Ban } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

export type WebPosPaymentPhase = 'processing' | 'cancelled' | 'failed';

type Props = {
  open: boolean;
  phase: WebPosPaymentPhase;
  amountLabel: string;
  message?: string;
  onCancel?: () => void;
  onRetry?: () => void;
  onClose?: () => void;
};

export default function WebPosPaymentModal({
  open,
  phase,
  amountLabel,
  message,
  onCancel,
  onRetry,
  onClose,
}: Props) {
  const { t } = useI18n();
  if (!open) return null;

  const title =
    phase === 'processing'
      ? t('webPosPayProcessing')
      : phase === 'cancelled'
        ? t('webPosPayCancelled')
        : t('webPosPayFailed');

  const defaultMessage =
    phase === 'processing'
      ? t('webPosPayCompleteOnTerminal')
      : phase === 'cancelled'
        ? t('webPosPayCancelledMsg')
        : t('webPosPayFailedMsg');

  const isTerminalState = phase === 'cancelled' || phase === 'failed';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="webpos-payment-title"
    >
      <div className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-10 shadow-2xl">
        <div className="flex flex-col items-center text-center">
          {phase === 'processing' ? (
            <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-teal-50 text-teal-700">
              <Loader2 className="h-12 w-12 animate-spin" aria-hidden />
            </div>
          ) : phase === 'cancelled' ? (
            <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-amber-50 text-amber-700">
              <Ban className="h-12 w-12" aria-hidden />
            </div>
          ) : (
            <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-red-50 text-red-700">
              <AlertCircle className="h-12 w-12" aria-hidden />
            </div>
          )}

          <h2 id="webpos-payment-title" className="text-2xl font-bold tracking-tight">
            {title}
          </h2>
          <p className="mt-3 text-4xl font-bold tabular-nums">{amountLabel}</p>
          <p className="mt-4 text-base leading-relaxed text-[var(--text-muted)]">
            {message || defaultMessage}
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-3">
          {phase === 'processing' && onCancel ? (
            <button
              type="button"
              className="w-full rounded-xl border border-[var(--border)] py-3.5 text-base font-semibold hover:bg-[var(--bg-muted)]"
              onClick={onCancel}
            >
              {t('cancel')}
            </button>
          ) : null}

          {isTerminalState && onRetry ? (
            <button
              type="button"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] py-3.5 text-base font-semibold hover:bg-[var(--bg-muted)]"
              onClick={onRetry}
            >
              <RotateCcw className="h-5 w-5" />
              {t('webPosRetry')}
            </button>
          ) : null}

          {isTerminalState && onClose ? (
            <button
              type="button"
              className="inline-flex w-full items-center justify-center rounded-xl bg-teal-700 py-4 text-base font-bold text-white hover:bg-teal-800"
              onClick={onClose}
            >
              {t('confirm')}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
