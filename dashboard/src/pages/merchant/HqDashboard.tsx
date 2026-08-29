import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Building2, RefreshCw, Upload } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useLocationStore } from '@/store/location';

type HqVersion = {
  id: string;
  version: number;
  name: string;
  createdAt: string;
};

export default function HqDashboardPage() {
  const { t } = useI18n();
  const { locations } = useLocationStore();
  const [versions, setVersions] = useState<HqVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [pushing, setPushing] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState('');
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [overwritePrices, setOverwritePrices] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/merchant/hq/catalog/versions');
      const rows: HqVersion[] = res.data?.versions || [];
      setVersions(rows);
      if (!selectedVersion && rows[0]) setSelectedVersion(rows[0].id);
    } catch {
      toast.error(t('hqLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [selectedVersion, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const createSnapshot = async () => {
    try {
      await api.post('/merchant/hq/catalog/versions', { name: `HQ Menu ${new Date().toLocaleDateString()}` });
      toast.success(t('hqSnapshotCreated'));
      await load();
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed');
    }
  };

  const push = async () => {
    if (!selectedVersion || selectedLocations.length === 0) {
      toast.error(t('hqSelectVersionAndLocations'));
      return;
    }
    setPushing(true);
    try {
      const res = await api.post('/merchant/hq/catalog/push', {
        versionId: selectedVersion,
        locationIds: selectedLocations,
        overwritePrices,
      });
      toast.success(t('hqPushSuccess', { count: res.data?.linked || 0 }));
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Push failed');
    } finally {
      setPushing(false);
    }
  };

  const toggleLocation = (id: string) => {
    setSelectedLocations((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const multiLocation = locations.length > 1;

  return (
    <div className="p-4 sm:p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          {t('hqDashboardTitle')}
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">{t('hqDashboardDescription')}</p>
      </div>

      {!multiLocation ? (
        <div className="rounded-lg border border-[var(--border)] p-4 text-sm text-[var(--text-muted)]">
          {t('hqNeedsMultipleLocations')}
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-[var(--border)] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-medium">{t('hqCatalogVersions')}</h2>
              <button type="button" className="btn-secondary text-sm" onClick={() => void createSnapshot()}>
                <RefreshCw className="w-4 h-4 mr-1 inline" />
                {t('hqCreateSnapshot')}
              </button>
            </div>
            {loading ? (
              <p className="text-sm text-[var(--text-muted)]">{t('loading')}</p>
            ) : versions.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">{t('hqNoVersions')}</p>
            ) : (
              <select
                className="input w-full"
                value={selectedVersion}
                onChange={(e) => setSelectedVersion(e.target.value)}
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} (v{v.version})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="rounded-lg border border-[var(--border)] p-4 space-y-3">
            <h2 className="font-medium">{t('hqPushToLocations')}</h2>
            <div className="space-y-2">
              {locations.map((loc) => (
                <label key={loc.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedLocations.includes(loc.id)}
                    onChange={() => toggleLocation(loc.id)}
                  />
                  {loc.name}
                </label>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={overwritePrices}
                onChange={(e) => setOverwritePrices(e.target.checked)}
              />
              {t('hqOverwritePrices')}
            </label>
            <button type="button" className="btn-primary" disabled={pushing} onClick={() => void push()}>
              <Upload className="w-4 h-4 mr-1 inline" />
              {pushing ? t('saving') : t('hqPushMenu')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
