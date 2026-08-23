import { useCallback, useEffect, useState } from 'react';
import { Copy, Plus, RefreshCw, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { KDS_SHELL_THEMES, type KdsShellTheme } from '@/lib/kds-channel-styles';
import { useI18n } from '@/lib/i18n';

type KdsStation = {
  id: string;
  name: string;
  token: string;
  orderTypes: string[];
  categoryIds: string[];
  productIds: string[];
  theme?: string;
  layoutMode?: string;
  gridColumns?: number;
  overdueMinutes?: number;
  isActive: boolean;
};

const KDS_THEME_OPTIONS: KdsShellTheme[] = ['dark', 'light', 'teal'];
const KDS_LAYOUT_OPTIONS = ['grid', 'rows', 'slider'] as const;
type KdsLayoutMode = (typeof KDS_LAYOUT_OPTIONS)[number];

type Category = {
  id: string;
  name: string;
};

const CHANNELS = ['takeaway', 'dine_in', 'delivery'] as const;

function kdsPublicUrl(token: string): string {
  const origin =
    (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined) ||
    (typeof window !== 'undefined' ? window.location.origin : 'https://app.chaslay.com');
  return `${origin.replace(/\/$/, '')}/kds/${token}`;
}

export default function KdsSettingsPanel() {
  const { t } = useI18n();
  const [stations, setStations] = useState<KdsStation[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [orderTypes, setOrderTypes] = useState<string[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [theme, setTheme] = useState<KdsShellTheme>('dark');
  const [layoutMode, setLayoutMode] = useState<KdsLayoutMode>('grid');
  const [gridColumns, setGridColumns] = useState(3);
  const [overdueMinutes, setOverdueMinutes] = useState(20);
  const [busy, setBusy] = useState(false);
  const [licenseError, setLicenseError] = useState(false);
  const [savingStationId, setSavingStationId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [stationsRes, categoriesRes] = await Promise.all([
        api.get('/merchant/kds/stations'),
        api.get('/merchant/categories').catch(() => ({ data: { categories: [] } })),
      ]);
      setStations(stationsRes.data?.stations || []);
      setCategories(
        (categoriesRes.data?.categories || []).map((c: Category) => ({
          id: c.id,
          name: c.name,
        }))
      );
      setLicenseError(false);
    } catch (e: any) {
      if (e.response?.data?.code === 'KDS_ADDON_REQUIRED') {
        setLicenseError(true);
        setStations([]);
      } else {
        toast.error(e.response?.data?.error || t('kdsLoadFailed'));
      }
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const createStation = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await api.post('/merchant/kds/stations', {
        name: trimmed,
        orderTypes,
        categoryIds,
        theme,
        layoutMode,
        gridColumns,
        overdueMinutes,
      });
      setName('');
      setOrderTypes([]);
      setCategoryIds([]);
      setTheme('dark');
      setLayoutMode('grid');
      setGridColumns(3);
      setOverdueMinutes(20);
      toast.success(t('kdsStationCreated'));
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('kdsActionFailed'));
    } finally {
      setBusy(false);
    }
  };

  const updateStationFilters = async (
    id: string,
    patch: {
      orderTypes?: string[];
      categoryIds?: string[];
      theme?: KdsShellTheme;
      layoutMode?: KdsLayoutMode;
      gridColumns?: number;
      overdueMinutes?: number;
    }
  ) => {
    setSavingStationId(id);
    try {
      const station = stations.find((s) => s.id === id);
      if (!station) return;
      await api.put(`/merchant/kds/stations/${id}`, {
        orderTypes: patch.orderTypes ?? station.orderTypes,
        categoryIds: patch.categoryIds ?? station.categoryIds,
        theme: patch.theme ?? station.theme ?? 'dark',
        layoutMode: patch.layoutMode ?? station.layoutMode ?? 'grid',
        gridColumns: patch.gridColumns ?? station.gridColumns ?? 3,
        overdueMinutes: patch.overdueMinutes ?? station.overdueMinutes ?? 20,
      });
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('kdsActionFailed'));
    } finally {
      setSavingStationId(null);
    }
  };

  const rotateToken = async (id: string) => {
    try {
      await api.post(`/merchant/kds/stations/${id}/rotate-token`);
      toast.success(t('kdsTokenRotated'));
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('kdsActionFailed'));
    }
  };

  const removeStation = async (id: string) => {
    if (!window.confirm(t('kdsDeleteConfirm'))) return;
    try {
      await api.delete(`/merchant/kds/stations/${id}`);
      toast.success(t('kdsStationDeleted'));
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('kdsActionFailed'));
    }
  };

  const copyUrl = async (token: string) => {
    const url = kdsPublicUrl(token);
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t('kdsUrlCopied'));
    } catch {
      toast.error(url);
    }
  };

  const toggleChannel = (ch: string) => {
    setOrderTypes((prev) => (prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]));
  };

  const toggleCategory = (id: string) => {
    setCategoryIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };

  const toggleStationChannel = (station: KdsStation, ch: string) => {
    const next = station.orderTypes.includes(ch)
      ? station.orderTypes.filter((c) => c !== ch)
      : [...station.orderTypes, ch];
    void updateStationFilters(station.id, { orderTypes: next });
  };

  const toggleStationCategory = (station: KdsStation, id: string) => {
    const next = station.categoryIds.includes(id)
      ? station.categoryIds.filter((c) => c !== id)
      : [...station.categoryIds, id];
    void updateStationFilters(station.id, { categoryIds: next });
  };

  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name || id.slice(0, 8);

  const themeLabel = (th: KdsShellTheme) => {
    if (th === 'light') return t('kdsTheme_light');
    if (th === 'teal') return t('kdsTheme_teal');
    return t('kdsTheme_dark');
  };

  const layoutLabel = (mode: KdsLayoutMode) => {
    if (mode === 'rows') return t('kdsLayout_rows');
    if (mode === 'slider') return t('kdsLayout_slider');
    return t('kdsLayout_grid');
  };

  const LayoutPicker = ({
    value,
    disabled,
    onChange,
  }: {
    value: KdsLayoutMode;
    disabled?: boolean;
    onChange: (mode: KdsLayoutMode) => void;
  }) => (
    <div>
      <p className="mb-2 text-xs font-medium text-stone-600">{t('kdsLayoutLabel')}</p>
      <div className="flex flex-wrap gap-2">
        {KDS_LAYOUT_OPTIONS.map((mode) => (
          <button
            key={mode}
            type="button"
            disabled={disabled}
            onClick={() => onChange(mode)}
            className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
              value === mode
                ? 'border-teal-600 bg-teal-50 text-teal-800 ring-2 ring-teal-200'
                : 'border-stone-200 hover:border-stone-300'
            }`}
          >
            {layoutLabel(mode)}
          </button>
        ))}
      </div>
      <p className="mt-1 text-xs text-stone-500">{t('kdsLayoutHint')}</p>
    </div>
  );

  const GridColumnsPicker = ({
    value,
    layoutMode,
    disabled,
    onChange,
  }: {
    value: number;
    layoutMode: KdsLayoutMode;
    disabled?: boolean;
    onChange: (n: number) => void;
  }) => {
    if (layoutMode !== 'grid') return null;
    return (
      <div>
        <p className="mb-2 text-xs font-medium text-stone-600">{t('kdsGridColumnsLabel')}</p>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <button
              key={n}
              type="button"
              disabled={disabled}
              onClick={() => onChange(n)}
              className={`h-9 w-9 rounded-lg text-sm font-bold ${
                value === n ? 'bg-teal-600 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const ThemePicker = ({
    value,
    disabled,
    onChange,
  }: {
    value: KdsShellTheme;
    disabled?: boolean;
    onChange: (theme: KdsShellTheme) => void;
  }) => (
    <div>
      <p className="mb-2 text-xs font-medium text-stone-600">{t('kdsThemeLabel')}</p>
      <div className="flex flex-wrap gap-2">
        {KDS_THEME_OPTIONS.map((th) => {
          const shell = KDS_SHELL_THEMES[th];
          const selected = value === th;
          return (
            <button
              key={th}
              type="button"
              disabled={disabled}
              onClick={() => onChange(th)}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                selected
                  ? 'border-teal-600 ring-2 ring-teal-200'
                  : 'border-stone-200 hover:border-stone-300'
              }`}
            >
              <span
                className={`mb-1 block h-6 w-16 rounded ${shell.shell}`}
                aria-hidden
              />
              {themeLabel(th)}
            </button>
          );
        })}
      </div>
      <p className="mt-1 text-xs text-stone-500">{t('kdsThemeHint')}</p>
    </div>
  );

  if (licenseError) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        {t('kdsAddonRequired')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">{t('kdsSettingsTitle')}</h3>
        <p className="mt-1 text-sm text-stone-500">{t('kdsSettingsHint')}</p>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-3">
        <p className="text-sm font-medium">{t('kdsAddStation')}</p>
        <input
          className="input w-full"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('kdsStationNamePlaceholder')}
        />
        <div>
          <p className="mb-2 text-xs font-medium text-stone-600">{t('kdsOrderTypesLabel')}</p>
          <div className="flex flex-wrap gap-2">
            {CHANNELS.map((ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => toggleChannel(ch)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  orderTypes.includes(ch)
                    ? 'bg-teal-600 text-white'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                {ch}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-stone-500">{t('kdsChannelFilterHint')}</p>
        </div>
        {categories.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-medium text-stone-600">{t('kdsCategoriesLabel')}</p>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => toggleCategory(cat.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    categoryIds.includes(cat.id)
                      ? 'bg-violet-600 text-white'
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-stone-500">{t('kdsCategoryFilterHint')}</p>
          </div>
        ) : null}
        <ThemePicker value={theme} onChange={setTheme} />
        <LayoutPicker value={layoutMode} onChange={setLayoutMode} />
        <GridColumnsPicker value={gridColumns} layoutMode={layoutMode} onChange={setGridColumns} />
        <div>
          <p className="mb-2 text-xs font-medium text-stone-600">{t('kdsOverdueMinutesLabel')}</p>
          <input
            type="number"
            min={5}
            max={120}
            className="input w-24"
            value={overdueMinutes}
            onChange={(e) => setOverdueMinutes(Math.min(120, Math.max(5, Number(e.target.value) || 20)))}
          />
          <p className="mt-1 text-xs text-stone-500">{t('kdsOverdueMinutesHint')}</p>
        </div>
        <button
          type="button"
          disabled={busy || !name.trim()}
          onClick={() => void createStation()}
          className="btn-primary inline-flex items-center gap-2"
        >
          <Plus className="h-4 w-4" aria-hidden />
          {t('kdsAddStation')}
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-stone-500">{t('loading')}</p>
      ) : !stations.length ? (
        <p className="text-sm text-stone-500">{t('kdsNoStations')}</p>
      ) : (
        <ul className="space-y-3">
          {stations.map((s) => {
            const url = kdsPublicUrl(s.token);
            const saving = savingStationId === s.id;
            return (
              <li key={s.id} className="rounded-xl border border-stone-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{s.name}</p>
                    <p className="mt-1 break-all font-mono text-xs text-stone-500">{url}</p>
                    <div className="mt-3 space-y-2">
                      <div>
                        <p className="text-xs font-medium text-stone-600">{t('kdsOrderTypesLabel')}</p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {CHANNELS.map((ch) => (
                            <button
                              key={ch}
                              type="button"
                              disabled={saving}
                              onClick={() => toggleStationChannel(s, ch)}
                              className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                                s.orderTypes.includes(ch)
                                  ? 'bg-teal-600 text-white'
                                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                              }`}
                            >
                              {ch}
                            </button>
                          ))}
                        </div>
                      </div>
                      {categories.length > 0 ? (
                        <div>
                          <p className="text-xs font-medium text-stone-600">{t('kdsCategoriesLabel')}</p>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {categories.map((cat) => (
                              <button
                                key={cat.id}
                                type="button"
                                disabled={saving}
                                onClick={() => toggleStationCategory(s, cat.id)}
                                className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                                  s.categoryIds.includes(cat.id)
                                    ? 'bg-violet-600 text-white'
                                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                                }`}
                              >
                                {cat.name}
                              </button>
                            ))}
                          </div>
                          {!s.categoryIds.length ? (
                            <p className="mt-1 text-xs text-stone-500">{t('kdsCategoryFilterHint')}</p>
                          ) : (
                            <p className="mt-1 text-xs text-stone-500">
                              {s.categoryIds.map(categoryName).join(', ')}
                            </p>
                          )}
                        </div>
                      ) : null}
                      <ThemePicker
                        value={
                          (['dark', 'light', 'teal'].includes(String(s.theme || 'dark').toLowerCase())
                            ? String(s.theme).toLowerCase()
                            : 'dark') as KdsShellTheme
                        }
                        disabled={saving}
                        onChange={(next) => void updateStationFilters(s.id, { theme: next })}
                      />
                      <LayoutPicker
                        value={
                          (['grid', 'rows', 'slider'].includes(String(s.layoutMode || 'grid').toLowerCase())
                            ? String(s.layoutMode).toLowerCase()
                            : 'grid') as KdsLayoutMode
                        }
                        disabled={saving}
                        onChange={(next) => void updateStationFilters(s.id, { layoutMode: next })}
                      />
                      <GridColumnsPicker
                        value={Math.min(6, Math.max(1, Number(s.gridColumns) || 3))}
                        layoutMode={
                          (['grid', 'rows', 'slider'].includes(String(s.layoutMode || 'grid').toLowerCase())
                            ? String(s.layoutMode).toLowerCase()
                            : 'grid') as KdsLayoutMode
                        }
                        disabled={saving}
                        onChange={(next) => void updateStationFilters(s.id, { gridColumns: next })}
                      />
                      <div>
                        <p className="text-xs font-medium text-stone-600">{t('kdsOverdueMinutesLabel')}</p>
                        <input
                          type="number"
                          min={5}
                          max={120}
                          disabled={saving}
                          className="input mt-1 w-24 text-sm"
                          value={Math.min(120, Math.max(5, Number(s.overdueMinutes) || 20))}
                          onChange={(e) =>
                            void updateStationFilters(s.id, {
                              overdueMinutes: Math.min(120, Math.max(5, Number(e.target.value) || 20)),
                            })
                          }
                        />
                        <p className="mt-1 text-xs text-stone-500">{t('kdsOverdueMinutesHint')}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="rounded-lg border border-stone-300 p-2 hover:bg-stone-50"
                      title={t('kdsCopyUrl')}
                      onClick={() => void copyUrl(s.token)}
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-stone-300 p-2 hover:bg-stone-50"
                      title={t('kdsRotateToken')}
                      onClick={() => void rotateToken(s.id)}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-red-200 p-2 text-red-700 hover:bg-red-50"
                      title={t('delete')}
                      onClick={() => void removeStation(s.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
