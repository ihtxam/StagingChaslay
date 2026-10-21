import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, RefreshCw, Upload } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useLocationStore } from '@/store/location';

type SyncProduct = { id: string; name: string; pending?: boolean };
type SyncCategory = { id: string; name: string; products: SyncProduct[] };
type LocationStat = {
  locationId: string;
  name: string;
  linkedCount: number;
  pendingCount: number;
};

type SyncState = {
  categories: SyncCategory[];
  uncategorizedProducts: SyncProduct[];
  locationStats: LocationStat[];
  pendingProductIds: string[];
};

export default function HqSyncMenuPage() {
  const { t } = useI18n();
  const { locations } = useLocationStore();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [state, setState] = useState<SyncState | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [selectedLocations, setSelectedLocations] = useState<Set<string>>(new Set());
  const [setOnSaleAfterSync, setSetOnSaleAfterSync] = useState(true);
  const [overwritePrices, setOverwritePrices] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/merchant/hq/catalog/sync-state');
      const s = res.data?.state as SyncState;
      setState(s);
      const pending = new Set<string>(s?.pendingProductIds || []);
      if (pending.size) {
        setSelectedProducts(pending);
      } else {
        const all = new Set<string>();
        for (const c of s?.categories || []) {
          for (const p of c.products) all.add(p.id);
        }
        for (const p of s?.uncategorizedProducts || []) all.add(p.id);
        setSelectedProducts(all);
      }
      if (!activeCategoryId && s?.categories?.[0]) {
        setActiveCategoryId(s.categories[0].id);
      }
    } catch {
      toast.error(t('hqSyncLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [activeCategoryId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (locations.length) {
      setSelectedLocations((prev) => (prev.size ? prev : new Set(locations.map((l) => l.id))));
    }
  }, [locations]);

  const categories = state?.categories || [];
  const activeCategory = categories.find((c) => c.id === activeCategoryId) || categories[0];
  const menuProducts = useMemo(() => {
    if (!activeCategoryId && state?.uncategorizedProducts?.length) {
      return state.uncategorizedProducts;
    }
    return activeCategory?.products || [];
  }, [activeCategory, activeCategoryId, state?.uncategorizedProducts]);

  const toggleProduct = (id: string) => {
    setSelectedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleCategoryProducts = (selectAll: boolean) => {
    const ids = menuProducts.map((p) => p.id);
    setSelectedProducts((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (selectAll) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  const toggleLocation = (id: string) => {
    setSelectedLocations((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runSync = async () => {
    if (selectedProducts.size === 0) {
      toast.error(t('hqSyncSelectProducts'));
      return;
    }
    if (selectedLocations.size === 0) {
      toast.error(t('hqSelectVersionAndLocations'));
      return;
    }
    setSyncing(true);
    try {
      const res = await api.post('/merchant/hq/catalog/sync', {
        locationIds: [...selectedLocations],
        productIds: [...selectedProducts],
        setOnSaleAfterSync,
        overwritePrices,
      });
      toast.success(t('hqPushSuccess', { count: res.data?.linked || 0 }));
      await load();
    } catch (e: unknown) {
      toast.error(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          t('hqSyncFailed')
      );
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/merchant/hq" className="btn-secondary text-sm inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" />
          {t('hqDashboardTitle')}
        </Link>
        <div>
          <h1 className="text-xl font-semibold">{t('hqSyncPageTitle')}</h1>
          <p className="text-sm text-[var(--text-muted)]">{t('hqSyncPageDescription')}</p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm muted">{t('loading')}</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-lg border border-[var(--border)] p-4 space-y-3 min-h-[420px]">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-medium">{t('hqSyncMenuColumn')}</h2>
              <button type="button" className="btn-secondary text-xs" onClick={() => void load()}>
                <RefreshCw className="w-3.5 h-3.5 inline mr-1" />
                {t('refresh')}
              </button>
            </div>
            <div className="flex flex-wrap gap-1 border-b border-[var(--border)] pb-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                    activeCategory?.id === cat.id
                      ? 'bg-[var(--bg-elevated)] shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                  onClick={() => setActiveCategoryId(cat.id)}
                >
                  {cat.name}
                </button>
              ))}
              {(state?.uncategorizedProducts?.length || 0) > 0 ? (
                <button
                  type="button"
                  className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                    !activeCategoryId
                      ? 'bg-[var(--bg-elevated)] shadow-sm'
                      : 'text-[var(--text-muted)]'
                  }`}
                  onClick={() => setActiveCategoryId(null)}
                >
                  {t('uncategorized')}
                </button>
              ) : null}
            </div>
            <div className="flex gap-2 text-xs">
              <button type="button" className="underline" onClick={() => toggleCategoryProducts(true)}>
                {t('selectAll')}
              </button>
              <button type="button" className="underline" onClick={() => toggleCategoryProducts(false)}>
                {t('deselectAll')}
              </button>
            </div>
            <ul className="space-y-1 max-h-[340px] overflow-y-auto pr-1">
              {menuProducts.map((p) => (
                <li key={p.id}>
                  <label className="flex items-center gap-2 text-sm py-1.5 rounded hover:bg-[var(--bg-muted)] px-1">
                    <input
                      type="checkbox"
                      checked={selectedProducts.has(p.id)}
                      onChange={() => toggleProduct(p.id)}
                    />
                    <span className="flex-1 truncate">{p.name}</span>
                    {p.pending ? (
                      <span className="text-[10px] uppercase font-semibold text-amber-700">
                        {t('hqSyncPendingBadge')}
                      </span>
                    ) : null}
                  </label>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-[var(--border)] p-4 space-y-4">
            <h2 className="font-medium">{t('hqSyncStoresColumn')}</h2>
            <ul className="space-y-2">
              {(state?.locationStats ||
                locations.map((l) => ({
                  locationId: l.id,
                  name: l.name,
                  linkedCount: 0,
                  pendingCount: 0,
                }))).map((loc) => (
                <li key={loc.locationId}>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={selectedLocations.has(loc.locationId)}
                      onChange={() => toggleLocation(loc.locationId)}
                    />
                    <span>
                      <span className="font-medium">{loc.name}</span>
                      <span className="block text-xs text-[var(--text-muted)]">
                        {t('hqSyncLocationStats', {
                          linked: loc.linkedCount,
                          pending: loc.pendingCount,
                        })}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={setOnSaleAfterSync}
                onChange={(e) => setSetOnSaleAfterSync(e.target.checked)}
              />
              {t('hqSyncOnSaleAfter')}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={overwritePrices}
                onChange={(e) => setOverwritePrices(e.target.checked)}
              />
              {t('hqOverwritePrices')}
            </label>
            <button
              type="button"
              className="btn-primary w-full sm:w-auto"
              disabled={syncing}
              onClick={() => void runSync()}
            >
              <Upload className="w-4 h-4 mr-1 inline" />
              {syncing ? t('saving') : t('hqSyncMenuCta')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
