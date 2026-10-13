import { FormEvent, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Award, ExternalLink, Save } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import {
  settingsDash,
  SettingsField,
  SettingsPageHeader,
  SettingsReportCard,
  SettingsToggleRow,
} from '@/components/settings/SettingsReportUi';
import { testComoConnection, type ComoPublicSettings } from '@/lib/como-client';

const empty: ComoPublicSettings = {
  enabled: false,
  environment: 'live',
  apiKeyMasked: null,
  apiKeySet: false,
  branchId: null,
  posId: null,
  allowQuickRegistration: false,
  configured: false,
  lastTestOkAt: null,
};

export default function SettingsComoTab() {
  const { t } = useI18n();
  const [form, setForm] = useState<ComoPublicSettings>(empty);
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/merchant/settings')
      .then((res) => {
        if (cancelled) return;
        const raw = (res.data?.comoSettings || res.data?.settings?.comoSettings || {}) as ComoPublicSettings;
        setForm({ ...empty, ...raw });
        setApiKey(raw.apiKeyMasked || '');
      })
      .catch(() => {
        /* settings load errors toast elsewhere */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put('/merchant/settings', {
        comoSettings: {
          enabled: form.enabled,
          apiKey,
          branchId: form.branchId,
          posId: form.posId,
          allowQuickRegistration: form.allowQuickRegistration,
        },
      });
      const next = (res.data?.merchant?.comoSettings || form) as ComoPublicSettings;
      setForm({ ...empty, ...next });
      setApiKey(next.apiKeyMasked || '');
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

  const test = async () => {
    setTesting(true);
    try {
      const result = await testComoConnection();
      if (result.ok) {
        setForm((prev) => ({ ...prev, lastTestOkAt: new Date().toISOString() }));
        toast.success(t('comoTestOk'));
      } else {
        toast.error(result.error || t('comoTestFailed'));
      }
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : null;
      toast.error(msg || t('comoTestFailed'));
    } finally {
      setTesting(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-5">
      <SettingsPageHeader title={t('settingsComo')} subtitle={t('comoSettingsHint')} />

      <SettingsReportCard icon={Award} accent={settingsDash.accent} title={t('comoEnable')}>
        <SettingsToggleRow
          title={t('comoEnable')}
          hint={t('comoEnableHint')}
          checked={form.enabled}
          onChange={(enabled) => setForm((prev) => ({ ...prev, enabled }))}
        />
        <p className="mt-3 text-xs text-[var(--text-muted)]">
          {form.configured ? t('comoConfigured') : t('comoNeedsKey')}
          {form.lastTestOkAt
            ? ` · ${new Date(form.lastTestOkAt).toLocaleString()}`
            : ''}
        </p>
      </SettingsReportCard>

      <SettingsReportCard icon={Award} accent={settingsDash.info} title={t('comoApiKey')}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SettingsField label={t('comoApiKey')} hint={t('comoApiKeyHint')}>
            <input
              className="input"
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={form.apiKeySet ? '••••••••' : ''}
            />
          </SettingsField>
          <SettingsField label={t('comoBranchId')} hint={t('comoBranchIdHint')}>
            <input
              className="input"
              value={form.branchId || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, branchId: e.target.value }))}
            />
          </SettingsField>
          <SettingsField label={t('comoPosId')} hint={t('comoPosIdHint')}>
            <input
              className="input"
              value={form.posId || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, posId: e.target.value }))}
            />
          </SettingsField>
        </div>
        <div className="mt-4">
          <SettingsToggleRow
            title={t('comoAllowRegister')}
            hint={t('comoAllowRegisterHint')}
            checked={form.allowQuickRegistration}
            onChange={(allowQuickRegistration) =>
              setForm((prev) => ({ ...prev, allowQuickRegistration }))
            }
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="submit" className="btn-primary" disabled={saving}>
            <Save className="mr-1 inline h-4 w-4" />
            {t('save')}
          </button>
          <button type="button" className="btn-secondary" disabled={testing || !form.apiKeySet} onClick={() => void test()}>
            {t('comoTestConnection')}
          </button>
        </div>
      </SettingsReportCard>

      <SettingsReportCard icon={Award} accent={settingsDash.warning} title={t('comoSetupTitle')}>
        <p className="whitespace-pre-line text-sm text-[var(--text-muted)]">{t('comoSetupSteps')}</p>
        <a
          href="https://knowledge.comosense.com/hc/en-us/articles/38296290491922-Como-Integration-FAQ"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium underline"
        >
          {t('comoDocsLink')}
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </SettingsReportCard>
    </form>
  );
}
