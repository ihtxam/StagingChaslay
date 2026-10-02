import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Clock, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import {
  CATALOG_VISIBILITY_UI_CHANNELS,
  normalizeMenuCatalogChannels,
} from '@/lib/catalog-visibility';
import { useLocationStore } from '@/store/location';
import SearchableMultiSelect from '@/components/SearchableMultiSelect';

type HqMenu = {
  id: string;
  name: string;
  channels: string[];
  daysOfWeek: number[];
  timeStart: string;
  timeEnd: string;
  locationIds: string[];
  hqVersionId?: string | null;
  productIds: string[];
  categoryIds: string[];
  isActive: boolean;
  sortOrder: number;
};

type HqVersion = { id: string; name: string; version: number };

type CatalogCategory = { id: string; name: string };
type CatalogProduct = { id: string; name: string };

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const emptyForm = (): Omit<HqMenu, 'id'> => ({
  name: '',
  channels: ['shop', 'qr_table', 'pos', 'kiosk'],
  daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  timeStart: '06:00',
  timeEnd: '11:00',
  locationIds: [],
  hqVersionId: null,
  productIds: [],
  categoryIds: [],
  isActive: true,
  sortOrder: 0,
});

function normalizeMenu(row: Record<string, unknown>): HqMenu {
  return {
    id: String(row.id),
    name: String(row.name || ''),
    channels: normalizeMenuCatalogChannels(row.channels),
    daysOfWeek: Array.isArray(row.daysOfWeek)
      ? (row.daysOfWeek as number[])
      : Array.isArray(row.days_of_week)
        ? (row.days_of_week as number[])
        : [0, 1, 2, 3, 4, 5, 6],
    timeStart: String(row.timeStart || row.time_start || '00:00'),
    timeEnd: String(row.timeEnd || row.time_end || '23:59'),
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
    isActive: row.isActive !== false && row.is_active !== false,
    sortOrder: Number(row.sortOrder ?? row.sort_order ?? 0) || 0,
  };
}

export default function HqMenusPage() {
  const { t } = useI18n();
  const { locations } = useLocationStore();
  const [menus, setMenus] = useState<HqMenu[]>([]);
  const [versions, setVersions] = useState<HqVersion[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
        api.get('/merchant/hq/menus'),
        api.get('/merchant/hq/catalog/versions'),
        api.get('/merchant/categories').catch(() => ({ data: { categories: [] } })),
        api.get('/merchant/products', { params: { limit: 5000, page: 1 } }).catch(() => ({
          data: { products: [] },
        })),
      ]);
      const rawMenus = menusRes.data?.menus || [];
      setMenus(rawMenus.map((m: Record<string, unknown>) => normalizeMenu(m)));
      setVersions(versionsRes.data?.versions || []);
      setCategories(categoriesRes.data?.categories || []);
      setProducts(productsRes.data?.products || []);
    } catch {
      toast.error(t('hqMenusLoadFailed'));
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

  const startEdit = (menu: HqMenu) => {
    setEditingId(menu.id);
    setForm({
      name: menu.name,
      channels: normalizeMenuCatalogChannels(menu.channels || ['shop']),
      daysOfWeek: menu.daysOfWeek || [0, 1, 2, 3, 4, 5, 6],
      timeStart: menu.timeStart || '00:00',
      timeEnd: menu.timeEnd || '23:59',
      locationIds: menu.locationIds || [],
      hqVersionId: menu.hqVersionId || null,
      productIds: menu.productIds || [],
      categoryIds: menu.categoryIds || [],
      isActive: menu.isActive !== false,
      sortOrder: menu.sortOrder || 0,
    });
  };

  const buildPayload = () => ({
    name: form.name.trim(),
    channels: normalizeMenuCatalogChannels(form.channels),
    daysOfWeek: form.daysOfWeek,
    timeStart: form.timeStart,
    timeEnd: form.timeEnd,
    locationIds: form.locationIds,
    hqVersionId: form.hqVersionId,
    productIds: form.productIds,
    categoryIds: form.categoryIds,
    product_ids: form.productIds,
    category_ids: form.categoryIds,
    isActive: form.isActive,
    sortOrder: form.sortOrder,
  });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error(t('hqMenuNameRequired'));
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload();
      if (editingId) {
        await api.put(`/merchant/hq/menus/${editingId}`, payload);
        toast.success(t('saved'));
      } else {
        await api.post('/merchant/hq/menus', payload);
        toast.success(t('hqMenuCreated'));
      }
      reset();
      await load();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!window.confirm(t('hqMenuDeleteConfirm'))) return;
    try {
      await api.delete(`/merchant/hq/menus/${id}`);
      toast.success(t('deleted'));
      await load();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || t('deleteFailed'));
    }
  };

  const toggleDay = (d: number) => {
    setForm((f) => ({
      ...f,
      daysOfWeek: f.daysOfWeek.includes(d) ? f.daysOfWeek.filter((x) => x !== d) : [...f.daysOfWeek, d],
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

  return (
    <div className="p-4 sm:p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Clock className="w-5 h-5" />
          {t('hqMenusTitle')}
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">{t('hqMenusDescription')}</p>
      </div>

      <form onSubmit={(e) => void onSubmit(e)} className="rounded-lg border border-[var(--border)] p-4 space-y-3">
        <h2 className="font-medium">{editingId ? t('hqMenuEdit') : t('hqMenuAdd')}</h2>
        <label className="block text-sm">
          {t('hqMenuName')}
          <input
            className="input mt-1 w-full"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={t('hqMenuNamePlaceholder')}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            {t('hqMenuTimeStart')}
            <input
              type="time"
              className="input mt-1 w-full"
              value={form.timeStart}
              onChange={(e) => setForm({ ...form, timeStart: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            {t('hqMenuTimeEnd')}
            <input
              type="time"
              className="input mt-1 w-full"
              value={form.timeEnd}
              onChange={(e) => setForm({ ...form, timeEnd: e.target.value })}
            />
          </label>
        </div>
        <fieldset>
          <legend className="text-sm font-medium">{t('hqMenuDays')}</legend>
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
        <fieldset>
          <legend className="text-sm font-medium">{t('hqMenuChannels')}</legend>
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
            <legend className="text-sm font-medium">{t('hqMenuLocations')}</legend>
            <p className="text-xs text-[var(--text-muted)]">{t('hqMenuLocationsHint')}</p>
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
        <label className="block text-sm">
          {t('hqMenuSnapshot')}
          <select
            className="input mt-1 w-full"
            value={form.hqVersionId || ''}
            onChange={(e) => setForm({ ...form, hqVersionId: e.target.value || null })}
          >
            <option value="">{t('hqMenuAllProducts')}</option>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} (v{v.version})
              </option>
            ))}
          </select>
        </label>
        <SearchableMultiSelect
          label={t('hqMenuCategories')}
          helperText={t('hqMenuCategoriesHint')}
          placeholder={t('hqMenuSearchCategories')}
          options={categoryOptions}
          value={form.categoryIds}
          onChange={(categoryIds) => setForm((f) => ({ ...f, categoryIds }))}
        />
        <SearchableMultiSelect
          label={t('hqMenuProducts')}
          helperText={t('hqMenuProductsHint')}
          placeholder={t('hqMenuSearchProducts')}
          options={productOptions}
          value={form.productIds}
          onChange={(productIds) => setForm((f) => ({ ...f, productIds }))}
        />
        <p className="text-xs text-[var(--text-muted)]">{t('hqMenuSelectionSummary')}</p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          />
          {t('hqMenuActive')}
        </label>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? t('saving') : editingId ? t('save') : t('hqMenuAdd')}
          </button>
          {editingId ? (
            <button type="button" className="btn-secondary" onClick={reset}>
              {t('cancel')}
            </button>
          ) : null}
        </div>
      </form>

      <div className="rounded-lg border border-[var(--border)] p-4 space-y-2">
        <h2 className="font-medium">{t('hqMenusList')}</h2>
        {loading ? (
          <p className="text-sm text-[var(--text-muted)]">{t('loading')}</p>
        ) : menus.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">{t('hqMenusEmpty')}</p>
        ) : (
          menus.map((m) => (
            <div
              key={m.id}
              className="flex items-start justify-between gap-3 rounded border border-[var(--border)] px-3 py-2"
            >
              <div>
                <p className="font-medium">
                  {m.name}
                  {!m.isActive ? (
                    <span className="ml-2 text-xs text-[var(--text-muted)]">({t('inactive')})</span>
                  ) : null}
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  {m.timeStart}–{m.timeEnd} · {(m.channels || []).join(', ')}
                  {m.categoryIds.length || m.productIds.length ? (
                    <>
                      {' · '}
                      {m.categoryIds.length ? `${m.categoryIds.length} cat` : null}
                      {m.categoryIds.length && m.productIds.length ? ', ' : null}
                      {m.productIds.length ? `${m.productIds.length} prod` : null}
                    </>
                  ) : null}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button type="button" className="btn-secondary text-xs" onClick={() => startEdit(m)}>
                  {t('edit')}
                </button>
                <button type="button" className="btn-secondary text-xs text-red-600" onClick={() => void onDelete(m.id)}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
