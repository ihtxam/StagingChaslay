import { FormEvent, useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { MapPin, Plus, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useLocationStore, type MerchantLocation } from '@/store/location';
import { SettingsField, SettingsReportCard } from '@/components/settings/SettingsReportUi';

type LocationForm = {
  name: string;
  businessCategory: 'retail' | 'restaurant';
  address: string;
  city: string;
  country: string;
  isDefault: boolean;
};

const emptyForm = (): LocationForm => ({
  name: '',
  businessCategory: 'restaurant',
  address: '',
  city: '',
  country: '',
  isDefault: false,
});

export default function SettingsLocationsTab() {
  const { t } = useI18n();
  const { refresh } = useLocationStore();
  const [locations, setLocations] = useState<MerchantLocation[]>([]);
  const [limits, setLimits] = useState<{ maxLocations: number; currentCount: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<LocationForm>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/merchant/locations');
      setLocations(res.data?.locations || []);
      setLimits(res.data?.limits || null);
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to load locations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const startEdit = (loc: MerchantLocation) => {
    setEditingId(loc.id);
    setForm({
      name: loc.name,
      businessCategory: (loc.businessCategory as 'retail' | 'restaurant') || 'restaurant',
      address: loc.address || '',
      city: loc.city || '',
      country: loc.country || '',
      isDefault: !!loc.isDefault,
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm());
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error(t('locationNameRequired'));
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/merchant/locations/${editingId}`, form);
        toast.success(t('saved'));
      } else {
        await api.post('/merchant/locations', form);
        toast.success(t('locationCreated'));
      }
      resetForm();
      await load();
      await refresh();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!window.confirm(t('locationDeleteConfirm'))) return;
    try {
      await api.delete(`/merchant/locations/${id}`);
      toast.success(t('locationDeleted'));
      await load();
      await refresh();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Delete failed');
    }
  };

  return (
    <div className="space-y-6">
      <SettingsReportCard
        title={t('locationsTitle')}
        description={t('locationsDescription')}
        icon={MapPin}
      >
        {limits ? (
          <p className="text-sm text-[var(--text-muted)] mb-4">
            {t('locationsUsage', { current: limits.currentCount, max: limits.maxLocations })}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-[var(--text-muted)]">{t('loading')}</p>
        ) : (
          <div className="space-y-3 mb-6">
            {locations.map((loc) => (
              <div
                key={loc.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    {loc.name}
                    {loc.isDefault ? (
                      <span className="ml-2 text-xs text-[var(--text-muted)]">({t('default')})</span>
                    ) : null}
                  </div>
                  <div className="text-xs text-[var(--text-muted)] capitalize">
                    {loc.businessCategory}
                    {loc.city ? ` · ${loc.city}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button type="button" className="btn-secondary text-xs" onClick={() => startEdit(loc)}>
                    {t('edit')}
                  </button>
                  {!loc.isDefault ? (
                    <button
                      type="button"
                      className="btn-secondary text-xs text-red-600"
                      onClick={() => void onDelete(loc.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4 border-t border-[var(--border)] pt-4">
          <h3 className="font-medium flex items-center gap-2">
            <Plus className="w-4 h-4" />
            {editingId ? t('editLocation') : t('addLocation')}
          </h3>
          <SettingsField label={t('locationName')}>
            <input
              className="input w-full"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </SettingsField>
          <SettingsField label={t('businessType')}>
            <select
              className="input w-full"
              value={form.businessCategory}
              onChange={(e) =>
                setForm({ ...form, businessCategory: e.target.value as 'retail' | 'restaurant' })
              }
            >
              <option value="restaurant">{t('restaurant')}</option>
              <option value="retail">{t('retail')}</option>
            </select>
          </SettingsField>
          <SettingsField label={t('address')}>
            <input
              className="input w-full"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </SettingsField>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SettingsField label={t('city')}>
              <input
                className="input w-full"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </SettingsField>
            <SettingsField label={t('country')}>
              <input
                className="input w-full"
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
              />
            </SettingsField>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
            />
            {t('locationSetDefault')}
          </label>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? t('saving') : editingId ? t('save') : t('addLocation')}
            </button>
            {editingId ? (
              <button type="button" className="btn-secondary" onClick={resetForm}>
                {t('cancel')}
              </button>
            ) : null}
          </div>
        </form>
      </SettingsReportCard>
    </div>
  );
}
