import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/lib/i18n';

export const RESERVATION_CANCEL_REASON_KEYS = [
  { id: 'no_show', key: 'reservationsCancelReasonNoShow' },
  { id: 'customer_requested', key: 'reservationsCancelReasonCustomerRequested' },
  { id: 'table_unavailable', key: 'reservationsCancelReasonTableUnavailable' },
  { id: 'overbooking', key: 'reservationsCancelReasonOverbooking' },
  { id: 'other', key: 'reservationsCancelReasonOther' },
] as const;

type Props = {
  open: boolean;
  variant?: 'merchant' | 'webpos';
  onClose: () => void;
  onConfirm: (cancelReason: string) => void;
};

export default function ReservationCancelModal({
  open,
  variant = 'merchant',
  onClose,
  onConfirm,
}: Props) {
  const { t } = useI18n();
  const options = useMemo(
    () =>
      RESERVATION_CANCEL_REASON_KEYS.map((r) => ({
        id: r.id,
        label: t(r.key),
      })),
    [t]
  );
  const [reasonId, setReasonId] = useState('');
  const [otherText, setOtherText] = useState('');

  useEffect(() => {
    if (!open) return;
    setReasonId('');
    setOtherText('');
  }, [open]);

  if (!open) return null;

  const isOther = reasonId === 'other';
  const selected = options.find((o) => o.id === reasonId);
  const canSubmit = Boolean(selected && (!isOther || otherText.trim()));

  const resolveReason = () => {
    if (!selected) return '';
    if (isOther) return otherText.trim();
    return selected.label;
  };

  const panelClass =
    variant === 'webpos'
      ? 'w-full max-w-md rounded-xl border border-[var(--webpos-border,var(--border))] bg-[var(--webpos-surface,var(--bg-elevated))] p-4 shadow-xl space-y-3'
      : 'w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 shadow-xl space-y-3';
  const hintClass =
    variant === 'webpos'
      ? 'text-sm text-[var(--webpos-text-muted,var(--text-muted))]'
      : 'text-sm muted';
  const chipSelected =
    'border-red-600 bg-red-50 text-red-900 font-semibold dark:bg-red-950/40 dark:text-red-200 dark:border-red-700';
  const chipDefault =
    variant === 'webpos'
      ? 'border-[var(--webpos-border,var(--border))] bg-[var(--webpos-surface-2,var(--bg-muted))] text-[var(--webpos-text,var(--text))] hover:border-[var(--webpos-border,var(--border))]'
      : 'border-[var(--border)] bg-[var(--bg-muted)]/40 hover:border-[var(--border)]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className={panelClass}>
        <h3 className="text-lg font-semibold">{t('reservationsCancelTitle')}</h3>
        <p className={hintClass}>{t('reservationsCancelHint')}</p>
        <p className="text-sm font-medium">{t('reservationsCancelReasonPrompt')}</p>
        <div className="flex flex-wrap gap-2">
          {options.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                reasonId === r.id ? chipSelected : chipDefault
              }`}
              onClick={() => setReasonId(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>
        {isOther ? (
          <textarea
            className="input min-h-20"
            value={otherText}
            onChange={(e) => setOtherText(e.target.value)}
            placeholder={t('reservationsCancelReasonOtherPlaceholder')}
            autoFocus
          />
        ) : null}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t('cancel')}
          </button>
          <button
            type="button"
            className={`btn-primary ${variant === 'webpos' ? 'bg-red-700 hover:bg-red-800' : '!bg-red-700 hover:!bg-red-800'}`}
            disabled={!canSubmit}
            onClick={() => onConfirm(resolveReason())}
          >
            {t('reservationsCancelSend')}
          </button>
        </div>
      </div>
    </div>
  );
}
