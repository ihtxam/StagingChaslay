import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

const REJECT_REASONS = [
  { id: 'kitchen_busy', key: 'orderRejectKitchenBusy' },
  { id: 'out_of_stock', key: 'orderRejectOutOfStock' },
  { id: 'could_not_process', key: 'orderRejectCouldNotProcess' },
  { id: 'client_cancel', key: 'orderRejectClientCancel' },
  { id: 'other', key: 'orderRejectOther' },
] as const;

type Props = {
  open: boolean;
  orderLabel?: string;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
};

export default function WebPosRejectOrderModal({
  open,
  orderLabel,
  busy,
  onClose,
  onConfirm,
}: Props) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<string>('kitchen_busy');
  const [custom, setCustom] = useState('');

  if (!open) return null;

  const reason =
    selected === 'other'
      ? custom.trim()
      : REJECT_REASONS.find((r) => r.id === selected)?.id || selected;

  return createPortal(
    <div
      className="fixed inset-0 z-[360] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-stone-900">{t('orderRejectTitle')}</h2>
            {orderLabel ? (
              <p className="mt-0.5 text-sm text-stone-600">{orderLabel}</p>
            ) : null}
          </div>
          <button type="button" className="p-1 text-stone-500" onClick={onClose} aria-label={t('close')}>
            <X size={18} />
          </button>
        </div>

        <p className="mt-3 text-sm text-stone-600">{t('orderRejectHint')}</p>

        <div className="mt-4 space-y-2">
          {REJECT_REASONS.map((r) => (
            <label
              key={r.id}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm ${
                selected === r.id
                  ? 'border-red-300 bg-red-50 font-semibold text-red-900'
                  : 'border-stone-200 text-stone-800 hover:bg-stone-50'
              }`}
            >
              <input
                type="radio"
                name="reject-reason"
                checked={selected === r.id}
                onChange={() => setSelected(r.id)}
                className="accent-red-600"
              />
              {t(r.key)}
            </label>
          ))}
        </div>

        {selected === 'other' ? (
          <textarea
            className="input mt-3 min-h-[72px] w-full text-sm"
            placeholder={t('orderRejectCustomPlaceholder')}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
          />
        ) : null}

        <div className="mt-5 flex gap-2">
          <button type="button" className="btn-secondary flex-1 py-3 font-bold" onClick={onClose}>
            {t('cancel')}
          </button>
          <button
            type="button"
            className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
            disabled={busy || (selected === 'other' && !custom.trim())}
            onClick={() => onConfirm(reason)}
          >
            {busy ? t('saving') : t('orderRejectConfirm')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
