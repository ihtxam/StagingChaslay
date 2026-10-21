import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Layers, MapPin, Plus, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { canAddLocation, isAtLocationLimit } from '@/lib/location-limits';
import { useLocationStore, type MerchantLocation } from '@/store/location';
import { SettingsReportCard } from '@/components/settings/SettingsReportUi';
import LocationFormModal from '@/components/merchant/LocationFormModal';
import LocationRegistersModal from '@/components/merchant/LocationRegistersModal';

export default function SettingsLocationsTab() {
  const { t } = useI18n();
  const { refresh } = useLocationStore();
  const [locations, setLocations] = useState<MerchantLocation[]>([]);
  const [limits, setLimits] = useState<{ maxLocations: number; currentCount: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [merchantSlug, setMerchantSlug] = useState('');
  const [stationCounts, setStationCounts] = useState<Record<string, number>>({});

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardMode, setWizardMode] = useState<'create' | 'edit'>('create');
  const [wizardLocation, setWizardLocation] = useState<MerchantLocation | null>(null);

  const [registersOpen, setRegistersOpen] = useState(false);
  const [registersLocation, setRegistersLocation] = useState<MerchantLocation | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, settingsRes] = await Promise.all([
        api.get('/merchant/locations'),
        api.get('/merchant/settings'),
      ]);
      const rows: MerchantLocation[] = res.data?.locations || [];
      setLocations(rows);
      setLimits(res.data?.limits || null);
      setMerchantSlug(settingsRes.data?.merchant?.slug || settingsRes.data?.settings?.slug || '');
      const counts: Record<string, number> = {};
      await Promise.all(
        rows.map(async (loc) => {
          try {
            const st = await api.get(`/merchant/locations/${loc.id}/stations`);
            counts[loc.id] = (st.data?.stations || []).length;
          } catch {
            counts[loc.id] = 0;
          }
        })
      );
      setStationCounts(counts);
    } catch (e: unknown) {
      toast.error(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to load locations'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setWizardMode('create');
    setWizardLocation(null);
    setWizardOpen(true);
  };

  const openEdit = (loc: MerchantLocation) => {
    setWizardMode('edit');
    setWizardLocation(loc);
    setWizardOpen(true);
  };

  const openRegisters = (loc: MerchantLocation) => {
    setRegistersLocation(loc);
    setRegistersOpen(true);
  };

  const onWizardSaved = async () => {
    await load();
    await refresh();
  };

  const onRegistersClose = () => {
    setRegistersOpen(false);
    setRegistersLocation(null);
    void load();
  };

  const onDelete = async (id: string) => {
    if (!window.confirm(t('locationDeleteConfirm'))) return;
    try {
      await api.delete(`/merchant/locations/${id}`);
      toast.success(t('locationDeleted'));
      await load();
      await refresh();
    } catch (err: unknown) {
      toast.error(
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Delete failed'
      );
    }
  };

  const allowAdd = canAddLocation(limits);
  const atLimit = isAtLocationLimit(limits);

  return (
    <div className="space-y-6">
      <SettingsReportCard
        title={t('locationsTitle')}
        description={t('locationsDescription')}
        icon={MapPin}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          {limits ? (
            <p
              className={`text-sm ${atLimit ? 'text-amber-800 dark:text-amber-200 font-medium' : 'text-[var(--text-muted)]'}`}
            >
              {limits.maxLocations > 0
                ? t('locationsUsage', { current: limits.currentCount, max: limits.maxLocations })
                : t('locationsUsageUnlimited', { current: limits.currentCount })}
            </p>
          ) : null}
          {allowAdd ? (
            <button type="button" className="btn-primary text-sm shrink-0 inline-flex items-center gap-1" onClick={openCreate}>
              <Plus className="w-4 h-4" />
              {t('addLocation')}
            </button>
          ) : null}
        </div>

        {loading ? (
          <p className="text-sm text-[var(--text-muted)]">{t('loading')}</p>
        ) : locations.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] rounded-lg border border-dashed border-[var(--border)] px-3 py-6 text-center">
            {t('locationPickerEmpty')}
          </p>
        ) : (
          <div className="space-y-3">
            {locations.map((loc) => (
              <div
                key={loc.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-[var(--border)] px-3 py-3"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    {loc.name}
                    {loc.isDefault ? (
                      <span className="ml-2 text-xs text-[var(--text-muted)]">({t('default')})</span>
                    ) : null}
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {loc.businessCategory === 'retail'
                      ? t('retail')
                      : loc.businessCategory === 'restaurant'
                        ? t('restaurant')
                        : loc.businessCategory}
                    {loc.city ? ` · ${loc.city}` : ''}
                    {stationCounts[loc.id] != null ? (
                      <span className="ml-1">
                        · {t('locationRegisterCount', { count: stationCounts[loc.id] })}
                      </span>
                    ) : null}
                  </div>
                  {loc.slug && merchantSlug ? (
                    <a
                      className="text-xs text-sky-700 underline break-all"
                      href={`${window.location.origin}/shop/${merchantSlug}/l/${loc.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {t('locationShopLink')}
                    </a>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    className="btn-secondary text-xs inline-flex items-center gap-1"
                    onClick={() => openRegisters(loc)}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    {t('locationManageRegisters')}
                  </button>
                  <button type="button" className="btn-secondary text-xs" onClick={() => openEdit(loc)}>
                    {t('edit')}
                  </button>
                  {!loc.isDefault ? (
                    <button
                      type="button"
                      className="btn-secondary text-xs text-red-600"
                      onClick={() => void onDelete(loc.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </SettingsReportCard>

      <LocationFormModal
        open={wizardOpen}
        mode={wizardMode}
        initial={wizardLocation}
        onClose={() => setWizardOpen(false)}
        onSaved={() => {
          void onWizardSaved();
        }}
      />

      <LocationRegistersModal
        open={registersOpen}
        locationId={registersLocation?.id ?? null}
        locationName={registersLocation?.name ?? ''}
        onClose={onRegistersClose}
      />
    </div>
  );
}
