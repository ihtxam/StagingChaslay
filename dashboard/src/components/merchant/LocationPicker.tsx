import { useEffect, useState } from 'react';
import { Building2, Check, MapPin, Network } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { shouldShowLocationSwitcher } from '@/lib/pos-hub-visibility';
import { useLocationStore, type MerchantLocation } from '@/store/location';
import { setWebPosTerminalLocationId } from '@/lib/webpos-terminal-location';

const HQ_PICK = '__hq__';

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect?: (location: MerchantLocation | null) => void;
  title?: string;
  /** When set, confirm only locks this browser tab's WebPOS — not the admin panel location. */
  lockWebPosTerminal?: boolean;
  /** Hide HQ (all branches) row — e.g. POS must pick one branch. */
  branchOnly?: boolean;
};

export default function LocationPickerModal({
  open,
  onClose,
  onSelect,
  title,
  lockWebPosTerminal,
  branchOnly = false,
}: Props) {
  const { t } = useI18n();
  const { locations, locationId, isHqView, setLocationId, setHqView, load, loading } =
    useLocationStore();
  const showHqRow = !branchOnly && locations.length > 1;
  const [picked, setPicked] = useState(
    isHqView && showHqRow ? HQ_PICK : locationId || ''
  );

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    setPicked(isHqView && showHqRow ? HQ_PICK : locationId || '');
  }, [open, locationId, isHqView, showHqRow]);

  if (!open) return null;

  const confirm = () => {
    if (picked === HQ_PICK) {
      if (lockWebPosTerminal) return;
      setHqView();
      onSelect?.(null);
      onClose();
      return;
    }
    const loc = locations.find((l) => l.id === picked);
    if (!loc) return;
    if (lockWebPosTerminal) {
      setWebPosTerminalLocationId(loc.id);
    } else {
      setLocationId(loc.id);
    }
    onSelect?.(loc);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] shadow-xl">
        <div className="px-4 py-3 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold">{title || t('locationPickerTitle')}</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {branchOnly ? t('locationPickerPosHint') : t('locationPickerHint')}
          </p>
        </div>
        <div className="p-3 max-h-[60vh] overflow-y-auto space-y-2">
          {loading ? (
            <p className="text-sm text-[var(--text-muted)] px-2 py-4">{t('loading')}</p>
          ) : locations.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] px-2 py-4">{t('locationPickerEmpty')}</p>
          ) : (
            <>
              {showHqRow ? (
                <button
                  type="button"
                  onClick={() => setPicked(HQ_PICK)}
                  className={`w-full text-left rounded-lg border px-3 py-3 flex items-start gap-3 transition-colors ${
                    picked === HQ_PICK
                      ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/10'
                      : 'border-[var(--border)] hover:bg-[var(--bg-muted)]'
                  }`}
                >
                  <Network className="w-5 h-5 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{t('navHq')}</div>
                    <div className="text-xs text-[var(--text-muted)]">{t('locationPickerHqHint')}</div>
                  </div>
                  {picked === HQ_PICK ? (
                    <Check className="w-5 h-5 shrink-0 text-[var(--brand-primary)]" />
                  ) : null}
                </button>
              ) : null}
              {locations.map((loc) => {
                const active = picked === loc.id;
                return (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => setPicked(loc.id)}
                    className={`w-full text-left rounded-lg border px-3 py-3 flex items-start gap-3 transition-colors ${
                      active
                        ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/10'
                        : 'border-[var(--border)] hover:bg-[var(--bg-muted)]'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {loc.businessCategory === 'retail' ? (
                        <Building2 className="w-5 h-5" />
                      ) : (
                        <MapPin className="w-5 h-5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{loc.name}</div>
                      <div className="text-xs text-[var(--text-muted)] capitalize">
                        {loc.businessCategory}
                        {loc.city ? ` · ${loc.city}` : ''}
                      </div>
                    </div>
                    {active ? <Check className="w-5 h-5 shrink-0 text-[var(--brand-primary)]" /> : null}
                  </button>
                );
              })}
            </>
          )}
        </div>
        <div className="px-4 py-3 border-t border-[var(--border)] flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t('cancel')}
          </button>
          <button type="button" className="btn-primary" onClick={confirm} disabled={!picked}>
            {t('continue')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function LocationSwitcherChip() {
  const { t } = useI18n();
  const { location, locations, limits, isHqView, load } = useLocationStore();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    void load();
  }, [load]);

  if (
    !shouldShowLocationSwitcher({
      locationCount: locations.length,
      maxLocations: limits?.maxLocations,
    })
  ) {
    return null;
  }

  const label = isHqView ? t('navHq') : location?.name || t('selectLocation');

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 max-w-[min(12rem,40vw)] px-2 py-1 rounded-md text-xs border border-[var(--border)] hover:bg-[var(--bg-muted)] truncate shrink-0"
        title={t('switchLocation')}
      >
        {isHqView ? (
          <Network className="w-3.5 h-3.5 shrink-0" />
        ) : (
          <MapPin className="w-3.5 h-3.5 shrink-0" />
        )}
        <span className="truncate">{label}</span>
      </button>
      <LocationPickerModal
        open={open}
        onClose={() => setOpen(false)}
        title={t('switchLocation')}
      />
    </>
  );
}
