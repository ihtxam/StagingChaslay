import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FileCheck, RefreshCw, Save } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { settingsDash, SettingsField, SettingsPageHeader, SettingsReportCard } from '@/components/settings/SettingsReportUi';

type FiskalyPublic = {
  enabled?: boolean;
  environment?: 'test' | 'live';
  de?: {
    apiKeyMasked?: string | null;
    apiKeySet?: boolean;
    apiSecretMasked?: string | null;
    apiSecretSet?: boolean;
    tssId?: string | null;
    clientId?: string | null;
    clientSerial?: string | null;
    adminPinSet?: boolean;
  };
  fr?: {
    apiKeyMasked?: string | null;
    apiKeySet?: boolean;
    apiSecretMasked?: string | null;
    apiSecretSet?: boolean;
    unitId?: string | null;
    systemId?: string | null;
    taxpayerId?: string | null;
    locationId?: string | null;
    siren?: string | null;
  };
};

type MerchantSettingsSlice = {
  country?: string | null;
  fiskalySettings?: FiskalyPublic | null;
};

function isFiskalyCountry(country?: string | null): boolean {
  const c = String(country || '').trim().toUpperCase();
  return c === 'DE' || c === 'GERMANY' || c === 'DEUTSCHLAND' || c === 'FR' || c === 'FRANCE';
}

function countryCode(country?: string | null): 'DE' | 'FR' | null {
  const c = String(country || '').trim().toUpperCase();
  if (c === 'DE' || c === 'GERMANY' || c === 'DEUTSCHLAND') return 'DE';
  if (c === 'FR' || c === 'FRANCE') return 'FR';
  return null;
}

export default function SettingsFiscalTab({
  settings,
  onSettingsChange,
}: {
  settings: MerchantSettingsSlice | null;
  onSettingsChange: (next: MerchantSettingsSlice) => void;
}) {
  const { t } = useI18n();
  const fs = settings?.fiskalySettings;
  const cc = countryCode(settings?.country);

  const [enabled, setEnabled] = useState(fs?.enabled === true);
  const [environment, setEnvironment] = useState<'test' | 'live'>(fs?.environment === 'live' ? 'live' : 'test');
  const [deApiKey, setDeApiKey] = useState('');
  const [deApiSecret, setDeApiSecret] = useState('');
  const [deTssId, setDeTssId] = useState(fs?.de?.tssId || '');
  const [deClientId, setDeClientId] = useState(fs?.de?.clientId || '');
  const [deClientSerial, setDeClientSerial] = useState(fs?.de?.clientSerial || '');
  const [frApiKey, setFrApiKey] = useState('');
  const [frApiSecret, setFrApiSecret] = useState('');
  const [frUnitId, setFrUnitId] = useState(fs?.fr?.unitId || '');
  const [frSystemId, setFrSystemId] = useState(fs?.fr?.systemId || '');
  const [frSiren, setFrSiren] = useState(fs?.fr?.siren || '');
  const [saving, setSaving] = useState(false);
  const [testingDe, setTestingDe] = useState(false);
  const [testingFr, setTestingFr] = useState(false);

  useEffect(() => {
    setEnabled(fs?.enabled === true);
    setEnvironment(fs?.environment === 'live' ? 'live' : 'test');
    setDeTssId(fs?.de?.tssId || '');
    setDeClientId(fs?.de?.clientId || '');
    setDeClientSerial(fs?.de?.clientSerial || '');
    setFrUnitId(fs?.fr?.unitId || '');
    setFrSystemId(fs?.fr?.systemId || '');
    setFrSiren(fs?.fr?.siren || '');
    setDeApiKey('');
    setDeApiSecret('');
    setFrApiKey('');
    setFrApiSecret('');
  }, [fs]);

  const showDe = cc === 'DE';
  const showFr = cc === 'FR';

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        fiskalySettings: {
          enabled,
          environment,
          de: showDe
            ? {
                tssId: deTssId.trim() || undefined,
                clientId: deClientId.trim() || undefined,
                clientSerial: deClientSerial.trim() || undefined,
                ...(deApiKey ? { apiKey: deApiKey } : {}),
                ...(deApiSecret ? { apiSecret: deApiSecret } : {}),
              }
            : undefined,
          fr: showFr
            ? {
                unitId: frUnitId.trim() || undefined,
                systemId: frSystemId.trim() || undefined,
                siren: frSiren.trim() || undefined,
                ...(frApiKey ? { apiKey: frApiKey } : {}),
                ...(frApiSecret ? { apiSecret: frApiSecret } : {}),
              }
            : undefined,
        },
      };
      const res = await api.put('/merchant/settings', payload);
      onSettingsChange(res.data);
      toast.success(t('saved'));
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const testConnection = useCallback(
    async (country: 'DE' | 'FR') => {
      if (country === 'DE') setTestingDe(true);
      else setTestingFr(true);
      try {
        if (saving) return;
        if (enabled) {
          await api.put('/merchant/settings', {
            fiskalySettings: {
              enabled,
              environment,
              de: showDe
                ? {
                    tssId: deTssId.trim() || undefined,
                    clientId: deClientId.trim() || undefined,
                    clientSerial: deClientSerial.trim() || undefined,
                    ...(deApiKey ? { apiKey: deApiKey } : {}),
                    ...(deApiSecret ? { apiSecret: deApiSecret } : {}),
                  }
                : undefined,
              fr: showFr
                ? {
                    unitId: frUnitId.trim() || undefined,
                    systemId: frSystemId.trim() || undefined,
                    siren: frSiren.trim() || undefined,
                    ...(frApiKey ? { apiKey: frApiKey } : {}),
                    ...(frApiSecret ? { apiSecret: frApiSecret } : {}),
                  }
                : undefined,
            },
          });
        }
        await api.post('/merchant/fiskaly/test-connection', { country });
        toast.success(t('fiskalyTestOk'));
      } catch (err: any) {
        toast.error(err.response?.data?.error || t('fiskalyTestFailed'));
      } finally {
        if (country === 'DE') setTestingDe(false);
        else setTestingFr(false);
      }
    },
    [
      deApiKey,
      deApiSecret,
      deClientId,
      deClientSerial,
      deTssId,
      enabled,
      environment,
      frApiKey,
      frApiSecret,
      frSiren,
      frSystemId,
      frUnitId,
      saving,
      showDe,
      showFr,
      t,
    ]
  );

  const docsLinks = useMemo(
    () => ({
      de: 'https://workspace.fiskaly.com/countries/germany/quickstart',
      fr: 'https://workspace.fiskaly.com/unified/france/quickstart',
    }),
    []
  );

  if (!settings || !isFiskalyCountry(settings.country)) {
    return (
      <div className="space-y-5">
        <SettingsPageHeader title={t('settingsFiscal')} subtitle={t('fiskalyCountryHint')} />
        <SettingsReportCard icon={FileCheck} accent={settingsDash.accent} title={t('settingsFiscal')}>
          <p className="text-sm text-[var(--text-muted)]">{t('fiskalyCountryOnly')}</p>
        </SettingsReportCard>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <SettingsPageHeader title={t('settingsFiscal')} subtitle={t('fiskalySettingsHint')} />

      <SettingsReportCard icon={FileCheck} accent={settingsDash.accent} title={t('fiskalyEnable')}>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            className="rounded"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          {t('fiskalyEnable')}
        </label>
        <p className="mt-2 text-xs text-[var(--text-muted)]">{t('fiskalyEnableHint')}</p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SettingsField label={t('fiskalyEnvironment')}>
            <select
              className="input"
              value={environment}
              onChange={(e) => setEnvironment(e.target.value === 'live' ? 'live' : 'test')}
            >
              <option value="test">{t('fiskalyEnvTest')}</option>
              <option value="live">{t('fiskalyEnvLive')}</option>
            </select>
          </SettingsField>
        </div>
      </SettingsReportCard>

      {showDe && (
        <SettingsReportCard title={t('fiskalyDeSection')} icon={FileCheck} accent={settingsDash.accent}>
          <p className="mb-3 text-xs text-[var(--text-muted)]">
            <a href={docsLinks.de} target="_blank" rel="noopener noreferrer" className="underline">
              {t('fiskalyDeDocs')}
            </a>
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SettingsField
              label={t('apiKey')}
              hint={fs?.de?.apiKeySet ? `${t('currentKey')}: ${fs.de.apiKeyMasked || '••••'}` : undefined}
            >
              <input
                className="input"
                type="password"
                value={deApiKey}
                onChange={(e) => setDeApiKey(e.target.value)}
                placeholder={fs?.de?.apiKeySet ? fs.de.apiKeyMasked || '••••' : ''}
                autoComplete="new-password"
              />
            </SettingsField>
            <SettingsField
              label={t('fiskalyApiSecret')}
              hint={fs?.de?.apiSecretSet ? `${t('currentKey')}: ${fs.de.apiSecretMasked || '••••'}` : undefined}
            >
              <input
                className="input"
                type="password"
                value={deApiSecret}
                onChange={(e) => setDeApiSecret(e.target.value)}
                placeholder={fs?.de?.apiSecretSet ? fs.de.apiSecretMasked || '••••' : ''}
                autoComplete="new-password"
              />
            </SettingsField>
            <SettingsField label={t('fiskalyTssId')}>
              <input className="input" value={deTssId} onChange={(e) => setDeTssId(e.target.value)} />
            </SettingsField>
            <SettingsField label={t('fiskalyClientId')}>
              <input className="input" value={deClientId} onChange={(e) => setDeClientId(e.target.value)} />
            </SettingsField>
            <SettingsField label={t('fiskalyClientSerial')}>
              <input
                className="input"
                value={deClientSerial}
                onChange={(e) => setDeClientSerial(e.target.value)}
              />
            </SettingsField>
          </div>
          <button
            type="button"
            className="btn-secondary mt-4 inline-flex items-center gap-2"
            disabled={testingDe}
            onClick={() => void testConnection('DE')}
          >
            <RefreshCw className={`h-4 w-4 ${testingDe ? 'animate-spin' : ''}`} />
            {t('fiskalyTestConnection')}
          </button>
        </SettingsReportCard>
      )}

      {showFr && (
        <SettingsReportCard title={t('fiskalyFrSection')} icon={FileCheck} accent={settingsDash.success}>
          <p className="mb-3 text-xs text-[var(--text-muted)]">
            <a href={docsLinks.fr} target="_blank" rel="noopener noreferrer" className="underline">
              {t('fiskalyFrDocs')}
            </a>
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SettingsField
              label={t('apiKey')}
              hint={fs?.fr?.apiKeySet ? `${t('currentKey')}: ${fs.fr.apiKeyMasked || '••••'}` : undefined}
            >
              <input
                className="input"
                type="password"
                value={frApiKey}
                onChange={(e) => setFrApiKey(e.target.value)}
                placeholder={fs?.fr?.apiKeySet ? fs.fr.apiKeyMasked || '••••' : ''}
                autoComplete="new-password"
              />
            </SettingsField>
            <SettingsField
              label={t('fiskalyApiSecret')}
              hint={fs?.fr?.apiSecretSet ? `${t('currentKey')}: ${fs.fr.apiSecretMasked || '••••'}` : undefined}
            >
              <input
                className="input"
                type="password"
                value={frApiSecret}
                onChange={(e) => setFrApiSecret(e.target.value)}
                placeholder={fs?.fr?.apiSecretSet ? fs.fr.apiSecretMasked || '••••' : ''}
                autoComplete="new-password"
              />
            </SettingsField>
            <SettingsField label={t('fiskalyUnitId')}>
              <input className="input" value={frUnitId} onChange={(e) => setFrUnitId(e.target.value)} />
            </SettingsField>
            <SettingsField label={t('fiskalySystemId')}>
              <input className="input" value={frSystemId} onChange={(e) => setFrSystemId(e.target.value)} />
            </SettingsField>
            <SettingsField label={t('fiskalySiren')}>
              <input className="input" value={frSiren} onChange={(e) => setFrSiren(e.target.value)} />
            </SettingsField>
          </div>
          <button
            type="button"
            className="btn-secondary mt-4 inline-flex items-center gap-2"
            disabled={testingFr}
            onClick={() => void testConnection('FR')}
          >
            <RefreshCw className={`h-4 w-4 ${testingFr ? 'animate-spin' : ''}`} />
            {t('fiskalyTestConnection')}
          </button>
        </SettingsReportCard>
      )}

      <div className="flex justify-end">
        <button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={saving}>
          <Save className="h-4 w-4" />
          {saving ? t('saving') : t('save')}
        </button>
      </div>
    </form>
  );
}
