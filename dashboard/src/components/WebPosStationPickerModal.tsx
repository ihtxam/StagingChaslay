import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import type { PosStation } from '@/lib/pos-station';

export default function WebPosStationPickerModal({
  open,
  stations,
  initialStationId,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  stations: PosStation[];
  initialStationId?: string | null;
  onCancel?: () => void;
  onConfirm: (station: PosStation) => void;
}) {
  const { t } = useI18n();
  const [selectedId, setSelectedId] = useState(initialStationId || stations[0]?.id || '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const pick =
      (initialStationId && stations.some((s) => s.id === initialStationId)
        ? initialStationId
        : stations.find((s) => s.isDefault)?.id) || stations[0]?.id || '';
    setSelectedId(pick);
    setBusy(false);
  }, [open, initialStationId, stations]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !stations.length) return null;

  const confirm = () => {
    const station = stations.find((s) => s.id === selectedId);
    if (!station) return;
    setBusy(true);
    onConfirm(station);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center overflow-hidden bg-black/55 p-0 sm:items-center sm:p-4"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="flex max-h-[min(92dvh,32rem)] w-full max-w-md min-h-0 flex-col overflow-hidden rounded-t-2xl border border-[var(--webpos-border,var(--border))] bg-[var(--webpos-surface,var(--surface))] text-[var(--webpos-text,var(--text,#1c1917))] shadow-xl sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pos-station-picker-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-[var(--webpos-border,var(--border))] px-5 py-4 sm:px-6">
          <h2
            id="pos-station-picker-title"
            className="text-lg font-semibold text-[var(--webpos-text,var(--text,#1c1917))]"
          >
            {t('posStationPickerTitle')}
          </h2>
          <p className="mt-1.5 text-sm leading-snug text-stone-600 dark:text-stone-300">
            {t('posStationPickerHint')}
          </p>
        </div>

        <div
          className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-5 py-4 touch-pan-y sm:px-6"
          role="listbox"
          aria-label={t('posStationPickerTitle')}
        >
          {stations.map((s) => (
            <button
              key={s.id}
              type="button"
              disabled={busy}
              role="option"
              aria-selected={selectedId === s.id}
              onClick={() => setSelectedId(s.id)}
              className={`w-full text-left rounded-xl border px-4 py-3 transition ${
                selectedId === s.id
                  ? 'border-sky-600 bg-sky-100 text-stone-900 dark:border-sky-500 dark:bg-sky-950/60 dark:text-sky-50'
                  : 'border-[var(--webpos-border,var(--border))] bg-[var(--webpos-surface-2,var(--bg-muted))] text-[var(--webpos-text,var(--text))] hover:border-sky-400'
              }`}
            >
              <div className="font-medium">{s.name}</div>
              {s.isDefault ? (
                <div className="text-xs text-stone-600 dark:text-stone-400">{t('default')}</div>
              ) : null}
            </button>
          ))}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-[var(--border)] px-5 py-4 sm:px-6">
          {onCancel ? (
            <button type="button" className="btn-secondary" disabled={busy} onClick={onCancel}>
              {t('cancel')}
            </button>
          ) : null}
          <button type="button" className="btn-primary min-w-[7rem]" disabled={busy} onClick={confirm}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : t('confirm')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
