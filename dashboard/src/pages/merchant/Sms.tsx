import { FormEvent, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';

type SmsEventKey =
  | 'orderPlaced'
  | 'orderReady'
  | 'orderOutForDelivery'
  | 'reservationNew'
  | 'reservationConfirmed'
  | 'reservationReminder'
  | 'reservationCancelled'
  | 'giftCardEcard';

type SmsSettings = {
  senderName: string | null;
  defaultCountry: string;
  events: Record<SmsEventKey, boolean>;
  templates: Record<string, string>;
};

type Usage = {
  tier: string;
  periodYm: string;
  allowance: number;
  sent: number;
  remaining: number;
  overQuota: boolean;
};

type Campaign = {
  id: string;
  title: string;
  body: string;
  status: string;
  sentCount?: number;
  failedCount?: number;
  skippedCount?: number;
  sentAt?: string | null;
};

type AudienceRow = { id: string | null; phone: string; name: string; email: string | null };

const EVENT_KEYS: SmsEventKey[] = [
  'orderPlaced',
  'orderReady',
  'orderOutForDelivery',
  'reservationNew',
  'reservationConfirmed',
  'reservationReminder',
  'reservationCancelled',
  'giftCardEcard',
];

const TEMPLATE_KEYS = [
  'orderPlaced',
  'orderReady',
  'orderOutForDelivery',
  'reservationNew',
  'reservationConfirmed',
  'reservationReminder',
  'reservationCancelled',
  'otpLogin',
  'otpSignup',
  'marketingFooter',
] as const;

export default function SmsPage() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [licensed, setLicensed] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [settings, setSettings] = useState<SmsSettings | null>(null);
  const [testTo, setTestTo] = useState('');
  const [testBody, setTestBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [campaignTitle, setCampaignTitle] = useState('');
  const [campaignBody, setCampaignBody] = useState('');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [audience, setAudience] = useState<AudienceRow[]>([]);
  const [tab, setTab] = useState<'settings' | 'marketing'>('settings');

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/merchant/sms/overview');
      setLicensed(res.data.licensed === true);
      setConfigured(res.data.configured === true);
      setUsage(res.data.usage || null);
      setSettings(res.data.settings || null);
      if (res.data.licensed) {
        const [cRes, aRes] = await Promise.all([
          api.get('/merchant/sms/campaigns'),
          api.get('/merchant/sms/audience'),
        ]);
        setCampaigns(cRes.data.campaigns || []);
        setAudience(aRes.data.audience || []);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('smsLoadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const saveSettings = async (e: FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      const res = await api.put('/merchant/sms/settings', settings);
      setSettings(res.data.settings);
      toast.success(t('smsSettingsSaved'));
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('smsSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/merchant/sms/test', { to: testTo, body: testBody || t('smsTestDefaultBody') });
      toast.success(t('smsTestSent'));
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('smsTestFailed'));
    }
  };

  const sendCampaign = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const saved = await api.post('/merchant/sms/campaigns', {
        title: campaignTitle || t('smsCampaignDefaultTitle'),
        body: campaignBody,
        audience: 'all',
      });
      const id = saved.data.campaign?.id;
      if (!id) throw new Error('No campaign');
      if (!confirm(t('smsSendConfirm'))) return;
      await api.post(`/merchant/sms/campaigns/${id}/send`);
      toast.success(t('smsCampaignSent'));
      setCampaignTitle('');
      setCampaignBody('');
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('smsCampaignFailed'));
    }
  };

  if (loading) {
    return <div className="p-6 text-stone-500">{t('smsLoading')}</div>;
  }

  if (!licensed) {
    return (
      <div className="p-6 max-w-2xl">
        <h1 className="text-2xl font-bold text-stone-900 mb-2">{t('smsTitle')}</h1>
        <p className="text-stone-600">{t('smsAddonOff')}</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">{t('smsTitle')}</h1>
        <p className="text-stone-600 mt-1">{t('smsHint')}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label={t('smsTier')} value={(usage?.tier || 'starter').toUpperCase()} />
        <Stat label={t('smsSent')} value={String(usage?.sent ?? 0)} />
        <Stat label={t('smsRemaining')} value={String(usage?.remaining ?? 0)} />
        <Stat label={t('smsPeriod')} value={usage?.periodYm || '—'} />
      </div>
      {!configured ? (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {t('smsNotConfigured')}
        </p>
      ) : null}
      {usage?.overQuota ? (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {t('smsOverQuota')}
        </p>
      ) : null}

      <div className="flex gap-2 border-b border-stone-200">
        <TabBtn active={tab === 'settings'} onClick={() => setTab('settings')}>
          {t('smsTabSettings')}
        </TabBtn>
        <TabBtn active={tab === 'marketing'} onClick={() => setTab('marketing')}>
          {t('smsTabMarketing')}
        </TabBtn>
      </div>

      {tab === 'settings' && settings ? (
        <form onSubmit={saveSettings} className="space-y-6">
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-medium text-stone-700">{t('smsSenderName')}</span>
              <input
                className="input mt-1"
                maxLength={11}
                value={settings.senderName || ''}
                onChange={(e) => setSettings({ ...settings, senderName: e.target.value })}
                placeholder="Reborn"
              />
              <p className="text-xs text-stone-500 mt-1">{t('smsSenderHint')}</p>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-stone-700">{t('smsDefaultCountry')}</span>
              <input
                className="input mt-1"
                maxLength={2}
                value={settings.defaultCountry}
                onChange={(e) =>
                  setSettings({ ...settings, defaultCountry: e.target.value.toUpperCase() })
                }
              />
            </label>
          </div>

          <div>
            <h2 className="font-semibold text-stone-900 mb-2">{t('smsEvents')}</h2>
            <div className="grid sm:grid-cols-2 gap-2">
              {EVENT_KEYS.map((key) => (
                <label key={key} className="flex items-center gap-2 text-sm text-stone-700">
                  <input
                    type="checkbox"
                    checked={settings.events[key] !== false}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        events: { ...settings.events, [key]: e.target.checked },
                      })
                    }
                  />
                  {t(`smsEvent_${key}` as 'smsEvent_orderPlaced')}
                </label>
              ))}
            </div>
          </div>

          <div>
            <h2 className="font-semibold text-stone-900 mb-2">{t('smsTemplates')}</h2>
            <p className="text-xs text-stone-500 mb-2">{t('smsTemplateHint')}</p>
            <div className="space-y-3">
              {TEMPLATE_KEYS.map((key) => (
                <label key={key} className="block">
                  <span className="text-sm font-medium text-stone-700">
                    {t(`smsTpl_${key}` as 'smsTpl_orderPlaced')}
                  </span>
                  <textarea
                    className="input mt-1"
                    rows={2}
                    value={settings.templates[key] || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        templates: { ...settings.templates, [key]: e.target.value },
                      })
                    }
                  />
                </label>
              ))}
            </div>
          </div>

          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? t('smsSaving') : t('smsSaveSettings')}
          </button>
        </form>
      ) : null}

      {tab === 'settings' ? (
        <form onSubmit={sendTest} className="border border-stone-200 rounded-xl p-4 space-y-3">
          <h2 className="font-semibold text-stone-900">{t('smsTestTitle')}</h2>
          <label className="block">
            <span className="text-sm font-medium">{t('smsTestTo')}</span>
            <input
              className="input mt-1"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="+41 79 123 45 67"
              required
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">{t('smsTestBody')}</span>
            <input
              className="input mt-1"
              value={testBody}
              onChange={(e) => setTestBody(e.target.value)}
            />
          </label>
          <button type="submit" className="btn-secondary">
            {t('smsSendTest')}
          </button>
        </form>
      ) : null}

      {tab === 'marketing' ? (
        <div className="space-y-6">
          <p className="text-sm text-stone-600">
            {t('smsMarketingHint').replace('{count}', String(audience.length))}
          </p>
          <form onSubmit={sendCampaign} className="space-y-3">
            <label className="block">
              <span className="text-sm font-medium">{t('smsCampaignTitle')}</span>
              <input
                className="input mt-1"
                value={campaignTitle}
                onChange={(e) => setCampaignTitle(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">{t('smsCampaignBody')}</span>
              <textarea
                className="input mt-1"
                rows={4}
                required
                value={campaignBody}
                onChange={(e) => setCampaignBody(e.target.value)}
              />
            </label>
            <button type="submit" className="btn-primary" disabled={!audience.length}>
              {t('smsSendMarketing')}
            </button>
          </form>
          <div>
            <h3 className="font-semibold mb-2">{t('smsRecentCampaigns')}</h3>
            {campaigns.length === 0 ? (
              <p className="text-sm text-stone-500">{t('smsNoCampaigns')}</p>
            ) : (
              <ul className="text-sm space-y-2">
                {campaigns.map((c) => (
                  <li key={c.id} className="border border-stone-200 rounded-lg px-3 py-2">
                    <strong>{c.title}</strong> · {c.status} · {t('smsSent')} {c.sentCount ?? 0}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white px-3 py-3">
      <div className="text-xs uppercase tracking-wide text-stone-500">{label}</div>
      <div className="text-lg font-semibold text-stone-900">{value}</div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
        active ? 'border-teal-600 text-teal-800' : 'border-transparent text-stone-500'
      }`}
    >
      {children}
    </button>
  );
}
