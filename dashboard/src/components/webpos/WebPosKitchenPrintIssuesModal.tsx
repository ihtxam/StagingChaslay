import { Printer, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { repairCatalogText } from '@/lib/text-encoding';
import type { CartLine } from './types';

type Props = {
  open: boolean;
  lines: CartLine[];
  busy?: boolean;
  money: (n: number) => string;
  onClose: () => void;
  onRetryLine: (line: CartLine) => void | Promise<void>;
  onRetryAll: () => void | Promise<void>;
};

export default function WebPosKitchenPrintIssuesModal({
  open,
  lines,
  busy = false,
  money,
  onClose,
  onRetryLine,
  onRetryAll,
}: Props) {
  const { t } = useI18n();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/45 p-3 sm:items-center">
      <div className="flex max-h-[min(88vh,640px)] w-full max-w-lg flex-col rounded-2xl border border-amber-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-amber-100 bg-amber-50 px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-amber-950">{t('webPosKitchenPrintIssuesTitle')}</h2>
            <p className="mt-0.5 text-xs text-amber-800">{t('webPosKitchenPrintIssuesHint')}</p>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-amber-700 hover:bg-amber-100"
            onClick={onClose}
            disabled={busy}
            aria-label={t('close')}
          >
            <X size={18} />
          </button>
        </div>
        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
          {lines.map((line) => (
            <li
              key={line.lineId}
              className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50 px-3 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-stone-800">
                  {repairCatalogText(line.name || '')}
                </p>
                <p className="text-xs text-stone-500">
                  ×{line.quantity} · {money(line.lineTotal)}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void onRetryLine(line)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-40"
              >
                <Printer size={14} />
                {t('webPosPrint')}
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2 border-t border-stone-100 p-4">
          <button
            type="button"
            disabled={busy || !lines.length}
            onClick={() => void onRetryAll()}
            className="webpos-accent-btn flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold disabled:opacity-40"
          >
            <Printer size={16} />
            {t('webPosKitchenPrintRetryAll')}
          </button>
          <button
            type="button"
            className="rounded-xl border border-stone-200 px-4 py-3 text-sm font-semibold text-stone-600 hover:bg-stone-50 disabled:opacity-40"
            onClick={onClose}
            disabled={busy}
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
}
