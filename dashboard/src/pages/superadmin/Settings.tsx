import { FormEvent, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, X, Mail, RefreshCw } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';

type Plan = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  priceMonthly: string;
  priceYearly?: string | null;
  currency: string;
  editionId?: string | null;
  edition?: { id: string; name: string } | null;
  maxDevices: number;
  maxProducts?: number | null;
  maxPosPosts?: number;
  maxWaiterPosts?: number;
  maxStaff?: number;
  includedAddons?: {
    inventory?: boolean;
    signage?: boolean;
    kds?: boolean;
    ods?: boolean;
    signageScreenLimit?: number;
  } | null;
  features?: string[] | null;
  isActive: boolean;
  isPublic: boolean;
  sortOrder: number;
  trialDays: number;
};

type Edition = { id: string; name: string; businessCategory?: string };

type SubscriptionAddon = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  addonKey: string;
  priceMonthly: string;
  priceYearly?: string | null;
  currency: string;
  quantity: number;
  isActive: boolean;
  isPublic: boolean;
  sortOrder: number;
};

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

const emptyPlan = {
  name: '',
  slug: '',
  description: '',
  priceMonthly: '0',
  priceYearly: '',
  currency: 'CHF',
  editionId: '',
  maxDevices: 1,
  maxProducts: '',
  maxPosPosts: 0,
  maxWaiterPosts: 0,
  maxStaff: 0,
  includedInventory: false,
  includedSignage: false,
  includedKds: false,
  includedOds: false,
  signageScreenLimit: 2,
  featuresText: '',
  isActive: true,
  isPublic: true,
  sortOrder: 0,
  trialDays: 0,
};

const emptyAddon = {
  name: '',
  slug: '',
  description: '',
  addonKey: 'inventory',
  priceMonthly: '0',
  priceYearly: '',
  currency: 'CHF',
  quantity: 1,
  isActive: true,
  isPublic: true,
  sortOrder: 0,
};

export default function Settings() {
  const { t } = useI18n();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [editions, setEditions] = useState<Edition[]>([]);
  const [addons, setAddons] = useState<SubscriptionAddon[]>([]);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [savingPassword, setSavingPassword] = useState(false);
  const [adyen, setAdyen] = useState<AdyenSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingAdyen, setSavingAdyen] = useState(false);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState(emptyPlan);
  const [showAddonForm, setShowAddonForm] = useState(false);
  const [editingAddonId, setEditingAddonId] = useState<string | null>(null);
  const [addonForm, setAddonForm] = useState(emptyAddon);
  const [savingPlan, setSavingPlan] = useState(false);
  const [savingAddon, setSavingAddon] = useState(false);
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
      const [plansRes, editionsRes, addonsRes, adyenRes, brevoRes] = await Promise.all([
        api.get('/superadmin/plans'),
        api.get('/superadmin/editions'),
        api.get('/superadmin/addons'),
        api.get('/superadmin/platform-settings/adyen'),
        api.get('/superadmin/platform-settings/brevo'),
      ]);
      setPlans(plansRes.data.plans || []);
      setEditions(editionsRes.data.editions || []);
      setAddons(addonsRes.data.addons || []);
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

  const openCreate = () => {
    setEditingId(null);
    setPlanForm({ ...emptyPlan, sortOrder: (plans.length + 1) * 10 });
    setShowPlanForm(true);
  };

  const openEdit = (plan: Plan) => {
    setEditingId(plan.id);
    setPlanForm({
      name: plan.name,
      slug: plan.slug,
      description: plan.description || '',
      priceMonthly: String(plan.priceMonthly ?? '0'),
      priceYearly: plan.priceYearly != null ? String(plan.priceYearly) : '',
      currency: plan.currency || 'CHF',
      maxDevices: plan.maxDevices ?? 1,
      maxProducts: plan.maxProducts != null ? String(plan.maxProducts) : '',
      editionId: plan.editionId || plan.edition?.id || '',
      maxPosPosts: plan.maxPosPosts ?? 0,
      maxWaiterPosts: plan.maxWaiterPosts ?? 0,
      maxStaff: plan.maxStaff ?? 0,
      includedInventory: !!plan.includedAddons?.inventory,
      includedSignage: !!plan.includedAddons?.signage,
      includedKds: !!plan.includedAddons?.kds,
      includedOds: !!plan.includedAddons?.ods,
      signageScreenLimit: plan.includedAddons?.signageScreenLimit ?? 2,
      featuresText: (plan.features || []).join('\n'),
      isActive: plan.isActive,
      isPublic: plan.isPublic,
      sortOrder: plan.sortOrder ?? 0,
      trialDays: plan.trialDays ?? 0,
    });
    setShowPlanForm(true);
  };

  const savePlan = async (e: FormEvent) => {
    e.preventDefault();
    if (!planForm.name.trim()) {
      toast.error('License package name is required');
      return;
    }
    setSavingPlan(true);
    try {
      const payload = {
        name: planForm.name.trim(),
        slug: planForm.slug.trim() || planForm.name,
        description: planForm.description || null,
        priceMonthly: Number(planForm.priceMonthly) || 0,
        priceYearly: planForm.priceYearly === '' ? null : Number(planForm.priceYearly),
        currency: planForm.currency || 'CHF',
        maxDevices: Number(planForm.maxDevices) || 1,
        maxProducts: planForm.maxProducts === '' ? null : Number(planForm.maxProducts),
        editionId: planForm.editionId || null,
        maxPosPosts: Number(planForm.maxPosPosts) || 0,
        maxWaiterPosts: Number(planForm.maxWaiterPosts) || 0,
        maxStaff: Number(planForm.maxStaff) || 0,
        includedAddons: {
          inventory: planForm.includedInventory,
          signage: planForm.includedSignage,
          kds: planForm.includedKds,
          ods: planForm.includedOds,
          signageScreenLimit: planForm.includedSignage ? Number(planForm.signageScreenLimit) || 2 : undefined,
        },
        features: planForm.featuresText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        isActive: planForm.isActive,
        isPublic: planForm.isPublic,
        sortOrder: Number(planForm.sortOrder) || 0,
        trialDays: Number(planForm.trialDays) || 0,
      };
      if (editingId) {
        await api.put(`/superadmin/plans/${editingId}`, payload);
        toast.success('License package updated');
      } else {
        await api.post('/superadmin/plans', payload);
        toast.success('License package created');
      }
      setShowPlanForm(false);
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save license package');
    } finally {
      setSavingPlan(false);
    }
  };

  const deactivatePlan = async (plan: Plan) => {
    if (!confirm(`Deactivate package "${plan.name}"? Merchants will no longer see it.`)) return;
    try {
      await api.delete(`/superadmin/plans/${plan.id}`);
      toast.success('Package deactivated');
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to deactivate package');
    }
  };

  const openCreateAddon = () => {
    setEditingAddonId(null);
    setAddonForm({ ...emptyAddon, sortOrder: (addons.length + 1) * 10 });
    setShowAddonForm(true);
  };

  const openEditAddon = (addon: SubscriptionAddon) => {
    setEditingAddonId(addon.id);
    setAddonForm({
      name: addon.name,
      slug: addon.slug,
      description: addon.description || '',
      addonKey: addon.addonKey,
      priceMonthly: String(addon.priceMonthly ?? '0'),
      priceYearly: addon.priceYearly != null ? String(addon.priceYearly) : '',
      currency: addon.currency || 'CHF',
      quantity: addon.quantity ?? 1,
      isActive: addon.isActive,
      isPublic: addon.isPublic,
      sortOrder: addon.sortOrder ?? 0,
    });
    setShowAddonForm(true);
  };

  const saveAddon = async (e: FormEvent) => {
    e.preventDefault();
    setSavingAddon(true);
    try {
      const payload = {
        name: addonForm.name.trim(),
        slug: addonForm.slug.trim() || addonForm.name,
        description: addonForm.description || null,
        addonKey: addonForm.addonKey,
        priceMonthly: Number(addonForm.priceMonthly) || 0,
        priceYearly: addonForm.priceYearly === '' ? null : Number(addonForm.priceYearly),
        currency: addonForm.currency || 'CHF',
        quantity: Number(addonForm.quantity) || 1,
        isActive: addonForm.isActive,
        isPublic: addonForm.isPublic,
        sortOrder: Number(addonForm.sortOrder) || 0,
      };
      if (editingAddonId) {
        await api.put(`/superadmin/addons/${editingAddonId}`, payload);
        toast.success('Add-on updated');
      } else {
        await api.post('/superadmin/addons', payload);
        toast.success('Add-on created');
      }
      setShowAddonForm(false);
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save add-on');
    } finally {
      setSavingAddon(false);
    }
  };

  const deactivateAddon = async (addon: SubscriptionAddon) => {
    if (!confirm(`Deactivate add-on "${addon.name}"?`)) return;
    try {
      await api.delete(`/superadmin/addons/${addon.id}`);
      toast.success('Add-on deactivated');
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to deactivate add-on');
    }
  };

  const limitLabel = (n?: number) => (n === 0 || n == null ? '∞' : String(n));

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
        <h1 className="text-2xl font-bold">{t('changePassword')}</h1>
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
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold">Subscription packages</h1>
            <p className="text-gray-600 mt-1">
              Define sellable packages: POS version (features), station limits, bundled add-ons, and pricing.
              Merchants subscribe from their billing page.
            </p>
          </div>
          <button type="button" className="btn btn-primary flex items-center gap-2" onClick={openCreate}>
            <Plus size={16} /> New package
          </button>
        </div>

        <div className="table-scroll">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-3">Package</th>
                <th className="py-2 pr-3">POS version</th>
                <th className="py-2 pr-3">Monthly</th>
                <th className="py-2 pr-3">Limits</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Visible</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.id} className="border-b last:border-0">
                  <td className="py-3 pr-3">
                    <div className="font-medium">{plan.name}</div>
                    <div className="text-xs text-gray-500">{plan.slug}</div>
                  </td>
                  <td className="py-3 pr-3 text-xs">{plan.edition?.name || '—'}</td>
                  <td className="py-3 pr-3">
                    {Number(plan.priceMonthly).toFixed(2)} {plan.currency}
                  </td>
                  <td className="py-3 pr-3 text-xs text-gray-600">
                    POS {limitLabel(plan.maxPosPosts)} · Waiter {limitLabel(plan.maxWaiterPosts)} · Staff{' '}
                    {limitLabel(plan.maxStaff)}
                  </td>
                  <td className="py-3 pr-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        plan.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {plan.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-3 pr-3">{plan.isPublic ? 'Merchants' : 'Admin only'}</td>
                  <td className="py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="p-1.5 rounded hover:bg-gray-100"
                        onClick={() => openEdit(plan)}
                        title="Edit"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        className="p-1.5 rounded hover:bg-red-50 text-red-600"
                        onClick={() => void deactivatePlan(plan)}
                        title="Deactivate"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!plans.length && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-gray-500">
                    No packages yet. Create one or re-run seed to load defaults.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold">Subscription add-ons</h2>
            <p className="text-gray-600 mt-1 text-sm">
              Optional extras merchants can buy on top of their package (inventory, signage, extra stations, etc.).
            </p>
          </div>
          <button type="button" className="btn btn-secondary flex items-center gap-2" onClick={openCreateAddon}>
            <Plus size={16} /> New add-on
          </button>
        </div>
        <div className="table-scroll">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-3">Add-on</th>
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">Monthly</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {addons.map((addon) => (
                <tr key={addon.id} className="border-b last:border-0">
                  <td className="py-3 pr-3">
                    <div className="font-medium">{addon.name}</div>
                    <div className="text-xs text-gray-500">{addon.slug}</div>
                  </td>
                  <td className="py-3 pr-3 text-xs">{addon.addonKey}</td>
                  <td className="py-3 pr-3">
                    {Number(addon.priceMonthly).toFixed(2)} {addon.currency}
                  </td>
                  <td className="py-3 pr-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        addon.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {addon.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-3">
                    <div className="flex gap-2">
                      <button type="button" className="p-1.5 rounded hover:bg-gray-100" onClick={() => openEditAddon(addon)}>
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        className="p-1.5 rounded hover:bg-red-50 text-red-600"
                        onClick={() => void deactivateAddon(addon)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!addons.length && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-gray-500">
                    No add-ons yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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

      {showPlanForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">
                {editingId ? 'Edit package' : 'New package'}
              </h3>
              <button type="button" onClick={() => setShowPlanForm(false)} className="p-1 hover:bg-gray-100 rounded">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={savePlan} className="space-y-3">
              <label className="block">
                <span className="text-sm font-medium">Name</span>
                <input
                  className="input mt-1"
                  required
                  value={planForm.name}
                  onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Slug</span>
                <input
                  className="input mt-1"
                  placeholder="auto from name"
                  value={planForm.slug}
                  onChange={(e) => setPlanForm({ ...planForm, slug: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Description</span>
                <textarea
                  className="input mt-1"
                  rows={2}
                  value={planForm.description}
                  onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">POS version (features)</span>
                <select
                  className="input mt-1"
                  value={planForm.editionId}
                  onChange={(e) => setPlanForm({ ...planForm, editionId: e.target.value })}
                >
                  <option value="">— None —</option>
                  {editions.map((ed) => (
                    <option key={ed.id} value={ed.id}>
                      {ed.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-3 gap-3">
                <label className="block">
                  <span className="text-sm font-medium">Monthly</span>
                  <input
                    className="input mt-1"
                    type="number"
                    min="0"
                    step="0.01"
                    value={planForm.priceMonthly}
                    onChange={(e) => setPlanForm({ ...planForm, priceMonthly: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Yearly</span>
                  <input
                    className="input mt-1"
                    type="number"
                    min="0"
                    step="0.01"
                    value={planForm.priceYearly}
                    onChange={(e) => setPlanForm({ ...planForm, priceYearly: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Currency</span>
                  <input
                    className="input mt-1"
                    value={planForm.currency}
                    onChange={(e) => setPlanForm({ ...planForm, currency: e.target.value })}
                  />
                </label>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <label className="block">
                  <span className="text-sm font-medium">Max devices</span>
                  <input
                    className="input mt-1"
                    type="number"
                    min="1"
                    value={planForm.maxDevices}
                    onChange={(e) => setPlanForm({ ...planForm, maxDevices: Number(e.target.value) })}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Max products</span>
                  <input
                    className="input mt-1"
                    type="number"
                    min="0"
                    placeholder="unlimited"
                    value={planForm.maxProducts}
                    onChange={(e) => setPlanForm({ ...planForm, maxProducts: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Sort order</span>
                  <input
                    className="input mt-1"
                    type="number"
                    value={planForm.sortOrder}
                    onChange={(e) => setPlanForm({ ...planForm, sortOrder: Number(e.target.value) })}
                  />
                </label>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <label className="block">
                  <span className="text-sm font-medium">Max POS stations (0 = ∞)</span>
                  <input
                    className="input mt-1"
                    type="number"
                    min="0"
                    value={planForm.maxPosPosts}
                    onChange={(e) => setPlanForm({ ...planForm, maxPosPosts: Number(e.target.value) })}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Max waiter devices (0 = ∞)</span>
                  <input
                    className="input mt-1"
                    type="number"
                    min="0"
                    value={planForm.maxWaiterPosts}
                    onChange={(e) => setPlanForm({ ...planForm, maxWaiterPosts: Number(e.target.value) })}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Max staff users (0 = ∞)</span>
                  <input
                    className="input mt-1"
                    type="number"
                    min="0"
                    value={planForm.maxStaff}
                    onChange={(e) => setPlanForm({ ...planForm, maxStaff: Number(e.target.value) })}
                  />
                </label>
              </div>
              <div>
                <span className="text-sm font-medium">Bundled add-ons</span>
                <div className="mt-2 flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={planForm.includedInventory}
                      onChange={(e) => setPlanForm({ ...planForm, includedInventory: e.target.checked })}
                    />
                    Inventory
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={planForm.includedSignage}
                      onChange={(e) => setPlanForm({ ...planForm, includedSignage: e.target.checked })}
                    />
                    Signage
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={planForm.includedKds}
                      onChange={(e) => setPlanForm({ ...planForm, includedKds: e.target.checked })}
                    />
                    KDS
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={planForm.includedOds}
                      onChange={(e) => setPlanForm({ ...planForm, includedOds: e.target.checked })}
                    />
                    ODS
                  </label>
                  {planForm.includedSignage ? (
                    <label className="flex items-center gap-2">
                      Screens
                      <input
                        className="input w-16"
                        type="number"
                        min="1"
                        value={planForm.signageScreenLimit}
                        onChange={(e) =>
                          setPlanForm({ ...planForm, signageScreenLimit: Number(e.target.value) })
                        }
                      />
                    </label>
                  ) : null}
                </div>
              </div>
              <label className="block">
                <span className="text-sm font-medium">Marketing bullets (one per line)</span>
                <textarea
                  className="input mt-1"
                  rows={3}
                  value={planForm.featuresText}
                  onChange={(e) => setPlanForm({ ...planForm, featuresText: e.target.value })}
                />
              </label>
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={planForm.isActive}
                    onChange={(e) => setPlanForm({ ...planForm, isActive: e.target.checked })}
                  />
                  Active
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={planForm.isPublic}
                    onChange={(e) => setPlanForm({ ...planForm, isPublic: e.target.checked })}
                  />
                  Visible to merchants
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn" onClick={() => setShowPlanForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingPlan}>
                  {savingPlan ? 'Saving…' : 'Save package'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddonForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">{editingAddonId ? 'Edit add-on' : 'New add-on'}</h3>
              <button type="button" onClick={() => setShowAddonForm(false)} className="p-1 hover:bg-gray-100 rounded">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={saveAddon} className="space-y-3">
              <label className="block">
                <span className="text-sm font-medium">Name</span>
                <input className="input mt-1" required value={addonForm.name} onChange={(e) => setAddonForm({ ...addonForm, name: e.target.value })} />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Type</span>
                <select className="input mt-1" value={addonForm.addonKey} onChange={(e) => setAddonForm({ ...addonForm, addonKey: e.target.value })}>
                  <option value="inventory">Inventory & recipes</option>
                  <option value="signage">Digital signage</option>
                  <option value="kds">Kitchen display (KDS)</option>
                  <option value="ods">Order display (ODS)</option>
                  <option value="extra_pos_post">Extra POS station</option>
                  <option value="extra_waiter_post">Extra waiter device</option>
                  <option value="extra_staff">Extra staff user</option>
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium">Description</span>
                <textarea className="input mt-1" rows={2} value={addonForm.description} onChange={(e) => setAddonForm({ ...addonForm, description: e.target.value })} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm font-medium">Monthly price</span>
                  <input className="input mt-1" type="number" min="0" step="0.01" value={addonForm.priceMonthly} onChange={(e) => setAddonForm({ ...addonForm, priceMonthly: e.target.value })} />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Quantity bump</span>
                  <input className="input mt-1" type="number" min="1" value={addonForm.quantity} onChange={(e) => setAddonForm({ ...addonForm, quantity: Number(e.target.value) })} />
                </label>
              </div>
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={addonForm.isActive} onChange={(e) => setAddonForm({ ...addonForm, isActive: e.target.checked })} />
                  Active
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={addonForm.isPublic} onChange={(e) => setAddonForm({ ...addonForm, isPublic: e.target.checked })} />
                  Visible to merchants
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn" onClick={() => setShowAddonForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={savingAddon}>{savingAddon ? 'Saving…' : 'Save add-on'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
