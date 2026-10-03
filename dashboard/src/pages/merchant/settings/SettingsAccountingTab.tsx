import { FormEvent, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import { Download, Save, Calculator, Link2, Unlink, Upload, type LucideIcon } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import {
  isAccountingLicensed,
  isBexioLicensed,
  isOdooLicensed,
} from '@/lib/accounting-addon';
import { defaultAccountingAccountMap } from '@/lib/accounting-defaults';
import {
  settingsDash,
  SettingsField,
  SettingsPageHeader,
  SettingsReportCard,
  SettingsToggleRow,
} from '@/components/settings/SettingsReportUi';

type AccountForm = {
  salesRevenue: string;
  vatPayable: string;
  cash: string;
  cardClearing: string;
  terminalClearing: string;
  tips: string;
  discounts: string;
  refunds: string;
};

type BexioForm = {
  enabled: boolean;
  syncMode: 'export_only' | 'api';
  personalAccessToken: string;
  personalAccessTokenSet?: boolean;
  oauthConnected?: boolean;
  oauthConnectedAt?: string | null;
  referencePrefix: string;
  accounts: AccountForm;
  lastPushedAt?: string | null;
  lastPushError?: string | null;
};

type OdooForm = {
  enabled: boolean;
  syncMode: 'export_only' | 'api';
  baseUrl: string;
  database: string;
  username: string;
  apiKey: string;
  apiKeySet?: boolean;
  journalCode: string;
  accounts: AccountForm;
  lastPushedAt?: string | null;
  lastPushError?: string | null;
};

const emptyAccounts = (): AccountForm => {
  const d = defaultAccountingAccountMap();
  return {
    salesRevenue: d.salesRevenue || '',
    vatPayable: d.vatPayable || '',
    cash: d.cash || '',
    cardClearing: d.cardClearing || '',
    terminalClearing: d.terminalClearing || '',
    tips: d.tips || '',
    discounts: d.discounts || '',
    refunds: d.refunds || '',
  };
};

const emptyBexio = (): BexioForm => ({
  enabled: false,
  syncMode: 'export_only',
  personalAccessToken: '',
  referencePrefix: 'CHASLAY',
  accounts: emptyAccounts(),
});

const emptyOdoo = (): OdooForm => ({
  enabled: false,
  syncMode: 'export_only',
  baseUrl: '',
  database: '',
  username: '',
  apiKey: '',
  journalCode: 'MISC',
  accounts: emptyAccounts(),
});

function readAccounts(raw: unknown): AccountForm {
  const base = emptyAccounts();
  if (!raw || typeof raw !== 'object') return base;
  const o = raw as Record<string, unknown>;
  const pick = (k: keyof AccountForm) => {
    const v = o[k];
    return v != null && String(v).trim() ? String(v).trim() : base[k];
  };
  return {
    salesRevenue: pick('salesRevenue'),
    vatPayable: pick('vatPayable'),
    cash: pick('cash'),
    cardClearing: pick('cardClearing'),
    terminalClearing: pick('terminalClearing'),
    tips: pick('tips'),
    discounts: pick('discounts'),
    refunds: pick('refunds'),
  };
}

export default function SettingsAccountingTab() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<'bexio' | 'odoo' | null>(null);
  const [pushing, setPushing] = useState<'bexio' | 'odoo' | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [licensed, setLicensed] = useState(false);
  const [bexioLicensed, setBexioLicensed] = useState(false);
  const [odooLicensed, setOdooLicensed] = useState(false);
  const [bexio, setBexio] = useState<BexioForm>(emptyBexio());
  const [odoo, setOdoo] = useState<OdooForm>(emptyOdoo());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/merchant/settings');
      const s = res.data.settings || {};
      setLicensed(isAccountingLicensed(s));
      setBexioLicensed(isBexioLicensed(s));
      setOdooLicensed(isOdooLicensed(s));
      const ai = (s.accountingIntegrationSettings || {}) as {
        bexio?: Partial<BexioForm> & { personalAccessTokenSet?: boolean; accounts?: unknown };
        odoo?: Partial<OdooForm> & { apiKeySet?: boolean; accounts?: unknown };
      };
      setBexio({
        ...emptyBexio(),
        enabled: !!ai.bexio?.enabled,
        syncMode: ai.bexio?.syncMode === 'api' ? 'api' : 'export_only',
        personalAccessToken: '',
        personalAccessTokenSet: !!ai.bexio?.personalAccessTokenSet,
        oauthConnected: !!ai.bexio?.oauthConnected,
        oauthConnectedAt: ai.bexio?.oauthConnectedAt,
        referencePrefix: ai.bexio?.referencePrefix || 'CHASLAY',
        accounts: readAccounts(ai.bexio?.accounts),
        lastPushedAt: ai.bexio?.lastPushedAt,
        lastPushError: ai.bexio?.lastPushError,
      });
      setOdoo({
        ...emptyOdoo(),
        enabled: !!ai.odoo?.enabled,
        syncMode: ai.odoo?.syncMode === 'api' ? 'api' : 'export_only',
        baseUrl: ai.odoo?.baseUrl || '',
        database: ai.odoo?.database || '',
        username: ai.odoo?.username || '',
        apiKey: '',
        apiKeySet: !!ai.odoo?.apiKeySet,
        journalCode: ai.odoo?.journalCode || 'MISC',
        accounts: readAccounts(ai.odoo?.accounts),
        lastPushedAt: ai.odoo?.lastPushedAt,
        lastPushError: ai.odoo?.lastPushError,
      });
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || t('cmsLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const status = searchParams.get('bexio');
    if (!status) return;
    if (status === 'connected') toast.success(t('accountingBexioOAuthOk'));
    else if (status === 'error') {
      const reason = searchParams.get('reason') || '';
      toast.error(reason ? `${t('accountingBexioOAuthFailed')}: ${reason}` : t('accountingBexioOAuthFailed'));
    }
    const next = new URLSearchParams(searchParams);
    next.delete('bexio');
    next.delete('reason');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, t]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/merchant/settings', {
        accountingIntegrationSettings: {
          bexio: bexioLicensed
            ? {
                enabled: bexio.enabled,
                syncMode: bexio.syncMode,
                personalAccessToken: bexio.personalAccessToken || undefined,
                referencePrefix: bexio.referencePrefix,
                accounts: bexio.accounts,
              }
            : undefined,
          odoo: odooLicensed
            ? {
                enabled: odoo.enabled,
                syncMode: odoo.syncMode,
                baseUrl: odoo.baseUrl,
                database: odoo.database,
                username: odoo.username,
                apiKey: odoo.apiKey || undefined,
                journalCode: odoo.journalCode,
                accounts: odoo.accounts,
              }
            : undefined,
        },
      });
      toast.success(t('settingsSaved'));
      await load();
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { error?: string } } };
      toast.error(e2.response?.data?.error || t('settingsSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async (platform: 'bexio' | 'odoo') => {
    setTesting(platform);
    try {
      await api.post(`/merchant/accounting/${platform}/test`);
      toast.success(t('accountingTestOk'));
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { error?: string } } };
      toast.error(e2.response?.data?.error || t('accountingTestFailed'));
    } finally {
      setTesting(null);
    }
  };

  const connectBexioOAuth = async () => {
    try {
      const res = await api.get('/merchant/accounting/bexio/oauth/start');
      const url = res.data?.url;
      if (!url) throw new Error('Missing authorize URL');
      window.location.href = url;
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { error?: string } } };
      toast.error(e2.response?.data?.error || t('accountingBexioOAuthFailed'));
    }
  };

  const disconnectBexioOAuth = async () => {
    try {
      await api.post('/merchant/accounting/bexio/oauth/disconnect');
      toast.success(t('accountingBexioOAuthDisconnected'));
      await load();
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { error?: string } } };
      toast.error(e2.response?.data?.error || t('accountingBexioOAuthFailed'));
    }
  };

  const pushPeriod = async (platform: 'bexio' | 'odoo', preset: 'today' | 'this_month' = 'today') => {
    setPushing(platform);
    try {
      const res = await api.post(`/merchant/accounting/${platform}/push`, { preset });
      if (res.data?.skipped) toast.success(t('accountingPushSkipped'));
      else toast.success(t('accountingPushOk'));
      await load();
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { error?: string } } };
      toast.error(e2.response?.data?.error || t('accountingPushFailed'));
    } finally {
      setPushing(null);
    }
  };

  const accountFields = (
    accounts: AccountForm,
    onChange: (next: AccountForm) => void,
    idPrefix: string
  ) => (
    <div className="grid gap-3 sm:grid-cols-2">
      {(
        [
          ['salesRevenue', t('accountingAcctSales')],
          ['vatPayable', t('accountingAcctVat')],
          ['cash', t('accountingAcctCash')],
          ['cardClearing', t('accountingAcctCard')],
          ['terminalClearing', t('accountingAcctTerminal')],
          ['tips', t('accountingAcctTips')],
          ['discounts', t('accountingAcctDiscounts')],
          ['refunds', t('accountingAcctRefunds')],
        ] as const
      ).map(([key, label]) => (
        <SettingsField key={key} label={label}>
          <input
            id={`${idPrefix}-${key}`}
            className="input w-full"
            value={accounts[key]}
            onChange={(ev) => onChange({ ...accounts, [key]: ev.target.value })}
          />
        </SettingsField>
      ))}
    </div>
  );

  const upsell = (
    <SettingsReportCard>
      <p className="text-sm text-muted-foreground">{t('accountingAddonOff')}</p>
      <p className="text-sm mt-2">
        <a href="/merchant/billing" className="text-primary underline">
          {t('accountingAddonBilling')}
        </a>
      </p>
    </SettingsReportCard>
  );

  const Section = ({
    title,
    icon: Icon,
    children,
  }: {
    title: string;
    icon: LucideIcon;
    children: React.ReactNode;
  }) => (
    <SettingsReportCard>
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">{title}</h3>
      </div>
      {children}
    </SettingsReportCard>
  );

  const exportHint = useMemo(
    () => (
      <p className="text-sm text-muted-foreground mt-4">
        {t('accountingExportHint')}{' '}
        <a href="/merchant/reports" className="text-primary underline inline-flex items-center gap-1">
          <Download className="w-3.5 h-3.5" />
          {t('reports')}
        </a>
      </p>
    ),
    [t]
  );

  if (loading) {
    return <p className="text-sm text-muted-foreground">{t('loading')}</p>;
  }

  if (!licensed) {
    return (
      <>
        <SettingsPageHeader title={t('settingsAccounting')} subtitle={t('settingsAccountingHint')} />
        {upsell}
      </>
    );
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <SettingsPageHeader title={t('settingsAccounting')} subtitle={t('settingsAccountingHint')} />
      {exportHint}

      {bexioLicensed && (
        <Section title={t('accountingBexioTitle')} icon={Save}>
          <SettingsToggleRow
            label={t('accountingEnabled')}
            checked={bexio.enabled}
            onChange={(v) => setBexio({ ...bexio, enabled: v })}
          />
          <SettingsField label={t('accountingSyncMode')} hint={t('accountingSyncModeHint')}>
            <select
              className="input w-full max-w-md"
              value={bexio.syncMode}
              onChange={(ev) =>
                setBexio({
                  ...bexio,
                  syncMode: ev.target.value === 'api' ? 'api' : 'export_only',
                })
              }
            >
              <option value="export_only">{t('accountingSyncExportOnly')}</option>
              <option value="api">{t('accountingSyncApi')}</option>
            </select>
          </SettingsField>
          <SettingsField
            label={t('accountingBexioPat')}
            hint={t('accountingBexioPatHint')}
          >
            <input
              type="password"
              className="input w-full max-w-lg"
              placeholder={bexio.personalAccessTokenSet ? '••••••••' : ''}
              value={bexio.personalAccessToken}
              onChange={(ev) => setBexio({ ...bexio, personalAccessToken: ev.target.value })}
            />
          </SettingsField>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {bexio.oauthConnected ? (
              <>
                <span className="text-sm text-muted-foreground">{t('accountingBexioOAuthConnected')}</span>
                <button
                  type="button"
                  className="btn-secondary text-sm inline-flex items-center gap-1"
                  onClick={() => void disconnectBexioOAuth()}
                >
                  <Unlink className="w-3.5 h-3.5" />
                  {t('accountingBexioOAuthDisconnect')}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn-secondary text-sm inline-flex items-center gap-1"
                onClick={() => void connectBexioOAuth()}
              >
                <Link2 className="w-3.5 h-3.5" />
                {t('accountingBexioOAuthConnect')}
              </button>
            )}
          </div>
          <SettingsField label={t('accountingReferencePrefix')}>
            <input
              className="input w-full max-w-xs"
              value={bexio.referencePrefix}
              onChange={(ev) => setBexio({ ...bexio, referencePrefix: ev.target.value })}
            />
          </SettingsField>
          <p className="text-sm font-medium mt-4 mb-2">{t('accountingChartMapping')}</p>
          {accountFields(bexio.accounts, (accounts) => setBexio({ ...bexio, accounts }), 'bexio')}
          {bexio.lastPushError ? (
            <p className="text-sm text-destructive mt-3">{bexio.lastPushError}</p>
          ) : null}
          {bexio.lastPushedAt ? (
            <p className="text-xs text-muted-foreground mt-2">
              {t('accountingLastPush')}: {bexio.lastPushedAt}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2 mt-4">
            <button
              type="button"
              className="btn-secondary text-sm"
              disabled={testing === 'bexio'}
              onClick={() => void testConnection('bexio')}
            >
              {testing === 'bexio' ? t('testing') : t('accountingTestConnection')}
            </button>
            {bexio.syncMode === 'api' && bexio.enabled ? (
              <>
                <button
                  type="button"
                  className="btn-secondary text-sm inline-flex items-center gap-1"
                  disabled={pushing === 'bexio'}
                  onClick={() => void pushPeriod('bexio', 'today')}
                >
                  <Upload className="w-3.5 h-3.5" />
                  {pushing === 'bexio' ? t('saving') : t('accountingPushToday')}
                </button>
                <button
                  type="button"
                  className="btn-secondary text-sm inline-flex items-center gap-1"
                  disabled={pushing === 'bexio'}
                  onClick={() => void pushPeriod('bexio', 'this_month')}
                >
                  <Upload className="w-3.5 h-3.5" />
                  {pushing === 'bexio' ? t('saving') : t('accountingPushMonth')}
                </button>
              </>
            ) : null}
          </div>
        </Section>
      )}

      {odooLicensed && (
        <Section title={t('accountingOdooTitle')} icon={Save}>
          <SettingsToggleRow
            label={t('accountingEnabled')}
            checked={odoo.enabled}
            onChange={(v) => setOdoo({ ...odoo, enabled: v })}
          />
          <SettingsField label={t('accountingSyncMode')}>
            <select
              className="input w-full max-w-md"
              value={odoo.syncMode}
              onChange={(ev) =>
                setOdoo({
                  ...odoo,
                  syncMode: ev.target.value === 'api' ? 'api' : 'export_only',
                })
              }
            >
              <option value="export_only">{t('accountingSyncExportOnly')}</option>
              <option value="api">{t('accountingSyncApi')}</option>
            </select>
          </SettingsField>
          <SettingsField label={t('accountingOdooUrl')}>
            <input
              className="input w-full max-w-lg"
              placeholder="https://mycompany.odoo.com"
              value={odoo.baseUrl}
              onChange={(ev) => setOdoo({ ...odoo, baseUrl: ev.target.value })}
            />
          </SettingsField>
          <SettingsField label={t('accountingOdooDatabase')}>
            <input
              className="input w-full max-w-md"
              value={odoo.database}
              onChange={(ev) => setOdoo({ ...odoo, database: ev.target.value })}
            />
          </SettingsField>
          <SettingsField label={t('accountingOdooUser')}>
            <input
              className="input w-full max-w-md"
              value={odoo.username}
              onChange={(ev) => setOdoo({ ...odoo, username: ev.target.value })}
            />
          </SettingsField>
          <SettingsField label={t('accountingOdooApiKey')} hint={t('accountingOdooApiKeyHint')}>
            <input
              type="password"
              className="input w-full max-w-lg"
              placeholder={odoo.apiKeySet ? '••••••••' : ''}
              value={odoo.apiKey}
              onChange={(ev) => setOdoo({ ...odoo, apiKey: ev.target.value })}
            />
          </SettingsField>
          <SettingsField label={t('accountingOdooJournal')}>
            <input
              className="input w-full max-w-xs"
              value={odoo.journalCode}
              onChange={(ev) => setOdoo({ ...odoo, journalCode: ev.target.value })}
            />
          </SettingsField>
          <p className="text-sm font-medium mt-4 mb-2">{t('accountingChartMapping')}</p>
          {accountFields(odoo.accounts, (accounts) => setOdoo({ ...odoo, accounts }), 'odoo')}
          {odoo.lastPushError ? (
            <p className="text-sm text-destructive mt-3">{odoo.lastPushError}</p>
          ) : null}
          <div className="flex flex-wrap gap-2 mt-4">
            <button
              type="button"
              className="btn-secondary text-sm"
              disabled={testing === 'odoo'}
              onClick={() => void testConnection('odoo')}
            >
              {testing === 'odoo' ? t('testing') : t('accountingTestConnection')}
            </button>
            {odoo.syncMode === 'api' && odoo.enabled ? (
              <>
                <button
                  type="button"
                  className="btn-secondary text-sm inline-flex items-center gap-1"
                  disabled={pushing === 'odoo'}
                  onClick={() => void pushPeriod('odoo', 'today')}
                >
                  <Upload className="w-3.5 h-3.5" />
                  {pushing === 'odoo' ? t('saving') : t('accountingPushToday')}
                </button>
                <button
                  type="button"
                  className="btn-secondary text-sm inline-flex items-center gap-1"
                  disabled={pushing === 'odoo'}
                  onClick={() => void pushPeriod('odoo', 'this_month')}
                >
                  <Upload className="w-3.5 h-3.5" />
                  {pushing === 'odoo' ? t('saving') : t('accountingPushMonth')}
                </button>
              </>
            ) : null}
          </div>
        </Section>
      )}

      <div className="flex gap-2">
        <button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={saving}>
          <Save className="w-4 h-4" />
          {saving ? t('saving') : t('save')}
        </button>
      </div>
    </form>
  );
}
