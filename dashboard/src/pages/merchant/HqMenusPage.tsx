import { FormEvent, useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Clock, Plus, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useLocationStore } from '@/store/location';

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
  isActive: boolean;
  sortOrder: number;
};

type HqVersion = { id: string; name: string; version: number };

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const emptyForm = (): Omit<HqMenu, 'id'> => ({
  name: '',
  channels: ['shop', 'qr_table', 'pos', 'delivery', 'kiosk'],
  daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  timeStart: '06:00',
  timeEnd: '11:00',
  locationIds: [],
  hqVersionId: null,
  productIds: [],
  isActive: true,
  sortOrder: 0,
});

export default function HqMenusPage() {
  const { t } = useI18n();
  const { locations } = useLocationStore();
  const [menus, setMenus] = useState<HqMenu[]>([]);
  const [versions, setVersions] = useState<HqVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [menusRes, versionsRes] = await Promise.all([
        api.get('/merchant/hq/menus'),
        api.get('/merchant/hq/catalog/versions'),
      ]);
      setMenus(menusRes.data?.menus || []);
      setVersions(versionsRes.data?.versions || []);
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
      channels: menu.channels || ['shop'],
      daysOfWeek: menu.daysOfWeek || [0, 1, 2, 3, 4, 5, 6],
      timeStart: menu.timeStart || '00:00',
      timeEnd: menu.timeEnd || '23:59',
      locationIds: menu.locationIds || [],
      hqVersionId: menu.hqVersionId || null,
      productIds: menu.productIds || [],
      isActive: menu.isActive !== false,
      sortOrder: menu.sortOrder || 0,
    });
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error(t('hqMenuNameRequired'));
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/merchant/hq/menus/${editingId}`, form);
        toast.success(t('saved'));
      } else {
        await api.post('/merchant/hq/menus', form);
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
            {(['pos', 'shop', 'qr_table', 'delivery'] as const).map((ch) => (
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
