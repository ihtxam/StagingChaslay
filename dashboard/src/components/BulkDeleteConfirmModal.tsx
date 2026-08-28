import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '@/lib/i18n';

type Props = {
  open: boolean;
  count: number;
  /** e.g. products, categories, modifier groups */
  itemTypeLabel: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function BulkDeleteConfirmModal({
  open,
  count,
  itemTypeLabel,
  busy = false,
  onCancel,
  onConfirm,
}: Props) {
  const { t } = useI18n();
  const [typed, setTyped] = useState('');
  const confirmWord = t('bulkDeleteConfirmWord');

  useEffect(() => {
    if (!open) setTyped('');
  }, [open]);

  if (!open || count <= 0) return null;

  const canConfirm = typed.trim().toUpperCase() === confirmWord.trim().toUpperCase();

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4">
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl dark:bg-stone-900"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-delete-title"
      >
        <h2 id="bulk-delete-title" className="text-lg font-bold text-red-700">
          {t('bulkDeleteTitle').replace('{n}', String(count)).replace('{type}', itemTypeLabel)}
        </h2>
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">{t('bulkDeleteBody')}</p>
        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-stone-500">
          {t('bulkDeleteTypeHint').replace('{word}', confirmWord)}
        </p>
        <input
          className="input mt-2 w-full font-mono"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={confirmWord}
          autoComplete="off"
          autoFocus
        />
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" className="btn-secondary py-2.5" disabled={busy} onClick={onCancel}>
            {t('cancel')}
          </button>
          <button
            type="button"
            className="rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-40"
            disabled={busy || !canConfirm}
            onClick={onConfirm}
          >
            {busy ? t('loading') : t('bulkDeleteButton')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
