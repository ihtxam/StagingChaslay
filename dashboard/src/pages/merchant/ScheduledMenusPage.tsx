import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Clock, Plus, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useLocationStore } from '@/store/location';
import SearchableMultiSelect from '@/components/SearchableMultiSelect';
import {
  CATALOG_VISIBILITY_UI_CHANNELS,
  normalizeMenuCatalogChannels,
} from '@/lib/catalog-visibility';

type MenuScheduleType = 'daily' | 'weekly' | 'monthly';

type TimeRange = { start: string; end: string };

type ScheduledMenu = {
  id: string;
  name: string;
  channels: string[];
  scheduleType: MenuScheduleType;
  daysOfWeek: number[];
  daysOfMonth: number[];
  timeRanges: TimeRange[];
  timeStart: string;
  timeEnd: string;
  locationIds: string[];
  hqVersionId?: string | null;
  productIds: string[];
  categoryIds: string[];
  productPrices: Record<string, number>;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
};

type CatalogProduct = { id: string; name: string; price?: string | number; categoryId?: string | null };
type CatalogCategory = { id: string; name: string };
type HqVersion = { id: string; name: string; version: number };

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const emptyForm = (): Omit<ScheduledMenu, 'id'> => ({
  name: '',
  channels: ['shop', 'qr_table', 'pos', 'kiosk'],
  scheduleType: 'weekly',
  daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  daysOfMonth: [],
  timeRanges: [{ start: '11:00', end: '23:00' }],
  timeStart: '11:00',
  timeEnd: '23:00',
  locationIds: [],
  hqVersionId: null,
  productIds: [],
  categoryIds: [],
  productPrices: {},
  isDefault: false,
  isActive: true,
  sortOrder: 0,
});

function normalizeMenu(row: Record<string, unknown>): ScheduledMenu {
  const timeRangesRaw = row.timeRanges ?? row.time_ranges;
  const ranges = Array.isArray(timeRangesRaw)
    ? (timeRangesRaw as TimeRange[])
    : [{ start: String(row.timeStart || row.time_start || '00:00'), end: String(row.timeEnd || row.time_end || '23:59') }];
  return {
    id: String(row.id),
    name: String(row.name || ''),
    channels: normalizeMenuCatalogChannels(row.channels),
    scheduleType: (String(row.scheduleType || row.schedule_type || 'weekly') as MenuScheduleType) || 'weekly',
    daysOfWeek: Array.isArray(row.daysOfWeek)
      ? (row.daysOfWeek as number[])
      : Array.isArray(row.days_of_week)
        ? (row.days_of_week as number[])
        : [0, 1, 2, 3, 4, 5, 6],
    daysOfMonth: Array.isArray(row.daysOfMonth)
      ? (row.daysOfMonth as number[])
      : Array.isArray(row.days_of_month)
        ? (row.days_of_month as number[])
        : [],
    timeRanges: ranges,
    timeStart: String(row.timeStart || row.time_start || ranges[0]?.start || '00:00'),
    timeEnd: String(row.timeEnd || row.time_end || ranges[0]?.end || '23:59'),
    locationIds: Array.isArray(row.locationIds)
      ? (row.locationIds as string[])
      : Array.isArray(row.location_ids)
        ? (row.location_ids as string[])
        : [],
    hqVersionId: (row.hqVersionId || row.hq_version_id || null) as string | null,
    productIds: Array.isArray(row.productIds)
      ? (row.productIds as string[])
      : Array.isArray(row.product_ids)
        ? (row.product_ids as string[])
        : [],
    categoryIds: Array.isArray(row.categoryIds)
      ? (row.categoryIds as string[])
      : Array.isArray(row.category_ids)
        ? (row.category_ids as string[])
        : [],
    productPrices:
      row.productPrices && typeof row.productPrices === 'object'
        ? (row.productPrices as Record<string, number>)
        : row.product_prices && typeof row.product_prices === 'object'
          ? (row.product_prices as Record<string, number>)
          : {},
    isDefault: row.isDefault === true || row.is_default === true,
    isActive: row.isActive !== false && row.is_active !== false,
    sortOrder: Number(row.sortOrder ?? row.sort_order ?? 0) || 0,
  };
}

export default function ScheduledMenusPage() {
  const { t } = useI18n();
  const { locations } = useLocationStore();
  const [menus, setMenus] = useState<ScheduledMenu[]>([]);
  const [versions, setVersions] = useState<HqVersion[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uniformOpen, setUniformOpen] = useState(false);
  const [uniformMode, setUniformMode] = useState<'fixed' | 'percent'>('fixed');
  const [uniformValue, setUniformValue] = useState('');
  const [uniformDirection, setUniformDirection] = useState<'increase' | 'decrease'>('increase');

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const menuProductRows = useMemo(() => {
    const ids = new Set<string>([...form.productIds]);
    if (form.categoryIds.length) {
      for (const p of products) {
        const cat = p.categoryId;
        if (cat && form.categoryIds.includes(cat)) ids.add(p.id);
      }
    }
    return [...ids].map((id) => {
      const p = productById.get(id);
      const base = Number(p?.price ?? 0);
      const menuPrice = form.productPrices[id] ?? base;
      return { id, name: p?.name || id, base, menuPrice };
    });
  }, [form.productIds, form.categoryIds, form.productPrices, productById, products]);

  const categoryOptions = useMemo(
    () =>
      categories
        .map((c) => ({ id: c.id, label: c.name || c.id }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [categories]
  );

  const productOptions = useMemo(
    () =>
      products
        .map((p) => ({ id: p.id, label: p.name || p.id }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [products]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [menusRes, versionsRes, categoriesRes, productsRes] = await Promise.all([
        api.get('/merchant/menus'),
        api.get('/merchant/hq/catalog/versions').catch(() => ({ data: { versions: [] } })),
        api.get('/merchant/categories').catch(() => ({ data: { categories: [] } })),
        api.get('/merchant/products', { params: { limit: 5000, page: 1 } }).catch(() => ({
          data: { products: [] },
        })),
      ]);
      setMenus((menusRes.data?.menus || []).map((m: Record<string, unknown>) => normalizeMenu(m)));
      setVersions(versionsRes.data?.versions || []);
      setCategories(categoriesRes.data?.categories || []);
      setProducts(productsRes.data?.products || []);
    } catch {
      toast.error(t('scheduledMenusLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const reset = () => {
    setForm(emptyForm());
    setEditingId(null);
  };

  const startEdit = (menu: ScheduledMenu) => {
    setEditingId(menu.id);
    setForm({
      name: menu.name,
      channels: normalizeMenuCatalogChannels(menu.channels || ['shop']),
      scheduleType: menu.scheduleType || 'weekly',
      daysOfWeek: menu.daysOfWeek || [0, 1, 2, 3, 4, 5, 6],
      daysOfMonth: menu.daysOfMonth || [],
      timeRanges: menu.timeRanges?.length ? menu.timeRanges : [{ start: menu.timeStart, end: menu.timeEnd }],
      timeStart: menu.timeStart || '00:00',
      timeEnd: menu.timeEnd || '23:59',
      locationIds: menu.locationIds || [],
      hqVersionId: menu.hqVersionId || null,
      productIds: menu.productIds || [],
      categoryIds: menu.categoryIds || [],
      productPrices: menu.productPrices || {},
      isDefault: menu.isDefault,
      isActive: menu.isActive !== false,
      sortOrder: menu.sortOrder || 0,
    });
  };

  const buildPayload = () => ({
    name: form.name.trim(),
    channels: normalizeMenuCatalogChannels(form.channels),
    scheduleType: form.scheduleType,
    daysOfWeek: form.daysOfWeek,
    daysOfMonth: form.daysOfMonth,
    timeRanges: form.timeRanges,
    timeStart: form.timeRanges[0]?.start || form.timeStart,
    timeEnd: form.timeRanges[0]?.end || form.timeEnd,
    locationIds: form.locationIds,
    hqVersionId: form.hqVersionId,
    productIds: form.productIds,
    categoryIds: form.categoryIds,
    product_prices: form.productPrices,
    isActive: form.isActive,
    sortOrder: form.sortOrder,
  });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error(t('scheduledMenuNameRequired'));
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload();
      if (editingId) {
        await api.put(`/merchant/menus/${editingId}`, payload);
        toast.success(t('saved'));
      } else {
        await api.post('/merchant/menus', payload);
        toast.success(t('scheduledMenuCreated'));
      }
      reset();
      await load();
    } catch (err: unknown) {
      toast.error(
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error || t('saveFailed')
      );
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: string, isDefault: boolean) => {
    if (isDefault) {
      toast.error(t('scheduledMenuDefaultNoDelete'));
      return;
    }
    if (!window.confirm(t('scheduledMenuDeleteConfirm'))) return;
    try {
      await api.delete(`/merchant/menus/${id}`);
      toast.success(t('deleted'));
      await load();
    } catch (err: unknown) {
      toast.error(
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error || t('deleteFailed')
      );
    }
  };

  const toggleDay = (d: number) => {
    setForm((f) => ({
      ...f,
      daysOfWeek: f.daysOfWeek.includes(d) ? f.daysOfWeek.filter((x) => x !== d) : [...f.daysOfWeek, d],
    }));
  };

  const toggleDom = (d: number) => {
    setForm((f) => ({
      ...f,
      daysOfMonth: f.daysOfMonth.includes(d) ? f.daysOfMonth.filter((x) => x !== d) : [...f.daysOfMonth, d],
    }));
  };

  const toggleLocation = (id: string) => {
    setForm((f) => ({
      ...f,
      locationIds: f.locationIds.includes(id)
        ? f.locationIds.filter((x) => x !== id)
        : [...f.locationIds, id],
    }));
  };

  const toggleChannel = (ch: string) => {
    setForm((f) => ({
      ...f,
      channels: f.channels.includes(ch) ? f.channels.filter((x) => x !== ch) : [...f.channels, ch],
    }));
  };

  const addTimeRange = () => {
    setForm((f) => ({
      ...f,
      timeRanges: [...f.timeRanges, { start: '11:00', end: '14:00' }],
    }));
  };

  const updateTimeRange = (idx: number, patch: Partial<TimeRange>) => {
    setForm((f) => ({
      ...f,
      timeRanges: f.timeRanges.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    }));
  };

  const removeTimeRange = (idx: number) => {
    setForm((f) => ({
      ...f,
      timeRanges: f.timeRanges.length > 1 ? f.timeRanges.filter((_, i) => i !== idx) : f.timeRanges,
    }));
  };

  const applyUniform = async () => {
    const value = Number(uniformValue);
    if (!Number.isFinite(value) || value === 0) {
      toast.error(t('scheduledMenuUniformInvalid'));
      return;
    }
    const basePrices: Record<string, number> = {};
    for (const row of menuProductRows) {
      basePrices[row.id] = row.menuPrice;
    }
    try {
      const res = await api.post('/merchant/menus/uniform-pricing', {
        basePrices,
        mode: uniformMode,
        value: uniformMode === 'fixed' && uniformDirection === 'decrease' ? -Math.abs(value) : value,
        direction: uniformDirection,
      });
      const prices = res.data?.prices || {};
      setForm((f) => ({ ...f, productPrices: { ...f.productPrices, ...prices } }));
      setUniformOpen(false);
      toast.success(t('scheduledMenuUniformApplied'));
    } catch {
      toast.error(t('scheduledMenuUniformFailed'));
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Clock className="w-5 h-5" />
          {t('scheduledMenusTitle')}
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">{t('scheduledMenusDescription')}</p>
      </div>

      <form onSubmit={(e) => void onSubmit(e)} className="rounded-lg border border-[var(--border)] p-4 space-y-3">
        <h2 className="font-medium">
          {editingId ? t('scheduledMenuEdit') : t('scheduledMenuAdd')}
          {form.isDefault ? (
            <span className="ml-2 text-xs font-normal text-[var(--text-muted)]">({t('scheduledMenuDefaultBadge')})</span>
          ) : null}
        </h2>
        <label className="block text-sm">
          {t('scheduledMenuName')}
          <input
            className="input mt-1 w-full"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={t('scheduledMenuNamePlaceholder')}
          />
        </label>

        <label className="block text-sm">
          {t('scheduledMenuEffective')}
          <select
            className="input mt-1 w-full"
            value={form.scheduleType}
            disabled={form.isDefault}
            onChange={(e) =>
              setForm({ ...form, scheduleType: e.target.value as MenuScheduleType })
            }
          >
            <option value="daily">{t('scheduledMenuDaily')}</option>
            <option value="weekly">{t('scheduledMenuWeekly')}</option>
            <option value="monthly">{t('scheduledMenuMonthly')}</option>
          </select>
        </label>

        {form.scheduleType === 'weekly' && !form.isDefault ? (
          <fieldset>
            <legend className="text-sm font-medium">{t('scheduledMenuDays')}</legend>
            <div className="flex flex-wrap gap-2 mt-1">
              {DAY_LABELS.map((label, idx) => (
                <button
                  key={label}
                  type="button"
                  className={`rounded px-2 py-1 text-xs border ${
                    form.daysOfWeek.includes(idx) ? 'bg-stone-900 text-white' : 'border-[var(--border)]'
                  }`}
                  onClick={() => toggleDay(idx)}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
        ) : null}

        {form.scheduleType === 'monthly' && !form.isDefault ? (
          <fieldset>
            <legend className="text-sm font-medium">{t('scheduledMenuDaysOfMonth')}</legend>
            <div className="grid grid-cols-7 gap-1 mt-1 max-w-md">
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`rounded px-1 py-0.5 text-xs border ${
                    form.daysOfMonth.includes(d) ? 'bg-stone-900 text-white' : 'border-[var(--border)]'
                  }`}
                  onClick={() => toggleDom(d)}
                >
                  {d}
                </button>
              ))}
            </div>
          </fieldset>
        ) : null}

        {!form.isDefault ? (
          <fieldset>
            <legend className="text-sm font-medium">{t('scheduledMenuTimeRanges')}</legend>
            <div className="space-y-2 mt-1">
              {form.timeRanges.map((range, idx) => (
                <div key={idx} className="flex flex-wrap items-center gap-2">
                  <input
                    type="time"
                    className="input"
                    value={range.start}
                    onChange={(e) => updateTimeRange(idx, { start: e.target.value })}
                  />
                  <span className="text-sm">–</span>
                  <input
                    type="time"
                    className="input"
                    value={range.end}
                    onChange={(e) => updateTimeRange(idx, { end: e.target.value })}
                  />
                  <button type="button" className="btn-secondary text-xs" onClick={() => removeTimeRange(idx)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <button type="button" className="btn-secondary text-xs inline-flex items-center gap-1" onClick={addTimeRange}>
                <Plus className="w-3.5 h-3.5" />
                {t('scheduledMenuAddTimeRange')}
              </button>
            </div>
          </fieldset>
        ) : (
          <p className="text-xs text-[var(--text-muted)]">{t('scheduledMenuDefaultHoursHint')}</p>
        )}

        <fieldset>
          <legend className="text-sm font-medium">{t('scheduledMenuChannels')}</legend>
          <div className="flex flex-wrap gap-3 mt-1 text-sm">
            {CATALOG_VISIBILITY_UI_CHANNELS.map((ch) => (
              <label key={ch} className="inline-flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={form.channels.includes(ch)}
                  onChange={() => toggleChannel(ch)}
                />
                {t(`catalogChannel_${ch}`)}
              </label>
            ))}
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1">{t('catalogVisibilityShopFulfillmentHint')}</p>
        </fieldset>

        {locations.length > 1 ? (
          <fieldset>
            <legend className="text-sm font-medium">{t('scheduledMenuLocations')}</legend>
            <p className="text-xs text-[var(--text-muted)]">{t('scheduledMenuLocationsHint')}</p>
            <div className="flex flex-wrap gap-2 mt-1">
              {locations.map((loc) => (
                <label key={loc.id} className="inline-flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={form.locationIds.includes(loc.id)}
                    onChange={() => toggleLocation(loc.id)}
                  />
                  {loc.name}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        <SearchableMultiSelect
          label={t('scheduledMenuCategories')}
          helperText={t('scheduledMenuCategoriesHint')}
          placeholder={t('scheduledMenuSearchCategories')}
          options={categoryOptions}
          value={form.categoryIds}
          onChange={(categoryIds) => setForm((f) => ({ ...f, categoryIds }))}
        />
        <SearchableMultiSelect
          label={t('scheduledMenuProducts')}
          helperText={t('scheduledMenuProductsHint')}
          placeholder={t('scheduledMenuSearchProducts')}
          options={productOptions}
          value={form.productIds}
          onChange={(productIds) => setForm((f) => ({ ...f, productIds }))}
        />

        {menuProductRows.length > 0 ? (
          <div className="rounded-md border border-[var(--border)] p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">{t('scheduledMenuPricing')}</h3>
              <button type="button" className="btn-secondary text-xs" onClick={() => setUniformOpen(true)}>
                {t('scheduledMenuUniformPricing')}
              </button>
            </div>
            <div className="max-h-48 overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[var(--text-muted)]">
                    <th className="py-1">{t('products')}</th>
                    <th className="py-1">{t('scheduledMenuBasePrice')}</th>
                    <th className="py-1">{t('scheduledMenuMenuPrice')}</th>
                  </tr>
                </thead>
                <tbody>
                  {menuProductRows.map((row) => (
                    <tr key={row.id}>
                      <td className="py-1 pr-2">{row.name}</td>
                      <td className="py-1 pr-2">{row.base.toFixed(2)}</td>
                      <td className="py-1">
                        <input
                          className="input w-24"
                          type="number"
                          step="0.05"
                          value={form.productPrices[row.id] ?? row.menuPrice}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setForm((f) => ({
                              ...f,
                              productPrices: {
                                ...f.productPrices,
                                [row.id]: Number.isFinite(v) ? v : row.base,
                              },
                            }));
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {!form.isDefault ? (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            {t('scheduledMenuActive')}
          </label>
        ) : null}

        <div className="flex gap-2">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? t('saving') : editingId ? t('save') : t('scheduledMenuAdd')}
          </button>
          {editingId ? (
            <button type="button" className="btn-secondary" onClick={reset}>
              {t('cancel')}
            </button>
          ) : null}
        </div>
      </form>

      {uniformOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-[var(--bg)] rounded-lg border border-[var(--border)] p-4 w-full max-w-sm space-y-3">
            <h3 className="font-medium">{t('scheduledMenuUniformPricing')}</h3>
            <select
              className="input w-full"
              value={uniformMode}
              onChange={(e) => setUniformMode(e.target.value as 'fixed' | 'percent')}
            >
              <option value="fixed">{t('scheduledMenuUniformFixed')}</option>
              <option value="percent">{t('scheduledMenuUniformPercent')}</option>
            </select>
            <select
              className="input w-full"
              value={uniformDirection}
              onChange={(e) => setUniformDirection(e.target.value as 'increase' | 'decrease')}
            >
              <option value="increase">{t('scheduledMenuUniformIncrease')}</option>
              <option value="decrease">{t('scheduledMenuUniformDecrease')}</option>
            </select>
            <input
              className="input w-full"
              type="number"
              step="0.05"
              placeholder={uniformMode === 'fixed' ? 'CHF' : '%'}
              value={uniformValue}
              onChange={(e) => setUniformValue(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <button type="button" className="btn-secondary" onClick={() => setUniformOpen(false)}>
                {t('cancel')}
              </button>
              <button type="button" className="btn-primary" onClick={() => void applyUniform()}>
                {t('confirm')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border border-[var(--border)] p-4 space-y-2">
        <h2 className="font-medium">{t('scheduledMenusList')}</h2>
        {loading ? (
          <p className="text-sm text-[var(--text-muted)]">{t('loading')}</p>
        ) : menus.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">{t('scheduledMenusEmpty')}</p>
        ) : (
          menus.map((m) => (
            <div
              key={m.id}
              className="flex items-start justify-between gap-3 rounded border border-[var(--border)] px-3 py-2"
            >
              <div>
                <p className="font-medium">
                  {m.name}
                  {m.isDefault ? (
                    <span className="ml-2 text-xs text-[var(--text-muted)]">({t('scheduledMenuDefaultBadge')})</span>
                  ) : null}
                  {!m.isActive ? (
                    <span className="ml-2 text-xs text-[var(--text-muted)]">({t('inactive')})</span>
                  ) : null}
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  {m.scheduleType} · {(m.timeRanges || []).map((r) => `${r.start}–${r.end}`).join(', ')} ·{' '}
                  {(m.channels || []).join(', ')}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button type="button" className="btn-secondary text-xs" onClick={() => startEdit(m)}>
                  {t('edit')}
                </button>
                {!m.isDefault ? (
                  <button
                    type="button"
                    className="btn-secondary text-xs text-red-600"
                    onClick={() => void onDelete(m.id, m.isDefault)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
