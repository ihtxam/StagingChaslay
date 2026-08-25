import { createPortal } from 'react-dom';
import { useI18n } from '@/lib/i18n';

type Props = {
  open: boolean;
  amount?: number;
  busy?: boolean;
  onPrint: () => void;
  onSkip: () => void;
};

export default function WebPosRefundPrintPromptModal({
  open,
  amount,
  busy = false,
  onPrint,
  onSkip,
}: Props) {
  const { t } = useI18n();
  if (!open) return null;

  const amountLabel =
    amount != null && Number.isFinite(amount)
      ? t('webPosRefundPrintPromptAmount').replace('{amount}', Number(amount).toFixed(2))
      : null;

  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/45 p-4">
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="refund-print-prompt-title"
      >
        <h2 id="refund-print-prompt-title" className="text-lg font-bold text-stone-900">
          {t('webPosRefundPrintPromptTitle')}
        </h2>
        <p className="mt-2 text-sm text-stone-600">{t('webPosRefundPrintPromptBody')}</p>
        {amountLabel ? <p className="mt-1 text-sm font-semibold text-stone-800">{amountLabel}</p> : null}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            className="btn-secondary py-3 text-sm font-semibold"
            disabled={busy}
            onClick={onSkip}
          >
            {t('no')}
          </button>
          <button
            type="button"
            className="webpos-accent-btn rounded-xl py-3 text-sm font-bold text-white"
            disabled={busy}
            onClick={onPrint}
          >
            {t('yes')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
