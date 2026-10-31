import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Building2, MapPin, X } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { MerchantLocation } from '@/store/location';
import { SettingsField } from '@/components/settings/SettingsReportUi';

export type LocationFormValues = {
  name: string;
  businessCategory: 'retail' | 'restaurant';
  address: string;
  city: string;
  country: string;
  isDefault: boolean;
};

const emptyForm = (): LocationFormValues => ({
  name: '',
  businessCategory: 'restaurant',
  address: '',
  city: '',
  country: '',
  isDefault: false,
});

type Props = {
  open: boolean;
  mode: 'create' | 'edit';
  initial?: MerchantLocation | null;
  onClose: () => void;
  onSaved: (location: MerchantLocation) => void;
};

function formFromLocation(loc: MerchantLocation): LocationFormValues {
  return {
    name: loc.name,
    businessCategory: (loc.businessCategory as 'retail' | 'restaurant') || 'restaurant',
    address: loc.address || '',
    city: loc.city || '',
    country: loc.country || '',
    isDefault: !!loc.isDefault,
  };
}

export default function LocationFormModal({ open, mode, initial, onClose, onSaved }: Props) {
  const { t } = useI18n();
  const [form, setForm] = useState<LocationFormValues>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(initial ? formFromLocation(initial) : emptyForm());
  }, [open, initial]);

  if (!open) return null;

  const title = mode === 'edit' ? t('editLocation') : t('addLocation');

  const submit = async () => {
    if (!form.name.trim()) {
      toast.error(t('locationNameRequired'));
      return;
    }
    setSaving(true);
    try {
      if (mode === 'edit' && initial?.id) {
        const res = await api.put(`/merchant/locations/${initial.id}`, form);
        toast.success(t('saved'));
        onSaved(res.data?.location || { ...initial, ...form });
      } else {
        const res = await api.post('/merchant/locations', form);
        toast.success(t('locationCreated'));
        onSaved(res.data?.location);
      }
      onClose();
    } catch (err: unknown) {
      toast.error(
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Save failed'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50">
      <div
        className="w-full max-w-lg max-h-[min(90vh,720px)] flex flex-col rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] shadow-xl"
        role="dialog"
        aria-labelledby="location-form-title"
      >
        <div className="px-4 py-3 border-b border-[var(--border)] flex items-start justify-between gap-2 shrink-0">
          <h2 id="location-form-title" className="text-lg font-semibold">
            {title}
          </h2>
          <button type="button" className="btn-secondary p-2 shrink-0" onClick={onClose} aria-label={t('cancel')}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <section className="space-y-3">
            <SettingsField label={t('locationName')}>
              <input
                className="input w-full"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                autoFocus
                required
              />
            </SettingsField>
          </section>

          <section className="space-y-3">
            <p className="text-sm font-medium">{t('locationWizardStepBusiness')}</p>
            <p className="text-sm text-[var(--text-muted)] -mt-1">{t('locationWizardBusinessHint')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(['restaurant', 'retail'] as const).map((cat) => {
                const active = form.businessCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setForm({ ...form, businessCategory: cat })}
                    className={`rounded-lg border px-3 py-3 text-left flex items-start gap-2 transition-colors ${
                      active
                        ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/10'
                        : 'border-[var(--border)] hover:bg-[var(--bg-muted)]'
                    }`}
                  >
                    {cat === 'retail' ? (
                      <Building2 className="w-5 h-5 shrink-0" />
                    ) : (
                      <MapPin className="w-5 h-5 shrink-0" />
                    )}
                    <div className="font-medium">{cat === 'retail' ? t('retail') : t('restaurant')}</div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-4">
            <p className="text-sm font-medium">{t('locationWizardStepAddress')}</p>
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
          </section>

          <section className="space-y-3">
            <p className="text-sm font-medium">{t('locationWizardStepDefault')}</p>
            <p className="text-sm text-[var(--text-muted)] -mt-1">{t('locationWizardDefaultHint')}</p>
            <label className="flex items-center gap-2 text-sm rounded-lg border border-[var(--border)] px-3 py-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
              />
              {t('locationSetDefault')}
            </label>
          </section>
        </div>

        <div className="px-4 py-3 border-t border-[var(--border)] flex justify-end gap-2 shrink-0">
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t('cancel')}
          </button>
          <button type="button" className="btn-primary" disabled={saving} onClick={() => void submit()}>
            {saving ? t('saving') : mode === 'edit' ? t('save') : t('addLocation')}
          </button>
        </div>
      </div>
    </div>
  );
}
