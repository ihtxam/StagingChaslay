import { Printer, Receipt, UtensilsCrossed, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

type Props = {
  open: boolean;
  busy?: boolean;
  /** Single line name when reprinting one item; omit for whole order. */
  lineLabel?: string | null;
  onClose: () => void;
  onProvisional: () => void | Promise<void>;
  onKitchen: () => void | Promise<void>;
};

export default function WebPosReprintModal({
  open,
  busy = false,
  lineLabel,
  onClose,
  onProvisional,
  onKitchen,
}: Props) {
  const { t } = useI18n();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/45 p-3 sm:items-center">
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-stone-800">{t('webPosReprintTitle')}</h2>
            <p className="mt-0.5 text-xs text-stone-500">
              {lineLabel
                ? t('webPosReprintLineHint').replace('{item}', lineLabel)
                : t('webPosReprintHint')}
            </p>
          </div>
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
          <button
            type="button"
            disabled={busy}
            onClick={() => void onProvisional()}
            className="flex w-full items-center gap-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-4 text-left hover:bg-stone-100 disabled:opacity-40"
          >
            <Receipt size={20} className="shrink-0 text-stone-500" />
            <div>
              <p className="text-sm font-bold text-stone-800">{t('webPosProvisionalReceipt')}</p>
              <p className="text-xs text-stone-500">{t('webPosReprintProvisionalDesc')}</p>
            </div>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onKitchen()}
            className="flex w-full items-center gap-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-4 text-left hover:bg-stone-100 disabled:opacity-40"
          >
            <UtensilsCrossed size={20} className="shrink-0 text-stone-500" />
            <div>
              <p className="text-sm font-bold text-stone-800">{t('webPosKitchenReceipt')}</p>
              <p className="text-xs text-stone-500">{t('webPosReprintKitchenDesc')}</p>
            </div>
          </button>
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
