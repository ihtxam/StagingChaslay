import { FormEvent, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Save } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { isDesktopApp } from '@/lib/platform';
import {
  settingsDash,
  SettingsField,
  SettingsPageHeader,
  SettingsReportCard,
} from '@/components/settings/SettingsReportUi';

type StoreForm = {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  vatNumber: string;
};

const EMPTY: StoreForm = {
  name: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  vatNumber: '',
};

export default function DesktopStorePage() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<StoreForm>(EMPTY);

  useEffect(() => {
    if (!isDesktopApp()) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await api.get('/merchant/settings');
        const s = res.data?.settings || {};
        if (cancelled) return;
        setForm({
          name: String(s.name || ''),
          email: String(s.email || ''),
          phone: String(s.phone || ''),
          address: String(s.address || ''),
          city: String(s.city || ''),
          vatNumber: String(s.vatNumber || ''),
        });
      } catch {
        if (!cancelled) toast.error(t('loadFailed'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/merchant/settings', {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        vatNumber: form.vatNumber.trim() || null,
      });
      toast.success(t('saved'));
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? String((err as { response?: { data?: { error?: string } } }).response?.data?.error || '')
          : '';
      toast.error(msg || t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (!isDesktopApp()) {
    return <Navigate to="/merchant/settings?tab=business" replace />;
  }

  return (
    <div className="desktop-hub-page mx-auto max-w-3xl p-4 pt-2">
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-5">
        <SettingsPageHeader
          title={t('desktopHubStore')}
          subtitle={t('desktopHubStoreHint')}
          action={
            <button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={saving}>
              <Save className="h-4 w-4" aria-hidden />
              {saving ? t('saving') : t('save')}
            </button>
          }
        />
        <SettingsReportCard accent={settingsDash.info}>
          {loading ? (
            <p className="text-sm muted">{t('loading')}</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <SettingsField label={t('businessName')}>
                  <input
                    className="input"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    required
                  />
                </SettingsField>
              </div>
              <SettingsField label={t('email')}>
                <input
                  className="input"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </SettingsField>
              <SettingsField label={t('phone')}>
                <input
                  className="input"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </SettingsField>
              <div className="sm:col-span-2">
                <SettingsField label={t('address')}>
                  <input
                    className="input"
                    value={form.address}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  />
                </SettingsField>
              </div>
              <SettingsField label={t('city')}>
                <input
                  className="input"
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                />
              </SettingsField>
              <SettingsField label={t('vatNumber')}>
                <input
                  className="input"
                  value={form.vatNumber}
                  onChange={(e) => setForm((f) => ({ ...f, vatNumber: e.target.value }))}
                />
              </SettingsField>
            </div>
          )}
        </SettingsReportCard>
        <p className="text-xs text-[var(--text-muted)]">{t('desktopHubAdvancedWebHint')}</p>
      </form>
    </div>
  );
}
