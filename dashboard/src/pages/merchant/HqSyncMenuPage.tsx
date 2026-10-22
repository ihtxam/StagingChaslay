import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, RefreshCw, Upload } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useLocationStore } from '@/store/location';
import SearchableMultiSelect from '@/components/SearchableMultiSelect';

const UNCATEGORIZED_ID = '__uncategorized__';

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
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
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
        setSelectedProducts(new Set());
      }
      setSelectedCategoryIds([]);
    } catch {
      toast.error(t('hqSyncLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (locations.length) {
      setSelectedLocations((prev) => (prev.size ? prev : new Set(locations.map((l) => l.id))));
    }
  }, [locations]);

  const categories = state?.categories || [];

  const categoryOptions = useMemo(() => {
    const opts = categories.map((c) => ({ id: c.id, label: c.name }));
    if ((state?.uncategorizedProducts?.length || 0) > 0) {
      opts.push({ id: UNCATEGORIZED_ID, label: t('uncategorized') });
    }
    return opts;
  }, [categories, state?.uncategorizedProducts, t]);

  const visibleProductGroups = useMemo(() => {
    if (!selectedCategoryIds.length) return [];
    const groups: Array<{ key: string; title: string; products: SyncProduct[] }> = [];
    for (const catId of selectedCategoryIds) {
      if (catId === UNCATEGORIZED_ID) {
        const products = state?.uncategorizedProducts || [];
        if (products.length) {
          groups.push({ key: UNCATEGORIZED_ID, title: t('uncategorized'), products });
        }
        continue;
      }
      const cat = categories.find((c) => c.id === catId);
      if (cat?.products?.length) {
        groups.push({ key: cat.id, title: cat.name, products: cat.products });
      }
    }
    return groups;
  }, [categories, selectedCategoryIds, state?.uncategorizedProducts, t]);

  const visibleProductIds = useMemo(
    () => visibleProductGroups.flatMap((g) => g.products.map((p) => p.id)),
    [visibleProductGroups]
  );

  const toggleProduct = (id: string) => {
    setSelectedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleVisibleProducts = (selectAll: boolean) => {
    setSelectedProducts((prev) => {
      const next = new Set(prev);
      for (const id of visibleProductIds) {
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
    if (selectedCategoryIds.length === 0) {
      toast.error(t('hqSyncSelectCategories'));
      return;
    }
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
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2 min-w-0">
          <Link
            to="/merchant/hq"
            className="btn-secondary text-sm inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            {t('hqDashboardTitle')}
          </Link>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{t('hqSyncPageTitle')}</h1>
            <p className="text-sm text-[var(--text-muted)] mt-1 max-w-2xl">
              {t('hqSyncPageDescription')}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="btn-secondary text-sm shrink-0"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 inline mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          {t('refresh')}
        </button>
      </div>

      {loading ? (
        <p className="text-sm muted">{t('loading')}</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <section
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-sm p-5 space-y-4 min-h-[480px] flex flex-col"
          >
            <h2 className="text-base font-semibold">{t('hqSyncMenuColumn')}</h2>

            <SearchableMultiSelect
              label={t('hqSyncCategoriesLabel')}
              helperText={t('hqSyncCategoriesHelper')}
              placeholder={t('hqSyncCategoriesPlaceholder')}
              options={categoryOptions}
              value={selectedCategoryIds}
              onChange={setSelectedCategoryIds}
              required
            />

            {selectedCategoryIds.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)] rounded-lg border border-dashed border-[var(--border)] px-4 py-8 text-center">
                {t('hqSyncSelectCategoriesFirst')}
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs border-b border-[var(--border)] pb-2">
                  <span className="text-[var(--text-muted)]">
                    {t('hqSyncProductsInCategories', { count: visibleProductIds.length })}
                  </span>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      className="font-medium text-[var(--accent)] hover:underline"
                      onClick={() => toggleVisibleProducts(true)}
                    >
                      {t('selectAll')}
                    </button>
                    <button
                      type="button"
                      className="font-medium text-[var(--text-muted)] hover:underline"
                      onClick={() => toggleVisibleProducts(false)}
                    >
                      {t('deselectAll')}
                    </button>
                  </div>
                </div>
                <div className="flex-1 min-h-0 space-y-4 max-h-[380px] overflow-y-auto pr-1">
                  {visibleProductGroups.map((group) => (
                    <div key={group.key}>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2 sticky top-0 bg-[var(--bg-surface)] py-1">
                        {group.title}
                      </p>
                      <ul className="space-y-0.5">
                        {group.products.map((p) => (
                          <li key={p.id}>
                            <label
                              className="flex items-center gap-2.5 text-sm py-2 px-2 rounded-lg hover:bg-[var(--bg-muted)] cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                className="rounded border-[var(--border)]"
                                checked={selectedProducts.has(p.id)}
                                onChange={() => toggleProduct(p.id)}
                              />
                              <span className="flex-1 truncate">{p.name}</span>
                              {p.pending ? (
                                <span className="text-[10px] uppercase font-semibold text-amber-700 dark:text-amber-400 shrink-0">
                                  {t('hqSyncPendingBadge')}
                                </span>
                              ) : null}
                            </label>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          <section
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-sm p-5 space-y-5 lg:sticky lg:top-4"
          >
            <h2 className="text-base font-semibold">{t('hqSyncStoresColumn')}</h2>
            <ul className="space-y-3">
              {(state?.locationStats ||
                locations.map((l) => ({
                  locationId: l.id,
                  name: l.name,
                  linkedCount: 0,
                  pendingCount: 0,
                }))).map((loc) => (
                <li
                  key={loc.locationId}
                  className="rounded-lg border border-[var(--border)] px-3 py-2.5 hover:bg-[var(--bg-muted)]/50"
                >
                  <label className="flex items-start gap-3 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-0.5 rounded border-[var(--border)]"
                      checked={selectedLocations.has(loc.locationId)}
                      onChange={() => toggleLocation(loc.locationId)}
                    />
                    <span className="min-w-0">
                      <span className="font-medium block">{loc.name}</span>
                      <span className="block text-xs text-[var(--text-muted)] mt-0.5">
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
            <div className="space-y-3 pt-2 border-t border-[var(--border)]">
              <label className="flex items-start gap-2.5 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded border-[var(--border)]"
                  checked={setOnSaleAfterSync}
                  onChange={(e) => setSetOnSaleAfterSync(e.target.checked)}
                />
                <span>{t('hqSyncOnSaleAfter')}</span>
              </label>
              <label className="flex items-start gap-2.5 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded border-[var(--border)]"
                  checked={overwritePrices}
                  onChange={(e) => setOverwritePrices(e.target.checked)}
                />
                <span>{t('hqOverwritePrices')}</span>
              </label>
            </div>
            <button
              type="button"
              className="btn-primary w-full py-2.5 text-base font-medium"
              disabled={syncing || selectedCategoryIds.length === 0}
              onClick={() => void runSync()}
            >
              <Upload className="w-4 h-4 mr-2 inline" />
              {syncing ? t('saving') : t('hqSyncMenuCta')}
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
