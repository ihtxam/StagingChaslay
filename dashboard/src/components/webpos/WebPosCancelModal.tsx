import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

export type CancelScope = 'order' | 'item';

export type CancelReasonOption = {
  id: string;
  en: string;
  fr: string;
  de: string;
};

export const WEBPOS_CANCEL_REASON_KEYS = [
  { id: 'kitchen_busy', key: 'webPosCancelReasonBusy' },
  { id: 'client_cancel', key: 'webPosCancelReasonClient' },
  { id: 'out_of_stock', key: 'webPosCancelReasonStock' },
  { id: 'wrong_order', key: 'webPosCancelReasonWrong' },
  { id: 'could_not_process', key: 'webPosCancelReasonProcess' },
  { id: 'other', key: 'webPosCancelReasonOther' },
] as const;

type Props = {
  open: boolean;
  scope: CancelScope;
  itemLabel?: string | null;
  /** Unsent cart — confirm only, no reason list. */
  simpleConfirm?: boolean;
  /** Optional API reasons (en/fr/de). Falls back to i18n keys. */
  reasons?: CancelReasonOption[];
  onClose: () => void;
  /** reasonId + localized label for display; backend normalizes to English. */
  onConfirm: (reason: string, reasonId: string) => void;
};

export default function WebPosCancelModal({
  open,
  scope,
  itemLabel,
  simpleConfirm = false,
  reasons: apiReasons,
  onClose,
  onConfirm,
}: Props) {
  const { t, locale } = useI18n();
  const options = useMemo(() => {
    if (apiReasons?.length) {
      return apiReasons.map((r) => ({
        id: r.id,
        label: locale === 'fr' ? r.fr : locale === 'de' ? r.de : r.en,
      }));
    }
    return WEBPOS_CANCEL_REASON_KEYS.map((r) => ({
      id: r.id,
      label: t(r.key),
    }));
  }, [apiReasons, locale, t]);
  const [reasonId, setReasonId] = useState('');

  useEffect(() => {
    if (!open) return;
    setReasonId(options[0]?.id || '');
  }, [open, options]);

  if (!open) return null;

  const title = scope === 'item' ? t('webPosCancelItem') : t('webPosCancelOrder');
  const selected = options.find((o) => o.id === reasonId) || options[0];

  if (simpleConfirm && scope === 'order') {
    return (
      <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/45 p-3">
        <div className="w-full max-w-md rounded-2xl bg-[var(--bg-elevated)] shadow-xl border border-[var(--border)]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
            <h2 className="font-semibold text-rose-700">{title}</h2>
            <button type="button" className="p-2" onClick={onClose} aria-label={t('close')}>
              <X size={18} />
            </button>
          </div>
          <div className="p-4">
            <p className="text-sm text-[var(--text-muted)]">{t('webPosCancelConfirm')}</p>
          </div>
          <div className="flex gap-2 border-t border-[var(--border)] p-4">
            <button type="button" className="btn-secondary flex-1" onClick={onClose}>
              {t('cancel')}
            </button>
            <button
              type="button"
              className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-bold text-white hover:bg-rose-700"
              onClick={() => onConfirm(t('webPosCancelConfirm'), 'unsent_cart')}
            >
              {t('confirm')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/45 p-3">
      <div className="w-full max-w-md rounded-2xl bg-[var(--bg-elevated)] shadow-xl border border-[var(--border)]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <h2 className="font-semibold text-rose-700">{title}</h2>
          <button type="button" className="p-2" onClick={onClose} aria-label={t('close')}>
            <X size={18} />
          </button>
        </div>
        <div className="p-4 space-y-3">
          {scope === 'item' && itemLabel ? (
            <p className="text-sm text-[var(--text-muted)]">{itemLabel}</p>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">{t('webPosCancelReasonPrompt')}</p>
          )}
          <div className="space-y-1.5">
            {options.map((r) => (
              <label
                key={r.id}
                className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm ${
                  reasonId === r.id
                    ? 'border-rose-500 bg-rose-50 font-semibold text-rose-900'
                    : 'border-[var(--border)]'
                }`}
              >
                <input
                  type="radio"
                  name="webpos-cancel-reason"
                  checked={reasonId === r.id}
                  onChange={() => setReasonId(r.id)}
                  className="accent-rose-600"
                />
                {r.label}
              </label>
            ))}
          </div>
        </div>
        <div className="flex gap-2 border-t border-[var(--border)] p-4">
          <button type="button" className="btn-secondary flex-1" onClick={onClose}>
            {t('cancel')}
          </button>
          <button
            type="button"
            className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-40"
            disabled={!selected}
            onClick={() => selected && onConfirm(selected.label, selected.id)}
          >
            {t('confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
