import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Layers, Trash2, X } from 'lucide-react';
import type { PosStation } from '@/lib/pos-station';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';

type Props = {
  open: boolean;
  locationId: string | null;
  locationName: string;
  onClose: () => void;
};

export default function LocationRegistersModal({ open, locationId, locationName, onClose }: Props) {
  const { t } = useI18n();
  const [stations, setStations] = useState<PosStation[]>([]);
  const [loading, setLoading] = useState(false);
  const [stationName, setStationName] = useState('');
  const [saving, setSaving] = useState(false);

  const loadStations = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await api.get(`/merchant/locations/${locationId}/stations`);
      setStations(res.data?.stations || []);
    } catch {
      setStations([]);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    if (!open || !locationId) return;
    setStationName('');
    void loadStations();
  }, [open, locationId, loadStations]);

  if (!open || !locationId) return null;

  const onAddStation = async () => {
    if (!stationName.trim()) {
      toast.error(t('posStationName'));
      return;
    }
    setSaving(true);
    try {
      await api.post(`/merchant/locations/${locationId}/stations`, {
        name: stationName.trim(),
        sortOrder: (stations.length + 1) * 10,
        isDefault: stations.length === 0,
      });
      setStationName('');
      await loadStations();
      toast.success(t('saved'));
    } catch (err: unknown) {
      toast.error(
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Save failed'
      );
    } finally {
      setSaving(false);
    }
  };

  const onDeleteStation = async (stationId: string) => {
    if (!window.confirm(t('confirm'))) return;
    try {
      await api.delete(`/merchant/locations/${locationId}/stations/${stationId}`);
      await loadStations();
      toast.success(t('saved'));
    } catch (err: unknown) {
      toast.error(
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Delete failed'
      );
    }
  };

  const onSetDefaultStation = async (stationId: string) => {
    try {
      await api.put(`/merchant/locations/${locationId}/stations/${stationId}`, { isDefault: true });
      await loadStations();
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/50">
      <div
        className="w-full max-w-md rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] shadow-xl max-h-[90vh] flex flex-col"
        role="dialog"
        aria-labelledby="location-registers-title"
      >
        <div className="px-4 py-3 border-b border-[var(--border)] flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 id="location-registers-title" className="text-lg font-semibold flex items-center gap-2">
              <Layers className="w-5 h-5 shrink-0" />
              {t('posStationsTitle')}
            </h2>
            <p className="text-sm text-[var(--text-muted)] mt-1 truncate">{locationName}</p>
          </div>
          <button type="button" className="btn-secondary p-2 shrink-0" onClick={onClose} aria-label={t('cancel')}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto space-y-3 flex-1">
          <p className="text-sm text-[var(--text-muted)]">{t('posStationsHint')}</p>
          {loading ? (
            <p className="text-sm text-[var(--text-muted)]">{t('loading')}</p>
          ) : stations.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] rounded-lg border border-dashed border-[var(--border)] px-3 py-4">
              {t('locationRegistersEmpty')}
            </p>
          ) : (
            <div className="space-y-2">
              {stations.map((st) => (
                <div
                  key={st.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2"
                >
                  <div>
                    <span className="font-medium">{st.name}</span>
                    {st.isDefault ? (
                      <span className="ml-2 text-xs text-[var(--text-muted)]">({t('default')})</span>
                    ) : null}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {!st.isDefault ? (
                      <button
                        type="button"
                        className="btn-secondary text-xs"
                        onClick={() => void onSetDefaultStation(st.id)}
                      >
                        {t('default')}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn-secondary text-xs text-red-600"
                      onClick={() => void onDeleteStation(st.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-[var(--border)]">
            <input
              className="input flex-1"
              placeholder={t('posStationNamePlaceholder')}
              value={stationName}
              onChange={(e) => setStationName(e.target.value)}
            />
            <button
              type="button"
              className="btn-primary shrink-0"
              disabled={saving}
              onClick={() => void onAddStation()}
            >
              {t('posStationAdd')}
            </button>
          </div>
        </div>
        <div className="px-4 py-3 border-t border-[var(--border)] flex justify-end">
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
}
