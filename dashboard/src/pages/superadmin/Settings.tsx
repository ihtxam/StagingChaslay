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

type EmailUsageSummary = {
  period?: { day?: string; month?: string };
  today?: number;
  thisMonth?: number;
  allTime?: number;
  byType?: Array<{ emailType: string; count: number }>;
  byMerchant?: Array<{ merchantId: string | null; merchantName: string; count: number }>;
  brevo?: EmailSettings;
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
  const [emailUsage, setEmailUsage] = useState<EmailUsageSummary | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [testEmailTo, setTestEmailTo] = useState('');
  const [sendingTestEmail, setSendingTestEmail] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const [adyenRes, brevoRes] = await Promise.all([
        api.get('/superadmin/platform-settings/adyen'),
        api.get('/superadmin/platform-settings/brevo'),
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
      toast.success('Platform Adyen settings saved');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save Adyen settings');
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

  const sendPlatformTestEmail = async () => {
    const to = testEmailTo.trim();
    if (!to.includes('@')) {
      toast.error('Enter a valid email address');
      return;
    }
    setSendingTestEmail(true);
    try {
      await api.post('/superadmin/email/test', { to });
      toast.success('Test email sent');
      await refreshEmailUsage();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Test email failed');
    } finally {
      setSendingTestEmail(false);
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
        <h2 className="text-xl font-bold">Platform Adyen (subscription payments)</h2>
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
              {savingAdyen ? 'Saving…' : 'Save Adyen settings'}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold inline-flex items-center gap-2">
              <Mail className="h-5 w-5" aria-hidden />
              Platform email (Brevo)
            </h2>
            <p className="text-gray-600 mt-1">
              All merchant emails use this Brevo account when they choose &quot;Use platform email&quot; —
              newsletters, reservation confirmations, receipts, alerts, EOD reports, and more.
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

        {brevo && (
          <p className="text-sm mb-4">
            Status:{' '}
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
          </p>
        )}

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

        <form onSubmit={saveBrevo} className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
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
              disabled={sendingTestEmail}
              onClick={sendPlatformTestEmail}
            >
              {sendingTestEmail ? 'Sending…' : 'Send test'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
