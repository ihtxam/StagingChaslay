import { FormEvent, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Phone, Save } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import {
  settingsDash,
  SettingsField,
  SettingsPageHeader,
  SettingsReportCard,
  SettingsToggleRow,
} from '@/components/settings/SettingsReportUi';

type PhonePublic = {
  enabled: boolean;
  phoneNumber: string | null;
  hours: string | null;
  webhookSecretMasked: string | null;
  webhookSecretSet: boolean;
  configured: boolean;
};

const empty: PhonePublic = {
  enabled: false,
  phoneNumber: null,
  hours: null,
  webhookSecretMasked: null,
  webhookSecretSet: false,
  configured: false,
};

export default function SettingsPhoneOrderingTab() {
  const { t } = useI18n();
  const [form, setForm] = useState<PhonePublic>(empty);
  const [secret, setSecret] = useState('');
  const [saving, setSaving] = useState(false);
  const [merchantId, setMerchantId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/merchant/settings')
      .then((res) => {
        if (cancelled) return;
        const raw = (res.data?.settings?.phoneOrderingSettings ||
          res.data?.phoneOrderingSettings ||
          {}) as PhonePublic;
        setForm({ ...empty, ...raw });
        setSecret(raw.webhookSecretMasked || '');
        setMerchantId(String(res.data?.settings?.id || res.data?.id || '').trim() || null);
      })
      .catch(() => {
        /* settings load errors toast elsewhere */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const webhookUrl = useMemo(() => {
    if (!merchantId || typeof window === 'undefined') return '';
    return `${window.location.origin}/api/webhooks/phone/${merchantId}`;
  }, [merchantId]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put('/merchant/settings', {
        phoneOrderingSettings: {
          enabled: form.enabled,
          phoneNumber: form.phoneNumber,
          hours: form.hours,
          webhookSecret: secret,
        },
      });
      const next = (res.data?.merchant?.phoneOrderingSettings || form) as PhonePublic;
      setForm({ ...empty, ...next });
      setSecret(next.webhookSecretMasked || '');
      toast.success(t('saved'));
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : null;
      toast.error(msg || t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-5">
      <SettingsPageHeader title={t('settingsPhoneOrdering')} subtitle={t('phoneOrderingHint')} />

      <SettingsReportCard icon={Phone} accent={settingsDash.accent} title={t('phoneOrderingEnable')}>
        <SettingsToggleRow
          title={t('phoneOrderingEnable')}
          hint={t('phoneOrderingEnableHint')}
          checked={form.enabled}
          onChange={(enabled) => setForm((prev) => ({ ...prev, enabled }))}
        />
      </SettingsReportCard>

      <SettingsReportCard icon={Phone} accent={settingsDash.info} title={t('phoneOrderingNumber')}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SettingsField label={t('phoneOrderingNumber')} hint={t('phoneOrderingNumberHint')}>
            <input
              className="input"
              value={form.phoneNumber || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, phoneNumber: e.target.value }))}
              placeholder="+41 21 555 0101"
            />
          </SettingsField>
          <SettingsField label={t('phoneOrderingHours')} hint={t('phoneOrderingHoursHint')}>
            <input
              className="input"
              value={form.hours || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, hours: e.target.value }))}
              placeholder="11:00–21:00"
            />
          </SettingsField>
          <SettingsField label={t('phoneOrderingSecret')} hint={t('phoneOrderingSecretHint')}>
            <input
              className="input"
              type="password"
              autoComplete="off"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder={form.webhookSecretSet ? '••••••••' : ''}
            />
          </SettingsField>
          {webhookUrl ? (
            <SettingsField label={t('phoneOrderingWebhookUrl')}>
              <input className="input" readOnly value={webhookUrl} onFocus={(e) => e.target.select()} />
            </SettingsField>
          ) : null}
        </div>
        <div className="mt-4">
          <button type="submit" className="btn-primary" disabled={saving}>
            <Save className="mr-1 inline h-4 w-4" />
            {t('save')}
          </button>
        </div>
      </SettingsReportCard>
    </form>
  );
}
