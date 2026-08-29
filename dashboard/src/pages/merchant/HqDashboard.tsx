import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Building2, RefreshCw, Upload } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useLocationStore } from '@/store/location';
import { shopBasePath } from '@/lib/shop-cart';

type HqVersion = {
  id: string;
  version: number;
  name: string;
  createdAt: string;
};

type OrgAnalytics = {
  totalRevenue: number;
  totalOrders: number;
  netTotal: number;
  byLocation: Array<{ locationId: string; name: string; revenue: number; orders: number }>;
};

export default function HqDashboardPage() {
  const { t } = useI18n();
  const { locations } = useLocationStore();
  const [versions, setVersions] = useState<HqVersion[]>([]);
  const [analytics, setAnalytics] = useState<OrgAnalytics | null>(null);
  const [merchantSlug, setMerchantSlug] = useState('');
  const [loading, setLoading] = useState(true);
  const [pushing, setPushing] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState('');
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [overwritePrices, setOverwritePrices] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [versionsRes, analyticsRes, settingsRes] = await Promise.all([
        api.get('/merchant/hq/catalog/versions'),
        api.get('/merchant/hq/analytics', { params: { preset: 'today' } }),
        api.get('/merchant/settings'),
      ]);
      const rows: HqVersion[] = versionsRes.data?.versions || [];
      setVersions(rows);
      setAnalytics(analyticsRes.data?.analytics || null);
      setMerchantSlug(settingsRes.data?.merchant?.slug || settingsRes.data?.settings?.slug || '');
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

      {analytics && multiLocation ? (
        <div className="rounded-lg border border-[var(--border)] p-4 space-y-3">
          <h2 className="font-medium">{t('hqOrgAnalyticsTitle')}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-[var(--text-muted)]">{t('totalSales')}</p>
              <p className="text-lg font-bold tabular-nums">CHF {analytics.totalRevenue.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-[var(--text-muted)]">{t('orders')}</p>
              <p className="text-lg font-bold tabular-nums">{analytics.totalOrders}</p>
            </div>
            <div>
              <p className="text-[var(--text-muted)]">{t('netSales')}</p>
              <p className="text-lg font-bold tabular-nums">CHF {analytics.netTotal.toFixed(2)}</p>
            </div>
          </div>
          {analytics.byLocation.length > 0 ? (
            <table className="w-full text-sm mt-2">
              <thead>
                <tr className="text-left text-[var(--text-muted)]">
                  <th className="py-1">{t('locationName')}</th>
                  <th className="py-1 text-right">{t('orders')}</th>
                  <th className="py-1 text-right">{t('revenue')}</th>
                </tr>
              </thead>
              <tbody>
                {analytics.byLocation.map((row) => (
                  <tr key={row.locationId} className="border-t border-[var(--border)]">
                    <td className="py-1.5">{row.name}</td>
                    <td className="py-1.5 text-right tabular-nums">{row.orders}</td>
                    <td className="py-1.5 text-right tabular-nums">CHF {row.revenue.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      ) : null}

      {!multiLocation ? (
        <div className="rounded-lg border border-[var(--border)] p-4 text-sm text-[var(--text-muted)]">
          {t('hqNeedsMultipleLocations')}
        </div>
      ) : (
        <>
          {merchantSlug ? (
            <div className="rounded-lg border border-[var(--border)] p-4 space-y-2">
              <h2 className="font-medium">{t('locationShopUrlsTitle')}</h2>
              <p className="text-xs text-[var(--text-muted)]">{t('locationShopUrlsHint')}</p>
              <ul className="text-sm space-y-1">
                {locations.map((loc) => {
                  const path = shopBasePath(merchantSlug, loc.slug);
                  const url = `${window.location.origin}${path || `/shop/${merchantSlug}/l/${loc.slug}`}`;
                  return (
                    <li key={loc.id} className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{loc.name}:</span>
                      <a href={url} className="text-sky-700 underline break-all" target="_blank" rel="noreferrer">
                        {url}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

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
