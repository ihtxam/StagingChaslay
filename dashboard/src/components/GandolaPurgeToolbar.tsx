import { Trash2, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

type Props = {
  selectedCount: number;
  visibleCount: number;
  paymentFilter: string;
  onPaymentFilterChange: (value: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onDelete: () => void;
  onExit: () => void;
  deleting?: boolean;
};

export default function GandolaPurgeToolbar({
  selectedCount,
  visibleCount,
  paymentFilter,
  onPaymentFilterChange,
  onSelectAll,
  onClearSelection,
  onDelete,
  onExit,
  deleting = false,
}: Props) {
  const { t } = useI18n();

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-amber-200 bg-amber-50 px-2 py-2 sm:px-3">
      <p className="text-xs font-semibold text-amber-900">{t('gandolaPurgeMode')}</p>
      <select
        className="rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-800"
        value={paymentFilter}
        aria-label={t('ordersFilterPayment')}
        onChange={(e) => onPaymentFilterChange(e.target.value)}
      >
        <option value="cash">{t('webPosCash')}</option>
        <option value="all">{t('ordersAllPayments')}</option>
      </select>
      <button
        type="button"
        className="rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-bold text-stone-800 hover:bg-amber-100"
        onClick={onSelectAll}
        disabled={!visibleCount}
      >
        {t('gandolaSelectAll').replace('{n}', String(visibleCount))}
      </button>
      {selectedCount > 0 ? (
        <button
          type="button"
          className="rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-bold text-stone-800 hover:bg-amber-100"
          onClick={onClearSelection}
        >
          {t('gandolaClearSelection')}
        </button>
      ) : null}
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
        onClick={onDelete}
        disabled={!selectedCount || deleting}
      >
        <Trash2 size={14} aria-hidden />
        {deleting
          ? t('gandolaDeleting')
          : t('gandolaDeleteSelected').replace('{n}', String(selectedCount))}
      </button>
      <button
        type="button"
        className="ml-auto inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-bold text-stone-700 hover:bg-amber-100"
        onClick={onExit}
        aria-label={t('gandolaExitMode')}
      >
        <X size={14} aria-hidden />
        {t('gandolaExitMode')}
      </button>
    </div>
  );
}
