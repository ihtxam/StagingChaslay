import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Bike, Copy, Save, Truck, type LucideIcon } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import {
  settingsDash,
  SettingsField,
  SettingsPageHeader,
  SettingsReportCard,
  SettingsToggleRow,
} from '@/components/settings/SettingsReportUi';

type PlatformForm = {
  enabled: boolean;
  testMode: boolean;
  storeId: string;
  apiKey: string;
  apiSecret: string;
  clientId: string;
  clientSecret: string;
  webhookSecret: string;
  autoAccept: boolean;
  apiKeySet?: boolean;
  apiSecretSet?: boolean;
  clientSecretSet?: boolean;
  webhookSecretSet?: boolean;
};

type DeliveryPlatformSettings = {
  justEat?: Partial<PlatformForm>;
  uberEats?: Partial<PlatformForm>;
};

const emptyPlatform = (): PlatformForm => ({
  enabled: false,
  testMode: true,
  storeId: '',
  apiKey: '',
  apiSecret: '',
  clientId: '',
  clientSecret: '',
  webhookSecret: '',
  autoAccept: false,
});

function apiBase(): string {
  const env = import.meta.env.VITE_API_URL as string | undefined;
  if (env) return env.replace(/\/$/, '');
  return `${window.location.origin}/api`;
}

function hasJustEatProductionCreds(form: PlatformForm): boolean {
  return !!(form.apiKeySet || form.apiKey.trim()) && !!(form.webhookSecretSet || form.webhookSecret.trim());
}

function hasUberProductionCreds(form: PlatformForm): boolean {
  return !!form.clientId.trim() && !!(form.clientSecretSet || form.clientSecret.trim());
}

export default function SettingsDeliveryPlatformsTab() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [merchantId, setMerchantId] = useState('');
  const [justEat, setJustEat] = useState<PlatformForm>(emptyPlatform());
  const [uberEats, setUberEats] = useState<PlatformForm>(emptyPlatform());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/merchant/settings');
      const s = res.data.settings || {};
      setMerchantId(String(s.id || ''));
      const dp = (s.deliveryPlatformSettings || {}) as DeliveryPlatformSettings;
      setJustEat({
        ...emptyPlatform(),
        enabled: !!dp.justEat?.enabled,
        testMode: dp.justEat?.testMode !== false,
        storeId: dp.justEat?.storeId || '',
        apiKey: '',
        apiSecret: '',
        webhookSecret: '',
        autoAccept: !!dp.justEat?.autoAccept,
        apiKeySet: !!dp.justEat?.apiKeySet,
        apiSecretSet: !!dp.justEat?.apiSecretSet,
        webhookSecretSet: !!dp.justEat?.webhookSecretSet,
      });
      setUberEats({
        ...emptyPlatform(),
        enabled: !!dp.uberEats?.enabled,
        testMode: dp.uberEats?.testMode !== false,
        storeId: dp.uberEats?.storeId || '',
        clientId: dp.uberEats?.clientId || '',
        clientSecret: '',
        webhookSecret: '',
        autoAccept: !!dp.uberEats?.autoAccept,
        clientSecretSet: !!dp.uberEats?.clientSecretSet,
        webhookSecretSet: !!dp.uberEats?.webhookSecretSet,
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

  const webhookUrls = useMemo(() => {
    if (!merchantId) return { justEat: '', uberEats: '' };
    const base = apiBase();
    return {
      justEat: `${base}/webhooks/just-eat/${merchantId}`,
      uberEats: `${base}/webhooks/uber-eats/${merchantId}`,
    };
  }, [merchantId]);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t('copied'));
    } catch {
      toast.error(t('copyFailed'));
    }
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const jeProd = hasJustEatProductionCreds(justEat);
      const ueProd = hasUberProductionCreds(uberEats);
      await api.put('/merchant/settings', {
        deliveryPlatformSettings: {
          justEat: {
            enabled: justEat.enabled,
            testMode: jeProd ? false : justEat.testMode,
            storeId: justEat.storeId || null,
            apiKey: justEat.apiKey || undefined,
            apiSecret: justEat.apiSecret || undefined,
            webhookSecret: justEat.webhookSecret || undefined,
            autoAccept: justEat.autoAccept,
          },
          uberEats: {
            enabled: uberEats.enabled,
            testMode: ueProd ? false : uberEats.testMode,
            storeId: uberEats.storeId || null,
            clientId: uberEats.clientId || null,
            clientSecret: uberEats.clientSecret || undefined,
            webhookSecret: uberEats.webhookSecret || undefined,
            autoAccept: uberEats.autoAccept,
          },
        },
      });
      toast.success(t('deliveryPlatformsSaved'));
      await load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      const msg = e.response?.data?.error || t('saveFailed');
      toast.error(
        /delivery_platform_settings/i.test(msg)
          ? t('deliveryPlatformsDbMigrateHint')
          : msg
      );
    } finally {
      setSaving(false);
    }
  };

  const renderPlatform = (
    title: string,
    icon: LucideIcon,
    accent: string,
    form: PlatformForm,
    setForm: (next: PlatformForm) => void,
    webhookUrl: string,
    variant: 'justeat' | 'ubereats'
  ) => {
    const prodReady =
      variant === 'justeat' ? hasJustEatProductionCreds(form) : hasUberProductionCreds(form);
    return (
      <SettingsReportCard title={title} icon={icon} accent={accent}>
        <SettingsToggleRow
          checked={form.enabled}
          onChange={(enabled) => setForm({ ...form, enabled })}
          title={t('deliveryPlatformEnable')}
          hint={t('deliveryPlatformEnableHint')}
        />
        <SettingsToggleRow
          checked={form.testMode}
          onChange={(testMode) => setForm({ ...form, testMode })}
          title={t('deliveryPlatformTestMode')}
          hint={
            prodReady
              ? t('deliveryPlatformTestModeDisabledProd')
              : t('deliveryPlatformTestModeHint')
          }
        />
        {prodReady && form.testMode ? (
          <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
            {t('deliveryPlatformProdCredsNotice')}
          </p>
        ) : null}
        <SettingsToggleRow
          checked={form.autoAccept}
          onChange={(autoAccept) => setForm({ ...form, autoAccept })}
          title={t('deliveryPlatformAutoAccept')}
          hint={t('deliveryPlatformAutoAcceptHint')}
        />
        {variant === 'justeat' ? (
          <>
            <p className="text-xs muted -mt-1 mb-2">
              {t('deliveryPlatformJustEatJetConnectHint')}
            </p>
            <SettingsField
              label={t('deliveryPlatformStoreId')}
              hint={t('deliveryPlatformJustEatStoreIdHint')}
            >
              <input
                className="input"
                value={form.storeId}
                onChange={(e) => setForm({ ...form, storeId: e.target.value })}
                placeholder="99999"
              />
            </SettingsField>
            <SettingsField
              label={t('deliveryPlatformJustEatApiKey')}
              hint={
                form.apiKeySet
                  ? t('deliveryPlatformSecretKeepBlank')
                  : t('deliveryPlatformJustEatApiKeyHint')
              }
            >
              <input
                className="input"
                type="password"
                autoComplete="off"
                value={form.apiKey}
                onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                placeholder={form.apiKeySet ? '••••••••' : ''}
              />
            </SettingsField>
            <SettingsField
              label={t('deliveryPlatformJustEatWebhookAuthKey')}
              hint={
                form.apiSecretSet
                  ? t('deliveryPlatformSecretKeepBlank')
                  : t('deliveryPlatformJustEatWebhookAuthKeyHint')
              }
            >
              <input
                className="input"
                type="password"
                autoComplete="off"
                value={form.apiSecret}
                onChange={(e) => setForm({ ...form, apiSecret: e.target.value })}
                placeholder={form.apiSecretSet ? '••••••••' : ''}
              />
            </SettingsField>
            <SettingsField
              label={t('deliveryPlatformJustEatWebhookHmacSecret')}
              hint={
                form.webhookSecretSet
                  ? t('deliveryPlatformSecretKeepBlank')
                  : t('deliveryPlatformJustEatWebhookHmacHint')
              }
            >
              <input
                className="input"
                type="password"
                autoComplete="off"
                value={form.webhookSecret}
                onChange={(e) => setForm({ ...form, webhookSecret: e.target.value })}
                placeholder={form.webhookSecretSet ? '••••••••' : ''}
              />
            </SettingsField>
          </>
        ) : (
          <>
            <SettingsField label={t('deliveryPlatformStoreId')}>
              <input
                className="input"
                value={form.storeId}
                onChange={(e) => setForm({ ...form, storeId: e.target.value })}
                placeholder="UE-STORE-456"
              />
            </SettingsField>
            <SettingsField label={t('deliveryPlatformClientId')}>
              <input
                className="input"
                value={form.clientId}
                onChange={(e) => setForm({ ...form, clientId: e.target.value })}
              />
            </SettingsField>
            <SettingsField
              label={t('deliveryPlatformClientSecret')}
              hint={form.clientSecretSet ? t('deliveryPlatformSecretKeepBlank') : undefined}
            >
              <input
                className="input"
                type="password"
                autoComplete="off"
                value={form.clientSecret}
                onChange={(e) => setForm({ ...form, clientSecret: e.target.value })}
                placeholder={form.clientSecretSet ? '••••••••' : ''}
              />
            </SettingsField>
          </>
        )}
        {variant === 'ubereats' ? (
          <SettingsField
            label={t('deliveryPlatformWebhookSecret')}
            hint={
              form.webhookSecretSet
                ? t('deliveryPlatformSecretKeepBlank')
                : t('deliveryPlatformWebhookSecretHint')
            }
          >
            <input
              className="input"
              type="password"
              autoComplete="off"
              value={form.webhookSecret}
              onChange={(e) => setForm({ ...form, webhookSecret: e.target.value })}
              placeholder={form.webhookSecretSet ? '••••••••' : ''}
            />
          </SettingsField>
        ) : null}
        <SettingsField
          label={t('deliveryPlatformWebhookUrl')}
          hint={
            variant === 'justeat'
              ? t('deliveryPlatformJustEatWebhookUrlHint')
              : t('deliveryPlatformWebhookUrlHint')
          }
        >
          <div className="flex gap-2">
            <input className="input flex-1" readOnly value={webhookUrl} />
            <button type="button" className="btn-secondary shrink-0" onClick={() => void copy(webhookUrl)}>
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </SettingsField>
      </SettingsReportCard>
    );
  };

  if (loading) {
    return <p className="muted text-sm py-8">{t('loading')}</p>;
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <SettingsPageHeader
        title={t('settingsDeliveryPlatforms')}
        subtitle={t('settingsDeliveryPlatformsHint')}
      />

      {renderPlatform(
        t('deliveryPlatformJustEat'),
        Truck,
        settingsDash.accent,
        justEat,
        setJustEat,
        webhookUrls.justEat,
        'justeat'
      )}
      {renderPlatform(
        t('deliveryPlatformUberEats'),
        Bike,
        settingsDash.info,
        uberEats,
        setUberEats,
        webhookUrls.uberEats,
        'ubereats'
      )}

      <SettingsReportCard
        title={t('deliveryPlatformChannelsTitle')}
        icon={Truck}
        accent={settingsDash.success}
      >
        <p className="text-sm muted">{t('deliveryPlatformChannelsHint')}</p>
        <ul className="text-sm list-disc pl-5 space-y-1 mt-2">
          <li>{t('deliveryPlatformChannelOnlineShop')}</li>
          <li>{t('deliveryPlatformChannelJustEat')}</li>
          <li>{t('deliveryPlatformChannelUberEats')}</li>
        </ul>
      </SettingsReportCard>

      <div className="flex justify-end">
        <button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={saving}>
          <Save className="w-4 h-4" />
          {saving ? t('saving') : t('save')}
        </button>
      </div>
    </form>
  );
}
