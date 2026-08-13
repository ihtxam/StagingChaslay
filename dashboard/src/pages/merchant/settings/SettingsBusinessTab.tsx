import { FormEvent, type RefObject } from 'react';
import toast from 'react-hot-toast';
import {
  BadgeCheck,
  Building2,
  CalendarDays,
  CreditCard,
  Mail,
  MapPin,
  Phone,
  Save,
} from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { compressImageIfNeeded } from '@/lib/compress-image';
import {
  settingsDash,
  SettingsField,
  SettingsKpiCard,
  SettingsKpiGrid,
  SettingsPageHeader,
  SettingsReportCard,
  SettingsToggleRow,
} from '@/components/settings/SettingsReportUi';

type LocalizedMap = { en?: string | null; fr?: string | null; de?: string | null };

function asLocalized(raw: LocalizedMap | string | null | undefined): LocalizedMap {
  if (raw == null) return { en: '', fr: '', de: '' };
  if (typeof raw === 'string') return { en: raw, fr: raw, de: raw };
  return {
    en: raw.en || '',
    fr: raw.fr || '',
    de: raw.de || '',
  };
}

function LocalizedFields({
  label,
  value,
  onChange,
  multiline,
  placeholder,
}: {
  label: string;
  value: LocalizedMap | string | null | undefined;
  onChange: (next: LocalizedMap) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  const loc = asLocalized(value);
  const setLang = (lang: keyof LocalizedMap, v: string) => onChange({ ...loc, [lang]: v });
  const InputTag = multiline ? 'textarea' : 'input';
  return (
    <div className="space-y-2.5">
      <span className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        {label}
      </span>
      <div className="grid gap-2 sm:grid-cols-3">
        {(['en', 'fr', 'de'] as const).map((lang) => (
          <label key={lang} className="block space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              {lang}
            </span>
            <InputTag
              className={`input ${multiline ? 'min-h-[3.5rem]' : ''}`}
              value={loc[lang] || ''}
              onChange={(e) => setLang(lang, e.target.value)}
              placeholder={placeholder}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

export interface BusinessSettingsSlice {
  name: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  vatNumber?: string | null;
  subscriptionPlan?: string | null;
  status?: string | null;
  vacationSettings?: {
    enabled?: boolean;
    manualActive?: boolean;
    popupImageUrl?: string | null;
    popupTitle?: LocalizedMap | string | null;
    message?: LocalizedMap | string | null;
    periods?: Array<{
      id: string;
      startDate: string;
      startTime?: string | null;
      endDate: string;
      endTime?: string | null;
    }>;
  } | null;
}

interface SettingsBusinessTabProps<T extends BusinessSettingsSlice> {
  settings: T;
  setSettings: (next: T) => void;
  onSave: (e: FormEvent) => void | Promise<void>;
  saving: boolean;
  vacationImageInputRef: RefObject<HTMLInputElement | null>;
  highlightId?: string | null;
}

function formatLocation(city?: string | null, country?: string | null) {
  const parts = [city, country].filter(Boolean);
  return parts.length ? parts.join(', ') : '—';
}

function formatPlanLabel(plan?: string | null) {
  if (!plan) return 'Free';
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

function formatStatusLabel(status?: string | null) {
  if (!status) return 'Active';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function SettingsBusinessTab<T extends BusinessSettingsSlice>({
  settings,
  setSettings,
  onSave,
  saving,
  vacationImageInputRef,
  highlightId = null,
}: SettingsBusinessTabProps<T>) {
  const { t } = useI18n();
  const vacationPeriodCount = settings.vacationSettings?.periods?.length ?? 0;

  return (
    <form onSubmit={onSave} className="space-y-5">
      <SettingsPageHeader
        title={t('businessSettings')}
        subtitle={t('businessSettingsHint')}
        action={
          <button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={saving}>
            <Save className="h-4 w-4" aria-hidden />
            {saving ? t('saving') : t('save')}
          </button>
        }
      />

      <SettingsKpiGrid>
        <SettingsKpiCard
          icon={Building2}
          accent={settingsDash.accent}
          label={t('businessName')}
          value={settings.name || '—'}
        />
        <SettingsKpiCard
          icon={CreditCard}
          accent={settingsDash.info}
          label={t('plan')}
          value={formatPlanLabel(settings.subscriptionPlan)}
        />
        <SettingsKpiCard
          icon={BadgeCheck}
          accent={settingsDash.success}
          label={t('status')}
          value={formatStatusLabel(settings.status)}
        />
        <SettingsKpiCard
          icon={MapPin}
          accent={settingsDash.warning}
          label={t('city')}
          value={formatLocation(settings.city, settings.country)}
        />
      </SettingsKpiGrid>

      <SettingsReportCard
        id="business-profile"
        icon={Building2}
        accent={settingsDash.accent}
        title={t('businessName')}
        description={t('vatNumber')}
        highlight={highlightId === 'business-profile'}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SettingsField label={t('businessName')}>
            <input
              className="input font-semibold"
              value={settings.name}
              onChange={(e) => setSettings({ ...settings, name: e.target.value })}
              required
            />
          </SettingsField>
          <SettingsField label={t('vatNumber')}>
            <input
              className="input"
              value={settings.vatNumber || ''}
              onChange={(e) => setSettings({ ...settings, vatNumber: e.target.value })}
              placeholder="CHE-000.000.000 MWST"
            />
          </SettingsField>
        </div>
      </SettingsReportCard>

      <SettingsReportCard
        id="business-contact"
        icon={Mail}
        accent={settingsDash.info}
        title={t('phone')}
        description={t('businessEmail')}
        highlight={highlightId === 'business-contact'}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SettingsField label={t('businessEmail')}>
            <div className="relative">
              <Mail
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]"
                aria-hidden
              />
              <input
                className="input bg-[var(--bg-muted)]/60 pl-9 font-medium"
                value={settings.email}
                disabled
              />
            </div>
          </SettingsField>
          <SettingsField label={t('phone')}>
            <div className="relative">
              <Phone
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]"
                aria-hidden
              />
              <input
                className="input pl-9"
                value={settings.phone || ''}
                onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
              />
            </div>
          </SettingsField>
        </div>
      </SettingsReportCard>

      <SettingsReportCard
        id="business-location"
        icon={MapPin}
        accent={settingsDash.warning}
        title={t('address')}
        description={[settings.city, settings.country].filter(Boolean).join(' · ') || undefined}
        highlight={highlightId === 'business-location'}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <SettingsField label={t('address')}>
              <input
                className="input"
                value={settings.address || ''}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
              />
            </SettingsField>
          </div>
          <SettingsField label={t('city')}>
            <input
              className="input"
              value={settings.city || ''}
              onChange={(e) => setSettings({ ...settings, city: e.target.value })}
            />
          </SettingsField>
          <SettingsField label={t('country')}>
            <input
              className="input"
              value={settings.country || ''}
              onChange={(e) => setSettings({ ...settings, country: e.target.value })}
            />
          </SettingsField>
        </div>
      </SettingsReportCard>

      <SettingsReportCard
        id="business-vacation"
        icon={CalendarDays}
        accent={settingsDash.danger}
        title={t('vacationHolidays')}
        description={t('vacationHolidaysHint')}
        highlight={highlightId === 'business-vacation'}
      >
        <SettingsToggleRow
          checked={!!settings.vacationSettings?.enabled}
          onChange={(enabled) =>
            setSettings({
              ...settings,
              vacationSettings: {
                ...(settings.vacationSettings || { periods: [] }),
                enabled,
              },
            })
          }
          title={t('vacationEnabled')}
          hint={t('vacationEnabledHint')}
        />

        <div className="rounded-xl border-2 border-dashed border-[var(--border)] bg-[var(--bg-muted)]/40 p-4 space-y-3">
          <div>
            <p className="text-sm font-extrabold tracking-tight">{t('vacationPopupImage')}</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{t('vacationPopupImageHint')}</p>
          </div>
          {settings.vacationSettings?.popupImageUrl ? (
            <img
              src={settings.vacationSettings.popupImageUrl}
              alt=""
              className="max-h-36 sm:max-h-44 w-auto max-w-full rounded-lg border border-[var(--border)] object-contain bg-[var(--bg-elevated)]"
            />
          ) : (
            <button
              type="button"
              className="w-full min-h-[5.5rem] sm:min-h-[7rem] rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-elevated)] text-sm text-[var(--text-muted)] hover:border-[var(--text)] hover:text-[var(--text)] transition-colors"
              onClick={() => vacationImageInputRef.current?.click()}
            >
              {t('vacationUploadImage')}
            </button>
          )}
          <div className="flex flex-wrap gap-2">
            <input
              ref={vacationImageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                try {
                  const compressed = await compressImageIfNeeded(file, {
                    maxBytes: 500 * 1024,
                    targetBytes: 350 * 1024,
                    maxWidth: 1600,
                  });
                  const form = new FormData();
                  form.append('file', compressed);
                  const res = await api.post('/merchant/media', form);
                  const url = res.data?.url;
                  if (!url) throw new Error('No URL returned');
                  setSettings({
                    ...settings,
                    vacationSettings: {
                      ...(settings.vacationSettings || { periods: [] }),
                      popupImageUrl: url,
                    },
                  });
                  toast.success(t('vacationImageUploaded'));
                } catch (error: any) {
                  toast.error(error.response?.data?.error || t('vacationImageUploadFailed'));
                }
              }}
            />
            <button
              type="button"
              className="btn-primary"
              onClick={() => vacationImageInputRef.current?.click()}
            >
              {t('vacationUploadImage')}
            </button>
            {settings.vacationSettings?.popupImageUrl ? (
              <button
                type="button"
                className="btn-secondary"
                onClick={() =>
                  setSettings({
                    ...settings,
                    vacationSettings: {
                      ...(settings.vacationSettings || { periods: [] }),
                      popupImageUrl: '',
                    },
                  })
                }
              >
                {t('vacationClearImage')}
              </button>
            ) : null}
          </div>
          <SettingsField label={t('vacationOrPasteUrl')}>
            <input
              className="input"
              value={settings.vacationSettings?.popupImageUrl || ''}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  vacationSettings: {
                    ...(settings.vacationSettings || { periods: [] }),
                    popupImageUrl: e.target.value,
                  },
                })
              }
              placeholder="https://…"
            />
          </SettingsField>
        </div>

        <LocalizedFields
          label={t('vacationPopupTitle')}
          value={settings.vacationSettings?.popupTitle}
          placeholder={t('vacationPopupTitlePlaceholder')}
          onChange={(popupTitle) =>
            setSettings({
              ...settings,
              vacationSettings: {
                ...(settings.vacationSettings || { periods: [] }),
                popupTitle,
              },
            })
          }
        />
        <LocalizedFields
          label={t('vacationMessage')}
          value={settings.vacationSettings?.message}
          multiline
          placeholder={t('vacationMessagePlaceholder')}
          onChange={(message) =>
            setSettings({
              ...settings,
              vacationSettings: {
                ...(settings.vacationSettings || { periods: [] }),
                message,
              },
            })
          }
        />

        <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--bg-muted)]/25 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-sm font-extrabold tracking-tight">{t('vacationPeriods')}</span>
              {vacationPeriodCount > 0 ? (
                <span className="ml-2 inline-flex rounded-full bg-[var(--bg-elevated)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                  {vacationPeriodCount}
                </span>
              ) : null}
            </div>
            <button
              type="button"
              className="btn-secondary text-xs"
              onClick={() => {
                const id =
                  typeof crypto !== 'undefined' && crypto.randomUUID
                    ? crypto.randomUUID()
                    : `p-${Date.now()}`;
                const today = new Date().toISOString().slice(0, 10);
                setSettings({
                  ...settings,
                  vacationSettings: {
                    ...(settings.vacationSettings || {}),
                    periods: [
                      ...(settings.vacationSettings?.periods || []),
                      {
                        id,
                        startDate: today,
                        startTime: '00:00',
                        endDate: today,
                        endTime: '23:59',
                      },
                    ],
                  },
                });
              }}
            >
              {t('vacationAddPeriod')}
            </button>
          </div>
          <p className="text-xs text-[var(--text-muted)]">{t('vacationPeriodsHint')}</p>
          {(settings.vacationSettings?.periods || []).length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] italic">{t('vacationEmptyPeriods')}</p>
          ) : (
            <div className="space-y-3">
              {(settings.vacationSettings?.periods || []).map((period, idx) => (
                <div
                  key={period.id || idx}
                  className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-3.5 space-y-3 shadow-sm"
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <SettingsField label={t('vacationStart')}>
                      <input
                        className="input"
                        type="date"
                        value={period.startDate}
                        onChange={(e) => {
                          const periods = [...(settings.vacationSettings?.periods || [])];
                          periods[idx] = { ...period, startDate: e.target.value };
                          setSettings({
                            ...settings,
                            vacationSettings: { ...settings.vacationSettings, periods },
                          });
                        }}
                        required
                      />
                    </SettingsField>
                    <SettingsField label={t('vacationStartTime')}>
                      <input
                        className="input"
                        type="time"
                        value={period.startTime || '00:00'}
                        onChange={(e) => {
                          const periods = [...(settings.vacationSettings?.periods || [])];
                          periods[idx] = { ...period, startTime: e.target.value };
                          setSettings({
                            ...settings,
                            vacationSettings: { ...settings.vacationSettings, periods },
                          });
                        }}
                      />
                    </SettingsField>
                    <SettingsField label={t('vacationEnd')}>
                      <input
                        className="input"
                        type="date"
                        value={period.endDate}
                        min={period.startDate}
                        onChange={(e) => {
                          const periods = [...(settings.vacationSettings?.periods || [])];
                          periods[idx] = { ...period, endDate: e.target.value };
                          setSettings({
                            ...settings,
                            vacationSettings: { ...settings.vacationSettings, periods },
                          });
                        }}
                        required
                      />
                    </SettingsField>
                    <SettingsField label={t('vacationEndTime')}>
                      <input
                        className="input"
                        type="time"
                        value={period.endTime || '23:59'}
                        onChange={(e) => {
                          const periods = [...(settings.vacationSettings?.periods || [])];
                          periods[idx] = { ...period, endTime: e.target.value };
                          setSettings({
                            ...settings,
                            vacationSettings: { ...settings.vacationSettings, periods },
                          });
                        }}
                      />
                    </SettingsField>
                  </div>
                  <button
                    type="button"
                    className="text-xs font-semibold text-red-600 underline underline-offset-2 hover:text-red-700"
                    onClick={() => {
                      const periods = (settings.vacationSettings?.periods || []).filter(
                        (_, i) => i !== idx
                      );
                      setSettings({
                        ...settings,
                        vacationSettings: { ...settings.vacationSettings, periods },
                      });
                    }}
                  >
                    {t('vacationRemove')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </SettingsReportCard>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/30 px-4 py-3">
        <p className="text-xs text-[var(--text-muted)]">
          {t('plan')}:{' '}
          <span className="font-bold text-[var(--text)]">
            {formatPlanLabel(settings.subscriptionPlan)}
          </span>{' '}
          · {t('status')}:{' '}
          <span className="font-bold text-[var(--text)]">
            {formatStatusLabel(settings.status)}
          </span>
        </p>
        <button type="submit" className="btn-primary sm:hidden" disabled={saving}>
          {saving ? t('saving') : t('save')}
        </button>
      </div>
    </form>
  );
}
