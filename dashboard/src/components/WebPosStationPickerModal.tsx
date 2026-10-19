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

  if (!open || !stations.length) return null;

  const confirm = () => {
    const station = stations.find((s) => s.id === selectedId);
    if (!station) return;
    setBusy(true);
    onConfirm(station);
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-4">
      <div
        className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pos-station-picker-title"
      >
        <h2 id="pos-station-picker-title" className="text-lg font-semibold mb-1">
          {t('posStationPickerTitle')}
        </h2>
        <p className="text-sm text-[var(--text-muted)] mb-4">{t('posStationPickerHint')}</p>
        <div className="space-y-2 mb-6 max-h-[50vh] overflow-y-auto">
          {stations.map((s) => (
            <button
              key={s.id}
              type="button"
              disabled={busy}
              onClick={() => setSelectedId(s.id)}
              className={`w-full text-left rounded-xl border px-4 py-3 transition ${
                selectedId === s.id
                  ? 'border-sky-600 bg-sky-50 dark:bg-sky-950/40'
                  : 'border-[var(--border)] hover:border-sky-400'
              }`}
            >
              <div className="font-medium">{s.name}</div>
              {s.isDefault ? (
                <div className="text-xs text-[var(--text-muted)]">{t('default')}</div>
              ) : null}
            </button>
          ))}
        </div>
        <div className="flex gap-2 justify-end">
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
