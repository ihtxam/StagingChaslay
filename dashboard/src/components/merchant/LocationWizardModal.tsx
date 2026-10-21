import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Building2, ChevronLeft, ChevronRight, MapPin, X } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { MerchantLocation } from '@/store/location';
import { SettingsField } from '@/components/settings/SettingsReportUi';

export type LocationWizardForm = {
  name: string;
  businessCategory: 'retail' | 'restaurant';
  address: string;
  city: string;
  country: string;
  isDefault: boolean;
};

const emptyForm = (): LocationWizardForm => ({
  name: '',
  businessCategory: 'restaurant',
  address: '',
  city: '',
  country: '',
  isDefault: false,
});

const STEPS = ['name', 'business', 'address', 'default'] as const;
type StepId = (typeof STEPS)[number];

type Props = {
  open: boolean;
  mode: 'create' | 'edit';
  initial?: MerchantLocation | null;
  onClose: () => void;
  onSaved: (location: MerchantLocation) => void;
};

function formFromLocation(loc: MerchantLocation): LocationWizardForm {
  return {
    name: loc.name,
    businessCategory: (loc.businessCategory as 'retail' | 'restaurant') || 'restaurant',
    address: loc.address || '',
    city: loc.city || '',
    country: loc.country || '',
    isDefault: !!loc.isDefault,
  };
}

export default function LocationWizardModal({ open, mode, initial, onClose, onSaved }: Props) {
  const { t } = useI18n();
  const [step, setStep] = useState<StepId>('name');
  const [form, setForm] = useState<LocationWizardForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep('name');
    setForm(initial ? formFromLocation(initial) : emptyForm());
  }, [open, initial]);

  const stepIndex = STEPS.indexOf(step);
  const stepLabels = useMemo(
    () => [
      t('locationWizardStepName'),
      t('locationWizardStepBusiness'),
      t('locationWizardStepAddress'),
      t('locationWizardStepDefault'),
    ],
    [t]
  );

  if (!open) return null;

  const title = mode === 'edit' ? t('editLocation') : t('addLocation');

  const goNext = () => {
    if (step === 'name' && !form.name.trim()) {
      toast.error(t('locationNameRequired'));
      return;
    }
    const idx = stepIndex;
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
  };

  const goBack = () => {
    const idx = stepIndex;
    if (idx > 0) setStep(STEPS[idx - 1]);
  };

  const submit = async () => {
    if (!form.name.trim()) {
      toast.error(t('locationNameRequired'));
      setStep('name');
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
        className="w-full max-w-lg rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] shadow-xl"
        role="dialog"
        aria-labelledby="location-wizard-title"
      >
        <div className="px-4 py-3 border-b border-[var(--border)] flex items-start justify-between gap-2">
          <div>
            <h2 id="location-wizard-title" className="text-lg font-semibold">{title}</h2>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              {t('locationWizardProgress', { current: stepIndex + 1, total: STEPS.length })}
            </p>
          </div>
          <button type="button" className="btn-secondary p-2 shrink-0" onClick={onClose} aria-label={t('cancel')}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 pt-3 flex gap-1">
          {stepLabels.map((label, i) => (
            <div
              key={label}
              className={`h-1 flex-1 rounded-full ${i <= stepIndex ? 'bg-[var(--brand-primary)]' : 'bg-[var(--border)]'}`}
              title={label}
            />
          ))}
        </div>

        <div className="p-4 space-y-4 min-h-[12rem]">
          {step === 'name' ? (
            <SettingsField label={t('locationName')}>
              <input
                className="input w-full"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                autoFocus
                required
              />
            </SettingsField>
          ) : null}

          {step === 'business' ? (
            <div className="space-y-2">
              <p className="text-sm text-[var(--text-muted)]">{t('locationWizardBusinessHint')}</p>
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
                      <div>
                        <div className="font-medium">{cat === 'retail' ? t('retail') : t('restaurant')}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {step === 'address' ? (
            <div className="space-y-4">
              <SettingsField label={t('address')}>
                <input
                  className="input w-full"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  autoFocus
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
            </div>
          ) : null}

          {step === 'default' ? (
            <div className="space-y-3">
              <p className="text-sm text-[var(--text-muted)]">{t('locationWizardDefaultHint')}</p>
              <label className="flex items-center gap-2 text-sm rounded-lg border border-[var(--border)] px-3 py-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                />
                {t('locationSetDefault')}
              </label>
            </div>
          ) : null}
        </div>

        <div className="px-4 py-3 border-t border-[var(--border)] flex justify-between gap-2">
          <button
            type="button"
            className="btn-secondary inline-flex items-center gap-1"
            onClick={goBack}
            disabled={stepIndex === 0}
          >
            <ChevronLeft className="w-4 h-4" />
            {t('back')}
          </button>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>
              {t('cancel')}
            </button>
            {step === 'default' ? (
              <button type="button" className="btn-primary" disabled={saving} onClick={() => void submit()}>
                {saving ? t('saving') : mode === 'edit' ? t('save') : t('addLocation')}
              </button>
            ) : (
              <button type="button" className="btn-primary inline-flex items-center gap-1" onClick={goNext}>
                {t('continue')}
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
