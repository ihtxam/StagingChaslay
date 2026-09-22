import { FormEvent, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Mail, RefreshCw } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';

type AdyenSettings = {
  merchantAccount: string;
  clientKey: string;
  clientKeySet?: boolean;
  clientKeyMasked?: string;
  environment: string;
  apiKeyMasked: string;
  apiKeySet: boolean;
  hmacKeyMasked: string;
  hmacKeySet: boolean;
  configured: boolean;
  usingEnvFallback?: boolean;
};

type EmailSettings = {
  configured: boolean;
  provider?: string | null;
  fromEmail: string;
  fromName: string;
  apiKeyMasked?: string;
  apiKeySet: boolean;
  usingEnvFallback?: boolean;
};

type MailcoSettings = EmailSettings & {
  apiBase?: string;
  templateSlug?: string;
  emailPrimary?: 'mailco' | 'brevo';
};

type EmailUsageSummary = {
  period?: { day?: string; month?: string };
  today?: number;
  thisMonth?: number;
  allTime?: number;
  byType?: Array<{ emailType: string; count: number }>;
  byMerchant?: Array<{ merchantId: string | null; merchantName: string; count: number }>;
  brevo?: EmailSettings;
  mailco?: MailcoSettings;
  platformEmailPrimary?: 'mailco' | 'brevo';
  activeProvider?: string | null;
  activeFromEmail?: string;
  activeFromName?: string;
  lastShopOrderEmail?: {
    provider: string;
    source?: string;
    sentAt?: string;
    recipient?: string;
    orderId?: string | null;
    merchantId?: string | null;
  } | null;
  allEmailViaMailco?: boolean;
  mailcoBrevoFallbackEnabled?: boolean;
  account?: {
    email?: string;
    companyName?: string;
    planCredits?: number | null;
    planType?: string | null;
    error?: string;
  } | null;
};

export default function Settings() {
  const { t } = useI18n();
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [savingPassword, setSavingPassword] = useState(false);
  const [adyen, setAdyen] = useState<AdyenSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingAdyen, setSavingAdyen] = useState(false);
  const [adyenForm, setAdyenForm] = useState({
    merchantAccount: '',
    clientKey: '',
    environment: 'TEST',
    apiKey: '',
    hmacKey: '',
  });
  const [brevo, setBrevo] = useState<EmailSettings | null>(null);
  const [brevoForm, setBrevoForm] = useState({
    fromEmail: '',
    fromName: 'Reborn',
    apiKey: '',
  });
  const [savingBrevo, setSavingBrevo] = useState(false);
  const [mailco, setMailco] = useState<MailcoSettings | null>(null);
  const [mailcoForm, setMailcoForm] = useState({
    fromEmail: '',
    fromName: 'Reborn',
    apiKey: '',
    apiBase: 'https://ees.mailco.ch/api/v1',
    templateSlug: 'platform-transactional',
    emailPrimary: 'mailco' as 'mailco' | 'brevo',
  });
  const [savingMailco, setSavingMailco] = useState(false);
  const [emailUsage, setEmailUsage] = useState<EmailUsageSummary | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [testEmailTo, setTestEmailTo] = useState('');
  const [sendingMailcoTestEmail, setSendingMailcoTestEmail] = useState(false);
  const [sendingBrevoTestEmail, setSendingBrevoTestEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{
    provider: 'mailco' | 'brevo';
    ok: boolean;
    message: string;
  } | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const [adyenRes, brevoRes, mailcoRes] = await Promise.all([
        api.get('/superadmin/platform-settings/adyen'),
        api.get('/superadmin/platform-settings/brevo'),
        api.get('/superadmin/platform-settings/mailco'),
      ]);
      const a = adyenRes.data.adyen as AdyenSettings;
      setAdyen(a);
      setAdyenForm({
        merchantAccount: a.merchantAccount || '',
        clientKey: a.clientKeySet ? '' : a.clientKey || '',
        environment: a.environment || 'TEST',
        apiKey: '',
        hmacKey: '',
      });
      const b = brevoRes.data.brevo as EmailSettings;
      setBrevo(b);
      setBrevoForm({
        fromEmail: b.fromEmail || '',
        fromName: b.fromName || 'Reborn',
        apiKey: '',
      });
      const m = mailcoRes.data.mailco as MailcoSettings;
      setMailco(m);
      setMailcoForm({
        fromEmail: m.fromEmail || '',
        fromName: m.fromName || 'Reborn',
        apiKey: '',
        apiBase: m.apiBase || 'https://ees.mailco.ch/api/v1',
        templateSlug: m.templateSlug || 'platform-transactional',
        emailPrimary: m.emailPrimary === 'brevo' ? 'brevo' : 'mailco',
      });
      await refreshEmailUsage();
    } catch {
      toast.error('Failed to load platform settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const savePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword.length < 8) {
      toast.error(t('resetPasswordMin'));
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error(t('resetPasswordMismatch'));
      return;
    }
    setSavingPassword(true);
    try {
      await api.post('/auth/change-own-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success(t('changePasswordSuccess'));
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('changePasswordFailed'));
    } finally {
      setSavingPassword(false);
    }
  };

  const saveAdyen = async (e: FormEvent) => {
    e.preventDefault();
    setSavingAdyen(true);
    try {
      const res = await api.put('/superadmin/platform-settings/adyen', {
        merchantAccount: adyenForm.merchantAccount,
        ...(adyenForm.clientKey.trim() ? { clientKey: adyenForm.clientKey.trim() } : {}),
        environment: adyenForm.environment,
        apiKey: adyenForm.apiKey || undefined,
        hmacKey: adyenForm.hmacKey || undefined,
      });
      setAdyen(res.data.adyen);
      setAdyenForm((f) => ({ ...f, apiKey: '', hmacKey: '' }));
      toast.success('Platform Swisspayout settings saved');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save Swisspayout settings');
    } finally {
      setSavingAdyen(false);
    }
  };

  const refreshEmailUsage = async () => {
    setLoadingUsage(true);
    try {
      const res = await api.get('/superadmin/email/usage');
      setEmailUsage(res.data.usage || null);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to load email usage');
    } finally {
      setLoadingUsage(false);
    }
  };

  const saveMailco = async (e: FormEvent) => {
    e.preventDefault();
    setSavingMailco(true);
    try {
      const res = await api.put('/superadmin/platform-settings/mailco', {
        fromEmail: mailcoForm.fromEmail,
        fromName: mailcoForm.fromName,
        apiBase: mailcoForm.apiBase,
        templateSlug: mailcoForm.templateSlug,
        emailPrimary: mailcoForm.emailPrimary,
        apiKey: mailcoForm.apiKey || undefined,
      });
      setMailco(res.data.mailco);
      setMailcoForm((f) => ({ ...f, apiKey: '' }));
      toast.success('Platform mailco settings saved');
      await refreshEmailUsage();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save mailco settings');
    } finally {
      setSavingMailco(false);
    }
  };

  const saveBrevo = async (e: FormEvent) => {
    e.preventDefault();
    setSavingBrevo(true);
    try {
      const res = await api.put('/superadmin/platform-settings/brevo', {
        fromEmail: brevoForm.fromEmail,
        fromName: brevoForm.fromName,
        apiKey: brevoForm.apiKey || undefined,
      });
      setBrevo(res.data.brevo);
      setBrevoForm((f) => ({ ...f, apiKey: '' }));
      toast.success('Platform Brevo settings saved');
      await refreshEmailUsage();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save Brevo settings');
    } finally {
      setSavingBrevo(false);
    }
  };

  const sendPlatformTestEmail = async (provider: 'mailco' | 'brevo') => {
    const to = testEmailTo.trim();
    if (!to.includes('@')) {
      toast.error(t('loginEmailInvalid'));
      return;
    }
    const setSending =
      provider === 'mailco' ? setSendingMailcoTestEmail : setSendingBrevoTestEmail;
    setSending(true);
    setTestEmailResult(null);
    try {
      await api.post('/superadmin/email/test', { to, provider });
      const message = t('smtpTestSent');
      setTestEmailResult({ provider, ok: true, message });
      toast.success(message);
      await refreshEmailUsage();
    } catch (err: any) {
      const message = err.response?.data?.error || t('smtpTestFailed');
      setTestEmailResult({ provider, ok: false, message });
      toast.error(message);
    } finally {
      setSending(false);
      window.setTimeout(() => setTestEmailResult(null), 8000);
    }
  };

  if (loading) {
    return <div className="card">Loading platform settings…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <h1 className="text-2xl font-bold">{t('settings')}</h1>
        <p className="text-gray-600 mt-1 mb-4">
          Platform credentials and security. Subscription packages are managed under{' '}
          <strong>Merchants → Direct sales catalog</strong>.
        </p>
      </div>

      <div className="card">
        <h2 className="text-xl font-bold">{t('changePassword')}</h2>
        <p className="text-gray-600 mt-1 mb-4">{t('changePasswordHint')}</p>
        <form onSubmit={savePassword} className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl">
          <label className="block">
            <span className="text-sm font-medium">{t('changePasswordCurrent')}</span>
            <input
              className="input mt-1"
              type="password"
              autoComplete="current-password"
              required
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">{t('changePasswordNew')}</span>
            <input
              className="input mt-1"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">{t('changePasswordConfirm')}</span>
            <input
              className="input mt-1"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
            />
          </label>
          <div className="md:col-span-3">
            <button type="submit" className="btn btn-primary" disabled={savingPassword}>
              {savingPassword ? t('saving') : t('changePassword')}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2 className="text-xl font-bold">Platform Swisspayout (subscription payments)</h2>
        <p className="text-gray-600 mt-1 mb-4">
          When merchants buy a subscription, payments settle to <strong>your</strong> Adyen account - not
          the merchant&apos;s shop Adyen credentials.
        </p>

        {adyen && (
          <p className="text-sm mb-4">
            Status:{' '}
            <span className={adyen.configured ? 'text-emerald-700 font-medium' : 'text-amber-700 font-medium'}>
              {adyen.configured ? 'Configured' : 'Not configured'}
            </span>
            {adyen.usingEnvFallback ? ' (using environment variables)' : null}
          </p>
        )}

        <form onSubmit={saveAdyen} className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
          <label className="block">
            <span className="text-sm font-medium">Merchant account</span>
            <input
              className="input mt-1"
              value={adyenForm.merchantAccount}
              onChange={(e) => setAdyenForm({ ...adyenForm, merchantAccount: e.target.value })}
              placeholder="YourCompanyECOM"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">
              Client key (Drop-in){' '}
              {adyen?.clientKeySet
                ? `(set: ${adyen.clientKeyMasked || '••••'})`
                : '(not set — required for subscription checkout)'}
            </span>
            <input
              className="input mt-1"
              value={adyenForm.clientKey}
              onChange={(e) => setAdyenForm({ ...adyenForm, clientKey: e.target.value })}
              placeholder={adyen?.clientKeySet ? 'Leave blank to keep current' : 'test_…'}
            />
            <span className="mt-1 block text-xs text-gray-500">
              From Adyen Customer Area → Developers → Client settings. Must start with{' '}
              <code className="text-[11px]">test_</code> or <code className="text-[11px]">live_</code> — not
              the API key (<code className="text-[11px]">AQE…</code>).
            </span>
          </label>
          <label className="block">
            <span className="text-sm font-medium">Environment</span>
            <select
              className="input mt-1"
              value={adyenForm.environment}
              onChange={(e) => setAdyenForm({ ...adyenForm, environment: e.target.value })}
            >
              <option value="TEST">TEST</option>
              <option value="LIVE">LIVE</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium">
              API key {adyen?.apiKeySet ? `(set: ${adyen.apiKeyMasked})` : '(not set)'}
            </span>
            <input
              className="input mt-1"
              type="password"
              autoComplete="new-password"
              value={adyenForm.apiKey}
              onChange={(e) => setAdyenForm({ ...adyenForm, apiKey: e.target.value })}
              placeholder={adyen?.apiKeySet ? 'Leave blank to keep current' : 'AQE…'}
            />
          </label>
          <label className="block md:col-span-2">
            <span className="text-sm font-medium">
              HMAC key (webhook) {adyen?.hmacKeySet ? `(set: ${adyen.hmacKeyMasked})` : '(optional)'}
            </span>
            <input
              className="input mt-1"
              type="password"
              autoComplete="new-password"
              value={adyenForm.hmacKey}
              onChange={(e) => setAdyenForm({ ...adyenForm, hmacKey: e.target.value })}
              placeholder={adyen?.hmacKeySet ? 'Leave blank to keep current' : 'Optional'}
            />
          </label>
          <div className="md:col-span-2">
            <p className="text-xs text-gray-500 mb-3">
              Webhook URL: <code>/api/webhooks/adyen/subscription</code>
            </p>
            <button type="submit" className="btn btn-primary" disabled={savingAdyen}>
              {savingAdyen ? 'Saving…' : 'Save Swisspayout settings'}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold inline-flex items-center gap-2">
              <Mail className="h-5 w-5" aria-hidden />
              Platform email (mailco)
            </h2>
            <p className="text-gray-600 mt-1">
              When mailco is configured, <strong>all</strong> platform transactional email — shop
              orders, gift cards, newsletters, invites, password resets, merchant alerts — routes
              through mailco (Swiss relay at{' '}
              <a
                className="text-blue-700 underline"
                href="https://mailco.ch/docs/#domains"
                target="_blank"
                rel="noreferrer"
              >
                mailco.ch
              </a>
              ). Customers see the merchant business name as sender; Reply-To is set to the merchant
              shop email. Brevo is kept for credential testing only — not used unless you set{' '}
              <code className="text-xs bg-gray-100 px-1 rounded">MAILCO_BREVO_FALLBACK=1</code> on
              the server for outage-only fallback.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary inline-flex items-center gap-2 shrink-0"
            onClick={() => refreshEmailUsage()}
            disabled={loadingUsage}
          >
            <RefreshCw className={`h-4 w-4 ${loadingUsage ? 'animate-spin' : ''}`} aria-hidden />
            Refresh usage
          </button>
        </div>

        {emailUsage?.allEmailViaMailco ? (
          <p className="text-sm mb-4 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-emerald-950 font-medium">
            All email via Mailco — shop orders, gift cards, newsletters, invites, password resets,
            and platform mail use the mailco relay. Brevo fallback is{' '}
            {emailUsage.mailcoBrevoFallbackEnabled ? (
              <span className="text-amber-800">enabled (MAILCO_BREVO_FALLBACK=1)</span>
            ) : (
              <span>disabled — send failures surface in logs instead of silently switching to Brevo</span>
            )}
            .
          </p>
        ) : null}

        {emailUsage?.activeProvider ? (
          <p className="text-sm mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-900">
            Active transactional provider: <strong>{emailUsage.activeProvider}</strong>
            {emailUsage.activeFromEmail ? (
              <>
                {' '}
                · From <code>{emailUsage.activeFromEmail}</code>
                {emailUsage.activeFromName ? ` (${emailUsage.activeFromName})` : ''}
              </>
            ) : null}
            {emailUsage.platformEmailPrimary &&
            emailUsage.activeProvider !== emailUsage.platformEmailPrimary ? (
              <span className="block mt-1 text-amber-800">
                Primary setting is <strong>{emailUsage.platformEmailPrimary}</strong> but another
                provider is active — check credentials or save mailco settings again.
              </span>
            ) : null}
          </p>
        ) : null}

        {emailUsage?.lastShopOrderEmail ? (
          <p className="text-sm mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-800">
            Last shop order email sent via <strong>{emailUsage.lastShopOrderEmail.provider}</strong>
            {emailUsage.lastShopOrderEmail.source ? (
              <>
                {' '}
                · source <code>{emailUsage.lastShopOrderEmail.source}</code>
              </>
            ) : null}
            {emailUsage.lastShopOrderEmail.sentAt ? (
              <>
                {' '}
                ·{' '}
                {new Date(emailUsage.lastShopOrderEmail.sentAt).toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </>
            ) : null}
            {emailUsage.lastShopOrderEmail.recipient ? (
              <>
                {' '}
                · To <code>{emailUsage.lastShopOrderEmail.recipient}</code>
              </>
            ) : null}
            {emailUsage.lastShopOrderEmail.orderId ? (
              <>
                {' '}
                · Order <code>{emailUsage.lastShopOrderEmail.orderId}</code>
              </>
            ) : null}
            {emailUsage.lastShopOrderEmail.provider !== 'mailco' ? (
              <span className="block mt-1 text-amber-800">
                Shop order mail should use mailco when platform mailco is configured. Merchant-owned
                Brevo/SMTP is no longer used for shop orders.
              </span>
            ) : null}
          </p>
        ) : null}

        {mailco && (
          <p className="text-sm mb-2">
            mailco:{' '}
            <span className={mailco.configured ? 'text-emerald-700 font-medium' : 'text-amber-700 font-medium'}>
              {mailco.configured ? 'Configured' : 'Not configured'}
            </span>
            {mailco.usingEnvFallback ? ' (using environment variables)' : null}
            {mailco.fromEmail ? (
              <>
                {' '}
                · From <code>{mailco.fromEmail}</code>
              </>
            ) : null}
          </p>
        )}

        {brevo && (
          <p className="text-sm mb-4">
            Brevo (fallback):{' '}
            <span className={brevo.configured ? 'text-emerald-700 font-medium' : 'text-amber-700 font-medium'}>
              {brevo.configured ? 'Configured' : 'Not configured'}
            </span>
            {brevo.usingEnvFallback ? ' (using environment variables)' : null}
            {brevo.fromEmail ? (
              <>
                {' '}
                · From <code>{brevo.fromEmail}</code>
              </>
            ) : null}
            {emailUsage?.platformEmailPrimary ? (
              <>
                {' '}
                · Primary setting: <strong>{emailUsage.platformEmailPrimary}</strong>
              </>
            ) : null}
          </p>
        )}

        {testEmailResult ? (
          <p
            className={`text-sm mb-4 rounded-lg border px-3 py-2 ${
              testEmailResult.ok
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-red-200 bg-red-50 text-red-900'
            }`}
          >
            {testEmailResult.provider} test: {testEmailResult.message}
          </p>
        ) : null}

        {emailUsage ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-500">Today ({emailUsage.period?.day})</p>
              <p className="text-2xl font-bold">{emailUsage.today ?? 0}</p>
            </div>
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-500">This month ({emailUsage.period?.month})</p>
              <p className="text-2xl font-bold">{emailUsage.thisMonth ?? 0}</p>
            </div>
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-500">All time (platform)</p>
              <p className="text-2xl font-bold">{emailUsage.allTime ?? 0}</p>
            </div>
          </div>
        ) : null}

        {emailUsage?.account?.planCredits != null ? (
          <p className="text-sm text-gray-600 mb-4">
            Brevo plan credits: <strong>{emailUsage.account.planCredits}</strong>
            {emailUsage.account.planType ? ` (${emailUsage.account.planType})` : ''}
          </p>
        ) : null}
        {emailUsage?.account?.error ? (
          <p className="text-sm text-amber-700 mb-4">{emailUsage.account.error}</p>
        ) : null}

        {emailUsage?.byType && emailUsage.byType.length > 0 ? (
          <div className="mb-6 overflow-x-auto">
            <h3 className="text-sm font-semibold mb-2">This month by type</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2">Sent</th>
                </tr>
              </thead>
              <tbody>
                {emailUsage.byType.map((row) => (
                  <tr key={row.emailType} className="border-b border-gray-100">
                    <td className="py-2 pr-4 font-mono text-xs">{row.emailType}</td>
                    <td className="py-2">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {emailUsage?.byMerchant && emailUsage.byMerchant.length > 0 ? (
          <div className="mb-6 overflow-x-auto">
            <h3 className="text-sm font-semibold mb-2">This month by merchant (top 50)</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="py-2 pr-4">Merchant</th>
                  <th className="py-2">Sent</th>
                </tr>
              </thead>
              <tbody>
                {emailUsage.byMerchant.map((row) => (
                  <tr key={row.merchantId || row.merchantName} className="border-b border-gray-100">
                    <td className="py-2 pr-4">{row.merchantName}</td>
                    <td className="py-2">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <form onSubmit={saveMailco} className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mb-8 pb-8 border-b border-gray-200">
          <h3 className="md:col-span-2 text-lg font-semibold">mailco (primary)</h3>
          <p className="md:col-span-2 text-sm text-gray-600">
            Shop orders, gift cards, newsletters, invites, password resets, inventory alerts, and
            platform mail are sent in <strong>raw HTML mode</strong> (like Brevo{' '}
            <code>htmlContent</code>) via{' '}
            <a className="text-blue-700 underline" href="https://ees.mailco.ch" target="_blank" rel="noreferrer">
              ees.mailco.ch
            </a>
            . The test button uses the same <code>EmailService.send</code> path as production.
            Verify your sending domain in mailco before going live.
          </p>
          <label className="block">
            <span className="text-sm font-medium">Primary provider</span>
            <select
              className="input mt-1"
              value={mailcoForm.emailPrimary}
              onChange={(e) =>
                setMailcoForm({
                  ...mailcoForm,
                  emailPrimary: e.target.value === 'brevo' ? 'brevo' : 'mailco',
                })
              }
            >
              <option value="mailco">mailco (default)</option>
              <option value="brevo">Brevo</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium">Template slug</span>
            <input
              className="input mt-1"
              value={mailcoForm.templateSlug}
              onChange={(e) => setMailcoForm({ ...mailcoForm, templateSlug: e.target.value })}
              placeholder="platform-transactional"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">From email</span>
            <input
              className="input mt-1"
              type="email"
              value={mailcoForm.fromEmail}
              onChange={(e) => setMailcoForm({ ...mailcoForm, fromEmail: e.target.value })}
              placeholder="noreply@yourdomain.com"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">From name</span>
            <input
              className="input mt-1"
              value={mailcoForm.fromName}
              onChange={(e) => setMailcoForm({ ...mailcoForm, fromName: e.target.value })}
              placeholder="Reborn"
            />
          </label>
          <label className="block md:col-span-2">
            <span className="text-sm font-medium">API base URL</span>
            <input
              className="input mt-1"
              value={mailcoForm.apiBase}
              onChange={(e) => setMailcoForm({ ...mailcoForm, apiBase: e.target.value })}
              placeholder="https://ees.mailco.ch/api/v1"
            />
          </label>
          <label className="block md:col-span-2">
            <span className="text-sm font-medium">
              mailco API key {mailco?.apiKeySet ? `(set: ${mailco.apiKeyMasked})` : '(not set)'}
            </span>
            <input
              className="input mt-1"
              type="password"
              autoComplete="new-password"
              value={mailcoForm.apiKey}
              onChange={(e) => setMailcoForm({ ...mailcoForm, apiKey: e.target.value })}
              placeholder={mailco?.apiKeySet ? 'Leave blank to keep current' : 'mail_live_…'}
            />
          </label>
          <div className="md:col-span-2 flex flex-wrap items-end gap-3">
            <button type="submit" className="btn btn-primary" disabled={savingMailco}>
              {savingMailco ? t('saving') : 'Save mailco settings'}
            </button>
            <label className="flex-1 min-w-[200px]">
              <span className="text-sm font-medium">{t('smtpTestTo')}</span>
              <input
                className="input mt-1"
                type="email"
                value={testEmailTo}
                onChange={(e) => setTestEmailTo(e.target.value)}
                placeholder="you@example.com"
              />
            </label>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={sendingMailcoTestEmail}
              onClick={() => sendPlatformTestEmail('mailco')}
            >
              {sendingMailcoTestEmail ? 'Sending…' : 'Send production-routing test'}
            </button>
          </div>
        </form>

        <form onSubmit={saveBrevo} className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
          <h3 className="md:col-span-2 text-lg font-semibold">Brevo (fallback)</h3>
          <label className="block">
            <span className="text-sm font-medium">From email</span>
            <input
              className="input mt-1"
              type="email"
              value={brevoForm.fromEmail}
              onChange={(e) => setBrevoForm({ ...brevoForm, fromEmail: e.target.value })}
              placeholder="noreply@yourdomain.com"
              required
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">From name</span>
            <input
              className="input mt-1"
              value={brevoForm.fromName}
              onChange={(e) => setBrevoForm({ ...brevoForm, fromName: e.target.value })}
              placeholder="Reborn"
            />
          </label>
          <label className="block md:col-span-2">
            <span className="text-sm font-medium">
              Brevo API key {brevo?.apiKeySet ? `(set: ${brevo.apiKeyMasked})` : '(not set)'}
            </span>
            <input
              className="input mt-1"
              type="password"
              autoComplete="new-password"
              value={brevoForm.apiKey}
              onChange={(e) => setBrevoForm({ ...brevoForm, apiKey: e.target.value })}
              placeholder={brevo?.apiKeySet ? 'Leave blank to keep current' : 'xkeysib-…'}
            />
          </label>
          <div className="md:col-span-2 flex flex-wrap items-end gap-3">
            <button type="submit" className="btn btn-primary" disabled={savingBrevo}>
              {savingBrevo ? 'Saving…' : 'Save Brevo settings'}
            </button>
            <label className="flex-1 min-w-[200px]">
              <span className="text-sm font-medium">Send test to</span>
              <input
                className="input mt-1"
                type="email"
                value={testEmailTo}
                onChange={(e) => setTestEmailTo(e.target.value)}
                placeholder="you@example.com"
              />
            </label>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={sendingBrevoTestEmail}
              onClick={() => sendPlatformTestEmail('brevo')}
            >
              {sendingBrevoTestEmail ? 'Sending…' : 'Send Brevo test'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
