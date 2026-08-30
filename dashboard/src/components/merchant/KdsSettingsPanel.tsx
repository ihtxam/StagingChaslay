import { useCallback, useEffect, useState } from 'react';
import { Copy, Plus, RefreshCw, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import KdsGridColumnsPicker from '@/components/kds/KdsGridColumnsPicker';
import KdsLayoutModePicker, { type KdsLayoutMode } from '@/components/kds/KdsLayoutModePicker';
import { KDS_SHELL_THEMES, type KdsShellTheme } from '@/lib/kds-channel-styles';
import { useI18n } from '@/lib/i18n';

type KdsStation = {
  id: string;
  name: string;
  token: string;
  shortCode?: string | null;
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

type Category = {
  id: string;
  name: string;
};

const CHANNELS = ['takeaway', 'dine_in', 'delivery'] as const;

const PANEL_CARD = 'rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]';
const CHIP_IDLE = 'bg-[var(--bg-muted)] text-[var(--text)] hover:opacity-90';
const ICON_BTN = 'rounded-lg border border-[var(--border)] p-2 hover:bg-[var(--bg-muted)]';

function kdsPublicUrl(station: Pick<KdsStation, 'shortCode' | 'token'>): string {
  const origin =
    (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined) ||
    (typeof window !== 'undefined' ? window.location.origin : 'https://app.rebornsense.com');
  const code = (station.shortCode || station.token).trim();
  return `${origin.replace(/\/$/, '')}/kds/${code}`;
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
  const [createOpen, setCreateOpen] = useState(false);
  const [licenseError, setLicenseError] = useState(false);
  const [savingStationId, setSavingStationId] = useState<string | null>(null);

  const resetCreateForm = () => {
    setName('');
    setOrderTypes([]);
    setCategoryIds([]);
    setTheme('dark');
    setLayoutMode('grid');
    setGridColumns(3);
    setOverdueMinutes(20);
  };

  const closeCreateForm = () => {
    setCreateOpen(false);
    resetCreateForm();
  };

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
      closeCreateForm();
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

  const copyUrl = async (station: Pick<KdsStation, 'shortCode' | 'token'>) => {
    const url = kdsPublicUrl(station);
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
      <p className="mb-2 text-xs font-medium text-[var(--text-muted)]">{t('kdsThemeLabel')}</p>
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
                  ? 'border-teal-600 ring-2 ring-teal-200 dark:ring-teal-800'
                  : 'border-[var(--border)] hover:border-[var(--text-muted)]'
              }`}
            >
              <span className={`mb-1 block h-6 w-16 rounded ${shell.shell}`} aria-hidden />
              {themeLabel(th)}
            </button>
          );
        })}
      </div>
      <p className="mt-1 text-xs text-[var(--text-muted)]">{t('kdsThemeHint')}</p>
    </div>
  );

  if (licenseError) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
        {t('kdsAddonRequired')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[var(--text)]">{t('kdsStations')}</h2>
        {!createOpen ? (
          <button
            type="button"
            className="btn-primary text-sm inline-flex items-center gap-1"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4" aria-hidden />
            {t('kdsAddStation')}
          </button>
        ) : null}
      </div>

      {createOpen ? (
        <div className={`${PANEL_CARD} p-4 space-y-3`}>
          <input
            className="input w-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('kdsStationNamePlaceholder')}
            autoFocus
          />
          <div>
            <p className="mb-2 text-xs font-medium text-[var(--text-muted)]">{t('kdsOrderTypesLabel')}</p>
            <div className="flex flex-wrap gap-2">
              {CHANNELS.map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => toggleChannel(ch)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    orderTypes.includes(ch) ? 'bg-teal-600 text-white' : CHIP_IDLE
                  }`}
                >
                  {ch}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-[var(--text-muted)]">{t('kdsChannelFilterHint')}</p>
          </div>
          {categories.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-medium text-[var(--text-muted)]">{t('kdsCategoriesLabel')}</p>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleCategory(cat.id)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      categoryIds.includes(cat.id) ? 'bg-violet-600 text-white' : CHIP_IDLE
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-[var(--text-muted)]">{t('kdsCategoryFilterHint')}</p>
            </div>
          ) : null}
          <ThemePicker value={theme} onChange={setTheme} />
          <KdsLayoutModePicker value={layoutMode} onChange={setLayoutMode} />
          {layoutMode === 'grid' ? (
            <KdsGridColumnsPicker value={gridColumns} onChange={setGridColumns} />
          ) : null}
          <div>
            <p className="mb-2 text-xs font-medium text-[var(--text-muted)]">{t('kdsOverdueMinutesLabel')}</p>
            <input
              type="number"
              min={5}
              max={120}
              className="input w-24"
              value={overdueMinutes}
              onChange={(e) => setOverdueMinutes(Math.min(120, Math.max(5, Number(e.target.value) || 20)))}
            />
            <p className="mt-1 text-xs text-[var(--text-muted)]">{t('kdsOverdueMinutesHint')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !name.trim()}
              onClick={() => void createStation()}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Plus className="h-4 w-4" aria-hidden />
              {t('create')}
            </button>
            <button type="button" className="btn-secondary" disabled={busy} onClick={closeCreateForm}>
              {t('cancel')}
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">{t('loading')}</p>
      ) : !stations.length ? (
        <p className="text-sm text-[var(--text-muted)]">{t('kdsNoStations')}</p>
      ) : (
        <ul className="space-y-3">
          {stations.map((s) => {
            const url = kdsPublicUrl(s);
            const code = s.shortCode || s.token.slice(0, 8);
            const saving = savingStationId === s.id;
            return (
              <li key={s.id} className={`${PANEL_CARD} p-4`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{s.name}</p>
                    <p className="mt-1 text-2xl font-mono font-bold tracking-wider text-teal-700 dark:text-teal-400">
                      {code}
                    </p>
                    <p className="mt-1 break-all font-mono text-xs text-[var(--text-muted)]">{url}</p>
                    <div className="mt-3 space-y-2">
                      <div>
                        <p className="text-xs font-medium text-[var(--text-muted)]">{t('kdsOrderTypesLabel')}</p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {CHANNELS.map((ch) => (
                            <button
                              key={ch}
                              type="button"
                              disabled={saving}
                              onClick={() => toggleStationChannel(s, ch)}
                              className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                                s.orderTypes.includes(ch) ? 'bg-teal-600 text-white' : CHIP_IDLE
                              }`}
                            >
                              {ch}
                            </button>
                          ))}
                        </div>
                      </div>
                      {categories.length > 0 ? (
                        <div>
                          <p className="text-xs font-medium text-[var(--text-muted)]">{t('kdsCategoriesLabel')}</p>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {categories.map((cat) => (
                              <button
                                key={cat.id}
                                type="button"
                                disabled={saving}
                                onClick={() => toggleStationCategory(s, cat.id)}
                                className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                                  s.categoryIds.includes(cat.id) ? 'bg-violet-600 text-white' : CHIP_IDLE
                                }`}
                              >
                                {cat.name}
                              </button>
                            ))}
                          </div>
                          {!s.categoryIds.length ? (
                            <p className="mt-1 text-xs text-[var(--text-muted)]">{t('kdsCategoryFilterHint')}</p>
                          ) : (
                            <p className="mt-1 text-xs text-[var(--text-muted)]">
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
                      <KdsLayoutModePicker
                        value={
                          (['grid', 'rows', 'slider'].includes(String(s.layoutMode || 'grid').toLowerCase())
                            ? String(s.layoutMode).toLowerCase()
                            : 'grid') as KdsLayoutMode
                        }
                        disabled={saving}
                        onChange={(next) => void updateStationFilters(s.id, { layoutMode: next })}
                      />
                      {String(s.layoutMode || 'grid').toLowerCase() === 'grid' ? (
                        <KdsGridColumnsPicker
                          value={Math.min(6, Math.max(1, Number(s.gridColumns) || 3))}
                          disabled={saving}
                          onChange={(next) => void updateStationFilters(s.id, { gridColumns: next })}
                        />
                      ) : null}
                      <div>
                        <p className="text-xs font-medium text-[var(--text-muted)]">{t('kdsOverdueMinutesLabel')}</p>
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
                        <p className="mt-1 text-xs text-[var(--text-muted)]">{t('kdsOverdueMinutesHint')}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={ICON_BTN}
                      title={t('kdsCopyUrl')}
                      onClick={() => void copyUrl(s)}
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className={ICON_BTN}
                      title={t('kdsRotateToken')}
                      onClick={() => void rotateToken(s.id)}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-red-200 p-2 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
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
