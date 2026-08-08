import { Printer, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

export type PrintChooserPart = {
  id: string;
  label: string;
  amount?: number;
};

type Props = {
  open: boolean;
  parts: PrintChooserPart[];
  busy?: boolean;
  onClose: () => void;
  onPrintPart: (partId: string) => void | Promise<void>;
  onPrintComplete: () => void | Promise<void>;
};

export default function WebPosPrintChooserModal({
  open,
  parts,
  busy = false,
  onClose,
  onPrintPart,
  onPrintComplete,
}: Props) {
  const { t } = useI18n();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-3 sm:items-center">
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
          <h2 className="text-base font-semibold text-stone-800">{t('webPosChooseReceipt')}</h2>
          <button
            type="button"
            className="rounded-lg p-2 text-stone-500 hover:bg-stone-100"
            onClick={onClose}
            disabled={busy}
            aria-label={t('close')}
          >
            <X size={18} />
          </button>
        </div>
        <div className="space-y-2 p-4">
          <p className="text-sm text-stone-500">{t('webPosChooseReceiptHint')}</p>
          <div className="space-y-2">
            {parts.map((part, idx) => (
              <button
                key={part.id}
                type="button"
                disabled={busy}
                onClick={() => void onPrintPart(part.id)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-left hover:bg-stone-100 disabled:opacity-40"
              >
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-stone-800">
                  <Printer size={16} className="text-stone-500" />
                  {part.label || t('webPosSplitBillN').replace('{n}', String(idx + 1))}
                </span>
                {part.amount != null ? (
                  <span className="text-sm font-bold tabular-nums text-stone-600">
                    CHF {part.amount.toFixed(2)}
                  </span>
                ) : null}
              </button>
            ))}
            <button
              type="button"
              disabled={busy}
              onClick={() => void onPrintComplete()}
              className="webpos-accent-btn flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-bold disabled:opacity-40"
            >
              <Printer size={16} />
              {t('webPosPrintCompleteOrder')}
            </button>
          </div>
          <button
            type="button"
            className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-600 hover:bg-stone-50 disabled:opacity-40"
            onClick={onClose}
            disabled={busy}
          >
            {t('cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
