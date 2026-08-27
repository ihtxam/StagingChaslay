import { useCallback, useEffect, useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Ban,
  Building2,
  Copy,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  Package,
  Plus,
  RefreshCw,
  Store,
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import api from '@/lib/api';
import { I18nProvider, useI18n, type Locale } from '@/lib/i18n';
import { APP_PANEL_TITLE } from '@/lib/brand';
import PlatformMessagesProvider, {
  PlatformStatusBannerSlot,
} from '@/components/platform/PlatformMessagesProvider';
import { useAuthStore } from '@/store/auth';
import {
  ALL_EDITION_FEATURES,
  EDITION_FEATURE_GROUPS,
  type EditionFeatureKey,
} from '@/lib/edition-features';
import EditionFeatureChecklist from '@/components/EditionFeatureChecklist';
import SupportInbox from '../shared/SupportInbox';
import ResellerPackages from './Packages';

function Overview() {
  const { t } = useI18n();
  const [overview, setOverview] = useState({
    merchantCount: 0,
    activeCount: 0,
    suspendedCount: 0,
    licenseSeats: 0,
    seatsUsed: 0,
    seatsRemaining: 0,
  });
  useEffect(() => {
    api
      .get('/reseller/overview')
      .then((r) => setOverview({ ...overview, ...(r.data.overview || {}) }))
      .catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="max-w-4xl space-y-4">
      <h1 className="text-xl font-bold">{t('resellerDashboard')}</h1>
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="card p-4">
          <p className="text-xs text-stone-500">{t('merchants')}</p>
          <p className="text-2xl font-bold">{overview.merchantCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-stone-500">{t('resellerActiveShort')}</p>
          <p className="text-2xl font-bold">{overview.activeCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-stone-500">{t('resellerSuspendedShort')}</p>
          <p className="text-2xl font-bold">{overview.suspendedCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-stone-500">{t('resellerLicenseSeats')}</p>
          <p className="text-2xl font-bold">
            {overview.seatsUsed}/{overview.licenseSeats}
          </p>
          <p className="text-xs text-stone-500 mt-1">
            {overview.seatsRemaining} {t('resellerRemaining')}
          </p>
        </div>
      </div>
    </div>
  );
}

function MerchantsPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const startImpersonation = useAuthStore((s) => s.startImpersonation);
  const [merchants, setMerchants] = useState<any[]>([]);
  const [editions, setEditions] = useState<any[]>([]);
  const [pool, setPool] = useState({ licenseSeats: 0, seatsUsed: 0, seatsRemaining: 0 });
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [purgeFor, setPurgeFor] = useState<{ id: string; name: string } | null>(null);
  const [purgeConfirm, setPurgeConfirm] = useState('');
  const [deleteCustomersToo, setDeleteCustomersToo] = useState(false);
  const [purgingSales, setPurgingSales] = useState(false);
  const [form, setForm] = useState({
    businessName: '',
    email: '',
    password: '',
    phone: '',
    city: '',
    address: '',
    country: 'CH',
    editionId: '',
    businessCategory: 'restaurant' as 'retail' | 'restaurant',
    shopEnabled: true,
    deviceSeats: 0,
    licenseType: 'yearly' as 'trial' | 'yearly' | 'custom',
    customDays: 365,
    maxPosPosts: 1,
    maxWaiterPosts: 0,
    inventoryAddonEnabled: false,
    signageAddonEnabled: false,
    signageScreenLimit: 2,
    kdsAddonEnabled: false,
    odsAddonEnabled: false,
    storekeeperAddonEnabled: false,
  });
  const [limitsFor, setLimitsFor] = useState<{
    id: string;
    name: string;
    maxPosPosts: number;
    maxWaiterPosts: number;
    inventoryAddonEnabled: boolean;
    signageAddonEnabled: boolean;
    signageScreenLimit: number;
    kdsAddonEnabled: boolean;
    odsAddonEnabled: boolean;
    storekeeperAddonEnabled: boolean;
  } | null>(null);
  const [planFor, setPlanFor] = useState<{
    id: string;
    name: string;
    editionId: string;
    planBillingPaid: boolean;
    subscriptionPlan: string;
  } | null>(null);
  const [subscriptionPlans, setSubscriptionPlans] = useState<
    Array<{ id: string; slug: string; name: string; isActive?: boolean }>
  >([
    { id: 'free', slug: 'free', name: 'Free' },
    { id: 'starter', slug: 'starter', name: 'Starter' },
    { id: 'professional', slug: 'professional', name: 'Professional' },
    { id: 'enterprise', slug: 'enterprise', name: 'Enterprise' },
  ]);
  const [savingLimits, setSavingLimits] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [m, e, p, pl] = await Promise.all([
        api.get('/reseller/merchants', { params: { search: search || undefined } }),
        api.get('/reseller/editions'),
        api.get('/reseller/licenses/pool'),
        api.get('/reseller/plans'),
      ]);
      setMerchants(m.data.merchants || []);
      setEditions(e.data.editions || []);
      setPool(p.data.pool || pool);
      const activePlans = (pl.data.plans || []).filter(
        (plan: { isActive?: boolean }) => plan.isActive !== false
      );
      if (activePlans.length) setSubscriptionPlans(activePlans);
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('resellerLoadFailed'));
    }
  }, [search, t]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const storeName = form.businessName.trim();
    if (!storeName) {
      toast.error(t('resellerStoreNameRequired'));
      return;
    }
    if (!form.editionId) {
      toast.error(t('posVersionSelect'));
      return;
    }
    const seats = Number(form.deviceSeats) || 0;
    if (seats > pool.seatsRemaining) {
      toast.error(
        `${t('resellerInsufficientSeats')} (${seats} > ${pool.seatsRemaining})`
      );
      return;
    }
    setSaving(true);
    try {
      await api.post('/reseller/merchants', {
        ...form,
        businessName: storeName,
        password: form.password || undefined,
        deviceSeats: seats,
        customDays: form.licenseType === 'custom' ? Number(form.customDays) : undefined,
        maxPosPosts: Number(form.maxPosPosts) || 0,
        maxWaiterPosts: Number(form.maxWaiterPosts) || 0,
      });
      toast.success(t('resellerMerchantCreated'));
      setShowCreate(false);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('resellerSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const setMerchantStatus = async (
    m: { id: string; name: string; status: string },
    next: 'suspended' | 'active'
  ) => {
    const confirmKey = next === 'suspended' ? 'resellerSuspendConfirm' : 'resellerReactivateConfirm';
    if (!window.confirm(t(confirmKey).replace('{name}', m.name))) return;
    setStatusBusyId(m.id);
    try {
      const path = next === 'suspended' ? 'suspend' : 'reactivate';
      await api.post(`/reseller/merchants/${m.id}/${path}`);
      toast.success(
        next === 'suspended' ? t('resellerMerchantSuspended') : t('resellerMerchantReactivated')
      );
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('resellerSaveFailed'));
    } finally {
      setStatusBusyId(null);
    }
  };

  const openPanel = async (m: any) => {
    if (m.status === 'suspended' || m.status === 'expired') {
      toast.error(`Cannot open panel while merchant is ${m.status}`);
      return;
    }
    try {
      const res = await api.post(`/reseller/merchants/${m.id}/impersonate`);
      const { token, merchant } = res.data;
      startImpersonation(token, {
        id: merchant.id,
        email: merchant.email,
        name: merchant.name,
        role: 'merchant',
        merchantId: merchant.id,
        isOwner: true,
        impersonatedBy: 'reseller',
        inventoryAddonEnabled: !!(merchant.inventoryAddonEnabled || merchant.inventoryEnabled),
        signageAddonEnabled: !!(merchant.signageAddonEnabled || merchant.signageEnabled),
        kdsAddonEnabled: !!(merchant.kdsAddonEnabled || merchant.kdsEnabled),
        odsAddonEnabled: !!(merchant.odsAddonEnabled || merchant.odsEnabled),
        storekeeperAddonEnabled: !!merchant.storekeeperAddonEnabled,
      });
      toast.success(t('resellerOpenMerchant'));
      navigate('/merchant');
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('resellerSaveFailed'));
    }
  };

  const savePosLimits = async () => {
    if (!limitsFor) return;
    setSavingLimits(true);
    try {
      await api.put(`/reseller/merchants/${limitsFor.id}/pos-limits`, {
        maxPosPosts: Number(limitsFor.maxPosPosts) || 0,
        maxWaiterPosts: Number(limitsFor.maxWaiterPosts) || 0,
        inventoryAddonEnabled: !!limitsFor.inventoryAddonEnabled,
        signageAddonEnabled: !!limitsFor.signageAddonEnabled,
        signageScreenLimit: Number(limitsFor.signageScreenLimit) || 2,
        kdsAddonEnabled: !!limitsFor.kdsAddonEnabled,
        odsAddonEnabled: !!limitsFor.odsAddonEnabled,
        storekeeperAddonEnabled: !!limitsFor.storekeeperAddonEnabled,
      });
      toast.success(t('posPostsLimitsSaved'));
      setLimitsFor(null);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('resellerSaveFailed'));
    } finally {
      setSavingLimits(false);
    }
  };

  const saveMerchantPlan = async () => {
    if (!planFor) return;
    if (!planFor.editionId) {
      toast.error(t('posVersionSelect'));
      return;
    }
    if (!planFor.subscriptionPlan) {
      toast.error(t('merchantSubscriptionPlanRequired'));
      return;
    }
    setSavingPlan(true);
    try {
      await api.patch(`/reseller/merchants/${planFor.id}/plan`, {
        editionId: planFor.editionId,
        planBillingPaid: !!planFor.planBillingPaid,
        subscriptionPlan: planFor.subscriptionPlan,
      });
      toast.success(t('merchantPlanSaved'));
      setPlanFor(null);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('merchantPlanSaveFailed'));
    } finally {
      setSavingPlan(false);
    }
  };

  const openPurge = (m: { id: string; name: string }) => {
    setPurgeFor({ id: m.id, name: m.name });
    setPurgeConfirm('');
    setDeleteCustomersToo(false);
  };

  const closePurge = () => {
    setPurgeFor(null);
    setPurgeConfirm('');
    setDeleteCustomersToo(false);
  };

  const handlePurgeSalesData = async () => {
    if (!purgeFor) return;
    if (purgeConfirm !== 'DELETE ALL SALES') {
      toast.error(t('resellerPurgeConfirmType'));
      return;
    }
    if (
      !window.confirm(
        t('resellerPurgeConfirmAsk').replace('{name}', purgeFor.name)
      )
    ) {
      return;
    }
    setPurgingSales(true);
    try {
      const res = await api.post(`/reseller/merchants/${purgeFor.id}/purge-sales-data`, {
        confirm: 'DELETE ALL SALES',
        deleteCustomers: deleteCustomersToo,
      });
      const d = res.data?.result?.deleted;
      toast.success(
        d
          ? t('resellerPurgeDone')
              .replace('{orders}', String(d.orders ?? 0))
              .replace('{held}', String(d.heldOrders ?? 0))
              .replace('{reports}', String(d.dailyReports ?? 0))
          : res.data?.message || t('resellerPurgeDoneSimple')
      );
      closePurge();
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('resellerPurgeFailed'));
    } finally {
      setPurgingSales(false);
    }
  };

  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">{t('resellerStores')}</h1>
          <p className="text-xs text-stone-500 mt-1">
            {t('resellerLicenseSeats')}: {pool.seatsUsed}/{pool.licenseSeats} (
            {pool.seatsRemaining} {t('resellerRemaining')})
          </p>
          <p className="text-xs text-stone-500 mt-1">{t('resellerPurgeHint')}</p>
        </div>
        <button type="button" className="btn-primary text-sm" onClick={() => setShowCreate(true)}>
          {t('resellerAddStore')}
        </button>
      </div>
      <input
        className="input max-w-sm"
        placeholder={t('search')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {showCreate && (
        <form onSubmit={create} className="card p-4 grid sm:grid-cols-2 gap-3">
          <label className="text-sm">
            {t('resellerStoreName')} *
            <input
              className="input mt-1"
              required
              value={form.businessName}
              onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            {t('email')} *
            <input
              className="input mt-1"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            {t('password')} ({t('optional')})
            <input
              className="input mt-1"
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            {t('category')}
            <select
              className="input mt-1"
              value={form.businessCategory}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  businessCategory: e.target.value as 'retail' | 'restaurant',
                  editionId:
                    f.editionId &&
                    editions.find((ed) => ed.id === f.editionId)?.businessCategory &&
                    editions.find((ed) => ed.id === f.editionId)?.businessCategory !== 'both' &&
                    editions.find((ed) => ed.id === f.editionId)?.businessCategory !== e.target.value
                      ? ''
                      : f.editionId,
                }))
              }
            >
              <option value="restaurant">{t('restaurant')}</option>
              <option value="retail">{t('retail')}</option>
            </select>
          </label>
          <label className="text-sm sm:col-span-2">
            {t('posVersion')} *
            <select
              className="input mt-1"
              required
              value={form.editionId}
              onChange={(e) => setForm((f) => ({ ...f, editionId: e.target.value }))}
            >
              <option value="">{t('posVersionSelect')}</option>
              {editions
                .filter(
                  (ed) =>
                    ed.businessCategory === 'both' || ed.businessCategory === form.businessCategory
                )
                .map((ed) => (
                <option key={ed.id} value={ed.id}>
                  {ed.name} ({ed.ownerType})
                </option>
              ))}
            </select>
          </label>

          <div className="sm:col-span-2 border rounded-lg p-3 bg-stone-50 grid sm:grid-cols-3 gap-3">
            <label className="text-sm">
              {t('deviceLicenseSeats')}
              <input
                type="number"
                min={0}
                max={20}
                className="input mt-1"
                value={form.deviceSeats}
                onChange={(e) => setForm((f) => ({ ...f, deviceSeats: Number(e.target.value) || 0 }))}
              />
            </label>
            <label className="text-sm">
              {t('licenseType')}
              <select
                className="input mt-1"
                value={form.licenseType}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    licenseType: e.target.value as 'trial' | 'yearly' | 'custom',
                  }))
                }
              >
                <option value="trial">{t('licenseTrial')}</option>
                <option value="yearly">{t('licenseYearly')}</option>
                <option value="custom">{t('licenseCustom')}</option>
              </select>
            </label>
            {form.licenseType === 'custom' && (
              <label className="text-sm">
                {t('days')}
                <input
                  type="number"
                  min={1}
                  className="input mt-1"
                  value={form.customDays}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, customDays: Number(e.target.value) || 1 }))
                  }
                />
              </label>
            )}
            <p className="sm:col-span-3 text-xs text-stone-500">{t('deviceLicenseSeatsHint')}</p>
          </div>

          <div className="sm:col-span-2 border rounded-lg p-3 bg-stone-50 grid sm:grid-cols-2 gap-3">
            <label className="text-sm">
              {t('posPostsMaxMain')}
              <input
                type="number"
                min={0}
                max={99}
                className="input mt-1"
                value={form.maxPosPosts}
                onChange={(e) =>
                  setForm((f) => ({ ...f, maxPosPosts: Number(e.target.value) || 0 }))
                }
              />
            </label>
            <label className="text-sm">
              {t('posPostsMaxWaiter')}
              <input
                type="number"
                min={0}
                max={99}
                className="input mt-1"
                value={form.maxWaiterPosts}
                onChange={(e) =>
                  setForm((f) => ({ ...f, maxWaiterPosts: Number(e.target.value) || 0 }))
                }
              />
            </label>
            <p className="sm:col-span-2 text-xs text-stone-500">{t('posPostsHint')}</p>
            <label className="sm:col-span-2 flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={!!form.inventoryAddonEnabled}
                onChange={(e) =>
                  setForm((f) => ({ ...f, inventoryAddonEnabled: e.target.checked }))
                }
              />
              <span>
                <span className="font-medium block">{t('invTitle')}</span>
                <span className="text-xs text-stone-500">{t('invAddonReadOnly')}</span>
              </span>
            </label>
            <label className="sm:col-span-2 flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={!!form.storekeeperAddonEnabled}
                onChange={(e) =>
                  setForm((f) => ({ ...f, storekeeperAddonEnabled: e.target.checked }))
                }
              />
              <span>
                <span className="font-medium block">{t('storekeeperTitle')}</span>
                <span className="text-xs text-stone-500">{t('storekeeperAddonReadOnly')}</span>
              </span>
            </label>
            <label className="sm:col-span-2 flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={!!form.signageAddonEnabled}
                onChange={(e) =>
                  setForm((f) => ({ ...f, signageAddonEnabled: e.target.checked }))
                }
              />
              <span>
                <span className="font-medium block">{t('signageTitle')}</span>
                <span className="text-xs text-stone-500">{t('signageAddonReadOnly')}</span>
              </span>
            </label>
            <label className="sm:col-span-2 flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={!!form.kdsAddonEnabled}
                onChange={(e) => setForm((f) => ({ ...f, kdsAddonEnabled: e.target.checked }))}
              />
              <span>
                <span className="font-medium block">{t('kdsSettingsTitle')}</span>
                <span className="text-xs text-stone-500">{t('kdsAddonReadOnly')}</span>
              </span>
            </label>
            <label className="sm:col-span-2 flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={!!form.odsAddonEnabled}
                onChange={(e) => setForm((f) => ({ ...f, odsAddonEnabled: e.target.checked }))}
              />
              <span>
                <span className="font-medium block">{t('odsSettingsTitle')}</span>
                <span className="text-xs text-stone-500">{t('odsAddonReadOnly')}</span>
              </span>
            </label>
            <label className="text-sm">
              {t('signageScreenLimit')}
              <input
                type="number"
                min={1}
                max={99}
                className="input mt-1"
                value={form.signageScreenLimit}
                onChange={(e) =>
                  setForm((f) => ({ ...f, signageScreenLimit: Number(e.target.value) || 2 }))
                }
              />
            </label>
          </div>

          <div className="sm:col-span-2 flex justify-end gap-2">
            <button type="button" className="btn-secondary text-sm" onClick={() => setShowCreate(false)}>
              {t('cancel')}
            </button>
            <button type="submit" className="btn-primary text-sm" disabled={saving}>
              {saving ? '?' : t('save')}
            </button>
          </div>
        </form>
      )}

      <div className="card !p-0 table-scroll">
        <table className="w-full text-sm min-w-[560px]">
          <thead className="bg-stone-50 text-left">
            <tr>
              <th className="px-3 py-2">{t('resellerStores')}</th>
              <th className="px-3 py-2">{t('email')}</th>
              <th className="px-3 py-2">{t('status')}</th>
              <th className="px-3 py-2">{t('posVersion')}</th>
              <th className="px-3 py-2">{t('merchantPlanBilling')}</th>
              <th className="px-3 py-2">{t('invTitle')}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {merchants.map((m) => (
              <tr key={m.id} className="border-t">
                <td className="px-3 py-2 font-medium">
                  <span className="cell-truncate block" title={m.name}>
                    {m.name}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className="cell-truncate block" title={m.email}>
                    {m.email}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      m.status === 'suspended'
                        ? 'bg-red-100 text-red-800'
                        : m.status === 'expired'
                          ? 'bg-stone-200 text-stone-700'
                          : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {m.status === 'suspended' ? t('suspended') : m.status}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className="text-xs text-stone-700" title={m.editionName || undefined}>
                    {m.editionName || '—'}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      m.planBillingPaid !== false
                        ? 'bg-green-100 text-green-800'
                        : 'bg-amber-100 text-amber-900'
                    }`}
                  >
                    {m.planBillingPaid !== false ? t('invoiceStatusPaid') : t('invoiceStatusUnpaid')}
                  </span>
                </td>
                <td className="px-3 py-2">
                  {m.inventoryAddonEnabled === true ? (
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                      On
                    </span>
                  ) : (
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600">
                      Off
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right space-x-3 whitespace-nowrap">
                  <button
                    type="button"
                    className="text-teal-700 hover:underline"
                    onClick={() =>
                      setPlanFor({
                        id: m.id,
                        name: m.name,
                        editionId: m.editionId || '',
                        planBillingPaid: m.planBillingPaid !== false,
                        subscriptionPlan: m.subscriptionPlan || 'starter',
                      })
                    }
                  >
                    {t('merchantPlanManage')}
                  </button>
                  <button
                    type="button"
                    className="text-stone-700 hover:underline"
                    onClick={() =>
                      setLimitsFor({
                        id: m.id,
                        name: m.name,
                        maxPosPosts: Math.max(0, Number(m.maxPosPosts) || 0),
                        maxWaiterPosts: Math.max(0, Number(m.maxWaiterPosts) || 0),
                        inventoryAddonEnabled: m.inventoryAddonEnabled === true,
                        signageAddonEnabled: m.signageAddonEnabled === true,
                        signageScreenLimit: Math.max(1, Number(m.signageScreenLimit) || 2),
                        kdsAddonEnabled: m.kdsAddonEnabled === true,
                        odsAddonEnabled: m.odsAddonEnabled === true,
                        storekeeperAddonEnabled: m.storekeeperAddonEnabled === true,
                      })
                    }
                  >
                    {t('posPostsLimits')}
                  </button>
                  <button
                    type="button"
                    className="text-teal-700 hover:underline disabled:opacity-40 disabled:no-underline"
                    disabled={m.status === 'suspended' || m.status === 'expired'}
                    onClick={() => void openPanel(m)}
                  >
                    {t('resellerOpenMerchant')}
                  </button>
                  {m.status === 'suspended' ? (
                    <button
                      type="button"
                      className="text-emerald-700 hover:underline disabled:opacity-40"
                      disabled={statusBusyId === m.id}
                      onClick={() => void setMerchantStatus(m, 'active')}
                    >
                      {t('reactivate')}
                    </button>
                  ) : m.status !== 'expired' ? (
                    <button
                      type="button"
                      className="text-amber-700 hover:underline disabled:opacity-40"
                      disabled={statusBusyId === m.id}
                      onClick={() => void setMerchantStatus(m, 'suspended')}
                    >
                      {t('suspend')}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="text-rose-700 hover:underline"
                    onClick={() => openPurge(m)}
                  >
                    {t('resellerPurgeSales')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {limitsFor ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl border bg-white p-5 shadow-xl space-y-3">
            <h2 className="text-lg font-bold">{t('posPostsLimits')}</h2>
            <p className="text-sm text-stone-600">{limitsFor.name}</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                {t('posPostsMaxMain')}
                <input
                  type="number"
                  min={0}
                  max={99}
                  className="input mt-1"
                  value={limitsFor.maxPosPosts}
                  onChange={(e) =>
                    setLimitsFor({
                      ...limitsFor,
                      maxPosPosts: Number(e.target.value) || 0,
                    })
                  }
                />
              </label>
              <label className="text-sm">
                {t('posPostsMaxWaiter')}
                <input
                  type="number"
                  min={0}
                  max={99}
                  className="input mt-1"
                  value={limitsFor.maxWaiterPosts}
                  onChange={(e) =>
                    setLimitsFor({
                      ...limitsFor,
                      maxWaiterPosts: Number(e.target.value) || 0,
                    })
                  }
                />
              </label>
            </div>
            <p className="text-xs text-stone-500">{t('posPostsHint')}</p>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={!!limitsFor.inventoryAddonEnabled}
                onChange={(e) =>
                  setLimitsFor({ ...limitsFor, inventoryAddonEnabled: e.target.checked })
                }
              />
              <span>
                <span className="font-medium block">{t('invTitle')}</span>
                <span className="text-xs text-stone-500">{t('invSettingsHint')}</span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={!!limitsFor.storekeeperAddonEnabled}
                onChange={(e) =>
                  setLimitsFor({ ...limitsFor, storekeeperAddonEnabled: e.target.checked })
                }
              />
              <span>
                <span className="font-medium block">{t('storekeeperTitle')}</span>
                <span className="text-xs text-stone-500">{t('storekeeperAddonReadOnly')}</span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={!!limitsFor.signageAddonEnabled}
                onChange={(e) =>
                  setLimitsFor({ ...limitsFor, signageAddonEnabled: e.target.checked })
                }
              />
              <span>
                <span className="font-medium block">{t('signageTitle')}</span>
                <span className="text-xs text-stone-500">{t('signageAddonReadOnly')}</span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={!!limitsFor.kdsAddonEnabled}
                onChange={(e) =>
                  setLimitsFor({ ...limitsFor, kdsAddonEnabled: e.target.checked })
                }
              />
              <span>
                <span className="font-medium block">{t('kdsSettingsTitle')}</span>
                <span className="text-xs text-stone-500">{t('kdsAddonReadOnly')}</span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={!!limitsFor.odsAddonEnabled}
                onChange={(e) =>
                  setLimitsFor({ ...limitsFor, odsAddonEnabled: e.target.checked })
                }
              />
              <span>
                <span className="font-medium block">{t('odsSettingsTitle')}</span>
                <span className="text-xs text-stone-500">{t('odsAddonReadOnly')}</span>
              </span>
            </label>
            <label className="text-sm">
              {t('signageScreenLimit')}
              <input
                type="number"
                min={1}
                max={99}
                className="input mt-1"
                value={limitsFor.signageScreenLimit}
                onChange={(e) =>
                  setLimitsFor({
                    ...limitsFor,
                    signageScreenLimit: Number(e.target.value) || 2,
                  })
                }
              />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary text-sm" onClick={() => setLimitsFor(null)}>
                {t('cancel')}
              </button>
              <button
                type="button"
                className="btn-primary text-sm"
                disabled={savingLimits}
                onClick={() => void savePosLimits()}
              >
                {savingLimits ? '…' : t('save')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {planFor ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl border bg-white p-5 shadow-xl space-y-3">
            <h2 className="text-lg font-bold">{t('merchantPlanManage')}</h2>
            <p className="text-sm text-stone-600">{planFor.name}</p>
            <label className="block text-sm">
              {t('posVersion')}
              <select
                className="input mt-1"
                value={planFor.editionId}
                onChange={(e) => setPlanFor({ ...planFor, editionId: e.target.value })}
              >
                <option value="">{t('posVersionSelect')}</option>
                {editions.map((ed) => (
                  <option key={ed.id} value={ed.id}>
                    {ed.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              {t('subscriptionLicense')}
              <select
                className="input mt-1"
                value={planFor.subscriptionPlan}
                onChange={(e) => setPlanFor({ ...planFor, subscriptionPlan: e.target.value })}
              >
                <option value="">{t('merchantSubscriptionPlanRequired')}</option>
                {subscriptionPlans.map((plan) => (
                  <option key={plan.id || plan.slug} value={plan.slug}>
                    {plan.name}
                  </option>
                ))}
              </select>
              <span className="text-xs text-stone-500 mt-1 block">{t('merchantSubscriptionPlanHint')}</span>
            </label>
            <label className="block text-sm">
              {t('merchantPlanBilling')}
              <select
                className="input mt-1"
                value={planFor.planBillingPaid ? 'paid' : 'unpaid'}
                onChange={(e) =>
                  setPlanFor({ ...planFor, planBillingPaid: e.target.value === 'paid' })
                }
              >
                <option value="paid">{t('invoiceStatusPaid')}</option>
                <option value="unpaid">{t('invoiceStatusUnpaid')}</option>
              </select>
              <span className="text-xs text-stone-500 mt-1 block">{t('merchantPlanBillingHint')}</span>
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary text-sm" onClick={() => setPlanFor(null)}>
                {t('cancel')}
              </button>
              <button
                type="button"
                className="btn-primary text-sm"
                disabled={savingPlan}
                onClick={() => void saveMerchantPlan()}
              >
                {savingPlan ? '…' : t('save')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {purgeFor ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-rose-200 bg-white p-5 shadow-xl space-y-3">
            <h2 className="text-lg font-bold text-rose-900">{t('resellerPurgeSales')}</h2>
            <p className="text-sm text-stone-700">
              <span className="font-semibold">{purgeFor.name}</span>
              {' ? '}
              {t('resellerPurgeBody')}
            </p>
            <ul className="text-xs text-stone-600 list-disc pl-5 space-y-1">
              <li>{t('resellerPurgeDeletes')}</li>
              <li>{t('resellerPurgeKeeps')}</li>
            </ul>
            <label className="flex items-center gap-2 text-xs text-rose-900">
              <input
                type="checkbox"
                checked={deleteCustomersToo}
                onChange={(e) => setDeleteCustomersToo(e.target.checked)}
              />
              {t('resellerPurgeDeleteCustomers')}
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                className="input flex-1 border-rose-200"
                placeholder={t('resellerPurgeConfirmPlaceholder')}
                value={purgeConfirm}
                onChange={(e) => setPurgeConfirm(e.target.value)}
                autoComplete="off"
              />
              <button
                type="button"
                className="btn-secondary whitespace-nowrap border-rose-300 text-rose-800 hover:bg-rose-100"
                disabled={purgingSales || purgeConfirm !== 'DELETE ALL SALES'}
                onClick={() => void handlePurgeSalesData()}
              >
                {purgingSales ? t('resellerPurging') : t('resellerPurgeSales')}
              </button>
            </div>
            <div className="flex justify-end">
              <button type="button" className="btn-secondary text-sm" onClick={closePurge}>
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LicensesPage() {
  const { t, formatDate } = useI18n();
  const [licenses, setLicenses] = useState<any[]>([]);
  const [merchants, setMerchants] = useState<any[]>([]);
  const [pool, setPool] = useState({ licenseSeats: 0, seatsUsed: 0, seatsRemaining: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [merchantFilter, setMerchantFilter] = useState('');
  const [showIssue, setShowIssue] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [lastIssued, setLastIssued] = useState<
    Array<{ deviceName: string; licenseKey: string; externalDeviceId?: string }>
  >([]);
  const [issueForm, setIssueForm] = useState({
    merchantId: '',
    seats: 1,
    licenseType: 'yearly' as 'trial' | 'yearly' | 'custom',
    customDays: 365,
    deviceType: 'tablet',
    mode: 'seats' as 'device' | 'seats',
    posDeviceId: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [licRes, merRes, poolRes] = await Promise.all([
        api.get('/reseller/licenses', {
          params: {
            status: statusFilter || undefined,
            merchantId: merchantFilter || undefined,
            limit: 50,
          },
        }),
        api.get('/reseller/merchants'),
        api.get('/reseller/licenses/pool'),
      ]);
      setLicenses(licRes.data.licenses || []);
      setMerchants(merRes.data.merchants || []);
      setPool(poolRes.data.pool || pool);
    } catch {
      toast.error(t('licenseLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, merchantFilter, t]);

  useEffect(() => {
    load();
  }, [load]);

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t('copied'));
    } catch {
      toast.error(t('copyFailed'));
    }
  };

  const issueSeats = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueForm.merchantId) {
      toast.error(t('selectMerchant'));
      return;
    }
    if (issueForm.mode === 'device' && !issueForm.posDeviceId.trim()) {
      toast.error(t('enterPosDeviceId'));
      return;
    }
    setIssuing(true);
    try {
      const res = await api.post('/reseller/licenses/issue-seats', {
        merchantId: issueForm.merchantId,
        seats: Number(issueForm.seats) || 1,
        licenseType: issueForm.licenseType,
        customDays:
          issueForm.licenseType === 'custom' ? Number(issueForm.customDays) : undefined,
        deviceType: issueForm.deviceType,
        mode: issueForm.mode,
        posDeviceId: issueForm.posDeviceId.trim() || undefined,
      });
      const issued = (res.data.licenses || []).map((k: any) => ({
        deviceName: k.deviceName || k.externalDeviceId || 'POS',
        licenseKey: k.licenseKey,
        externalDeviceId: k.externalDeviceId,
      }));
      setLastIssued(issued);
      if (res.data.pool) setPool(res.data.pool);
      toast.success(res.data.message || t('licensesIssued'));
      setShowIssue(false);
      setIssueForm((f) => ({ ...f, posDeviceId: '' }));
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('licenseIssueFailed'));
    } finally {
      setIssuing(false);
    }
  };

  const revoke = async (id: string) => {
    if (!window.confirm(t('licenseRevokeConfirm'))) return;
    try {
      await api.post(`/reseller/licenses/${id}/revoke`);
      toast.success(t('licenseRevoked'));
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('licenseRevokeFailed'));
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      expired: 'bg-gray-100 text-gray-700',
      suspended: 'bg-red-100 text-red-800',
    };
    return map[status] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">{t('deviceLicenses')}</h1>
          <p className="text-sm text-stone-600 mt-1">{t('deviceLicensesHint')}</p>
          <p className="text-xs text-stone-500 mt-1">
            {t('resellerLicenseSeats')}: {pool.seatsUsed}/{pool.licenseSeats} (
            {pool.seatsRemaining} {t('resellerRemaining')})
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary flex items-center gap-2 text-sm" onClick={load}>
            <RefreshCw className="w-4 h-4" /> {t('refresh')}
          </button>
          <button
            type="button"
            className="btn-primary flex items-center gap-2 text-sm"
            onClick={() => setShowIssue(true)}
          >
            <Plus className="w-4 h-4" /> {t('issueDeviceLicenses')}
          </button>
        </div>
      </div>

      {lastIssued.length > 0 && (
        <div className="card border-emerald-200 bg-emerald-50">
          <div className="flex justify-between mb-2">
            <h3 className="font-semibold flex items-center gap-2">
              <KeyRound className="w-4 h-4" /> {t('justIssued')}
            </h3>
            <button type="button" className="text-sm text-gray-500" onClick={() => setLastIssued([])}>
              {t('dismiss')}
            </button>
          </div>
          <ul className="space-y-2">
            {lastIssued.map((k) => (
              <li
                key={k.licenseKey}
                className="flex items-center justify-between gap-2 bg-white border rounded-lg px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{k.deviceName}</p>
                  <p className="font-mono text-xs truncate">
                    {t('licenseKey')}: {k.licenseKey}
                  </p>
                </div>
                <button type="button" className="btn-secondary p-2" onClick={() => copyText(k.licenseKey)}>
                  <Copy className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <select
          className="input w-auto"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">{t('allStatuses')}</option>
          <option value="active">{t('active')}</option>
          <option value="expired">{t('expired')}</option>
          <option value="suspended">{t('suspended')}</option>
        </select>
        <select
          className="input w-auto min-w-[220px]"
          value={merchantFilter}
          onChange={(e) => setMerchantFilter(e.target.value)}
        >
          <option value="">{t('allMerchants')}</option>
          {merchants.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      <div className="card !p-0 table-scroll">
        {loading ? (
          <div className="text-center py-12">{t('loading')}</div>
        ) : licenses.length === 0 ? (
          <div className="text-center py-12 text-gray-500">{t('noLicenses')}</div>
        ) : (
          <table className="w-full min-w-[720px]">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">{t('merchants')}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">{t('device')}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">{t('licenseKey')}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">{t('licenseType')}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">{t('status')}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">{t('expires')}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {licenses.map((lic) => (
                <tr key={lic.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{lic.merchant?.name || '-'}</td>
                  <td className="px-4 py-3 text-sm">{lic.device?.deviceName || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-xs">{lic.licenseKey}</span>
                      <button type="button" className="p-1" onClick={() => copyText(lic.licenseKey)}>
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm capitalize">{lic.licenseType}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${statusBadge(
                        lic.status
                      )}`}
                    >
                      {lic.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {lic.expiresAt ? formatDate(lic.expiresAt) : '-'}
                  </td>
                  <td className="px-4 py-3">
                    {lic.status === 'active' && (
                      <button
                        type="button"
                        className="p-2 hover:bg-red-50 rounded"
                        onClick={() => revoke(lic.id)}
                        title={t('revoke')}
                      >
                        <Ban className="w-4 h-4 text-red-600" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-bold">{t('issueDeviceLicenses')}</h2>
              <button type="button" className="text-gray-500" onClick={() => setShowIssue(false)}>
                ?
              </button>
            </div>
            <form onSubmit={issueSeats} className="p-6 space-y-4">
              <p className="text-xs text-stone-500">
                {t('resellerRemaining')}: {pool.seatsRemaining}
              </p>
              <label className="block">
                <span className="text-sm font-medium">{t('merchants')} *</span>
                <select
                  className="input mt-1"
                  value={issueForm.merchantId}
                  onChange={(e) => setIssueForm({ ...issueForm, merchantId: e.target.value })}
                  required
                >
                  <option value="">{t('selectMerchant')}</option>
                  {merchants.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.email})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium">{t('issueMode')}</span>
                <select
                  className="input mt-1"
                  value={issueForm.mode}
                  onChange={(e) =>
                    setIssueForm({
                      ...issueForm,
                      mode: e.target.value as 'device' | 'seats',
                    })
                  }
                >
                  <option value="seats">{t('issueModeSeats')}</option>
                  <option value="device">{t('issueModeDevice')}</option>
                </select>
              </label>
              {issueForm.mode === 'device' ? (
                <label className="block">
                  <span className="text-sm font-medium">{t('posDeviceId')} *</span>
                  <input
                    className="input mt-1 font-mono"
                    value={issueForm.posDeviceId}
                    onChange={(e) => setIssueForm({ ...issueForm, posDeviceId: e.target.value })}
                    required
                  />
                </label>
              ) : (
                <label className="block">
                  <span className="text-sm font-medium">{t('deviceLicenseSeats')}</span>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    className="input mt-1"
                    value={issueForm.seats}
                    onChange={(e) => setIssueForm({ ...issueForm, seats: Number(e.target.value) })}
                  />
                </label>
              )}
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm font-medium">{t('licenseType')}</span>
                  <select
                    className="input mt-1"
                    value={issueForm.licenseType}
                    onChange={(e) =>
                      setIssueForm({
                        ...issueForm,
                        licenseType: e.target.value as 'trial' | 'yearly' | 'custom',
                      })
                    }
                  >
                    <option value="trial">{t('licenseTrial')}</option>
                    <option value="yearly">{t('licenseYearly')}</option>
                    <option value="custom">{t('licenseCustom')}</option>
                  </select>
                </label>
                {issueForm.licenseType === 'custom' && (
                  <label className="block">
                    <span className="text-sm font-medium">{t('days')}</span>
                    <input
                      type="number"
                      min={1}
                      className="input mt-1"
                      value={issueForm.customDays}
                      onChange={(e) =>
                        setIssueForm({ ...issueForm, customDays: Number(e.target.value) })
                      }
                    />
                  </label>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" className="btn-secondary" onClick={() => setShowIssue(false)}>
                  {t('cancel')}
                </button>
                <button type="submit" className="btn-primary" disabled={issuing}>
                  {issuing ? '?' : t('issueDeviceLicenses')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function EditionsPage() {
  const { t } = useI18n();
  const [editions, setEditions] = useState<any[]>([]);
  const [form, setForm] = useState({
    name: '',
    note: '',
    businessCategory: 'both',
    features: [...ALL_EDITION_FEATURES] as EditionFeatureKey[],
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const res = await api.get('/reseller/editions', { params: { all: '1' } });
    setEditions(res.data.editions || []);
  };

  useEffect(() => {
    load().catch(() => toast.error(t('posVersionLoadFailed')));
  }, [t]);

  const openCreate = () => {
    setEditingId(null);
    setForm({
      name: '',
      note: '',
      businessCategory: 'both',
      features: [...ALL_EDITION_FEATURES],
    });
    setShowForm(true);
  };

  const openEdit = (ed: any) => {
    setEditingId(ed.id);
    setForm({
      name: ed.name,
      note: ed.note || '',
      businessCategory: ed.businessCategory || 'both',
      features: Array.isArray(ed.features) && ed.features.length
        ? ed.features
        : [...ALL_EDITION_FEATURES],
    });
    setShowForm(true);
  };

  /** Platform templates are read-only ? clone into an editable agency copy, then open editor. */
  const customizePlatform = async (ed: any) => {
    try {
      setSaving(true);
      const res = await api.post(`/reseller/editions/${ed.id}/clone`);
      const cloned = res.data?.edition;
      toast.success(t('posVersionClonedEditable'));
      await load();
      if (cloned?.id) {
        openEdit(cloned);
      } else {
        const refreshed = await api.get('/reseller/editions', { params: { all: '1' } });
        const list = refreshed.data.editions || [];
        const match = list.find(
          (e: any) => e.ownerType === 'reseller' && String(e.name || '').startsWith(ed.name)
        );
        if (match) openEdit(match);
      }
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('resellerSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error(t('posVersionNameRequired'));
      return;
    }
    try {
      setSaving(true);
      if (editingId) {
        const ed = editions.find((e) => e.id === editingId);
        if (ed?.ownerType === 'platform') {
          toast.error(t('posVersionCloneRequired'));
          return;
        }
        await api.put(`/reseller/editions/${editingId}`, {
          ...form,
          features: form.features,
        });
        toast.success(t('posVersionUpdated'));
      } else {
        await api.post('/reseller/editions', form);
        toast.success(t('posVersionCreated'));
      }
      setShowForm(false);
      setEditingId(null);
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('resellerSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (ed: any) => {
    if (!window.confirm(t('posVersionDeactivateConfirm').replace('{name}', ed.name))) return;
    try {
      await api.delete(`/reseller/editions/${ed.id}`);
      toast.success(t('posVersionDeactivated'));
      if (editingId === ed.id) {
        setShowForm(false);
        setEditingId(null);
      }
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('resellerSaveFailed'));
    }
  };

  const featureLabel = (key: string) => {
    for (const g of EDITION_FEATURE_GROUPS) {
      const f = g.features.find((x) => x.key === key);
      if (f) return f.label;
    }
    return key;
  };

  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{t('posVersionManagement')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-stone-500">{t('posVersionResellerHint')}</p>
        </div>
        <button type="button" className="btn-primary text-sm" onClick={openCreate} disabled={saving}>
          {t('posVersionNew')}
        </button>
      </div>
      {showForm && (
        <div className="card space-y-3 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm sm:col-span-2">
              <span className="font-medium text-stone-700">{t('posVersionName')}</span>
              <input
                className="input"
                placeholder={t('posVersionName')}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </label>
            <label className="block space-y-1 text-sm sm:col-span-2">
              <span className="font-medium text-stone-700">{t('note')}</span>
              <input
                className="input"
                placeholder={t('posVersionNotePlaceholder')}
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              />
            </label>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold text-stone-800">{t('features')}</p>
            <EditionFeatureChecklist
              value={form.features}
              onChange={(features) => setForm((f) => ({ ...f, features }))}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="btn-secondary text-sm"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
            >
              {t('cancel')}
            </button>
            <button type="button" className="btn-primary text-sm" onClick={() => void save()} disabled={saving}>
              {saving ? t('saving') : t('save')}
            </button>
          </div>
        </div>
      )}
      <div className="card table-scroll !p-0">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-stone-50 text-left">
            <tr>
              <th className="px-3 py-2">{t('name')}</th>
              <th className="px-3 py-2">{t('owner')}</th>
              <th className="px-3 py-2">{t('features')}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {editions.map((ed) => {
              const feats: string[] = Array.isArray(ed.features) ? ed.features : [];
              const isPlatform = ed.ownerType === 'platform';
              return (
                <tr key={ed.id} className="border-t align-top">
                  <td className="px-3 py-2">
                    <p className="font-medium">{ed.name}</p>
                    {ed.note ? <p className="mt-0.5 text-xs text-stone-500">{ed.note}</p> : null}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[11px] font-bold uppercase ${
                        isPlatform ? 'bg-stone-100 text-stone-600' : 'bg-teal-50 text-teal-800'
                      }`}
                    >
                      {isPlatform ? t('posVersionPlatform') : t('posVersionYours')}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <p className="mb-1 text-xs font-semibold text-stone-500">
                      {feats.length}/{ALL_EDITION_FEATURES.length}
                    </p>
                    <div className="flex max-w-md flex-wrap gap-1">
                      {feats.slice(0, 8).map((k) => (
                        <span
                          key={k}
                          className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-700"
                          title={k}
                        >
                          {featureLabel(k)}
                        </span>
                      ))}
                      {feats.length > 8 ? (
                        <span className="text-[10px] text-stone-400">+{feats.length - 8}</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="space-x-2 px-3 py-2 text-right whitespace-nowrap">
                    {isPlatform ? (
                      <button
                        type="button"
                        className="text-teal-700 hover:underline disabled:opacity-40"
                        disabled={saving}
                        onClick={() => void customizePlatform(ed)}
                      >
                        {t('posVersionCustomize')}
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="text-teal-700 hover:underline"
                          onClick={() => openEdit(ed)}
                        >
                          {t('edit')}
                        </button>
                        <button
                          type="button"
                          className="text-red-600 hover:underline"
                          onClick={() => void deactivate(ed)}
                        >
                          {t('deactivate')}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ResellerShell() {
  const { t, locale, setLocale } = useI18n();
  const user = useAuthStore((s) => s.user);
  const [sidebarOpen, setSidebarOpen] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );

  useEffect(() => {
    document.title = APP_PANEL_TITLE;
  }, []);

  const menuItems = [
    { label: t('overview'), path: '/reseller', icon: <LayoutDashboard /> },
    {
      id: 'merchants',
      label: t('merchants'),
      icon: <Store />,
      children: [
        { label: t('resellerStores'), path: '/reseller/merchants', icon: <Building2 /> },
        { label: t('deviceLicenses'), path: '/reseller/licenses', icon: <KeyRound /> },
      ],
    },
    {
      id: 'editions',
      label: t('posVersions'),
      icon: <Package />,
      children: [
        { label: t('posVersionManagement'), path: '/reseller/editions', icon: <Package /> },
        { label: 'Packages & add-ons', path: '/reseller/packages', icon: <Package /> },
      ],
    },
    { label: t('supportInboxTitle'), path: '/reseller/support', icon: <LifeBuoy /> },
  ];

  return (
    <div className="flex h-full max-h-full panel-shell">
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        menuItems={menuItems}
        panelKey="reseller"
        language={locale}
        onLanguageChange={(lang: Locale) => setLocale(lang)}
      />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 min-h-0">
        <Header
          title={`${user?.name || 'Reseller'} — Agency`}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        />
        <PlatformStatusBannerSlot />
        <main className="panel-main flex-1 p-3 sm:p-4">
          <Routes>
            <Route index element={<Overview />} />
            <Route path="merchants" element={<MerchantsPage />} />
            <Route path="licenses" element={<LicensesPage />} />
            <Route path="editions" element={<EditionsPage />} />
            <Route path="packages" element={<ResellerPackages />} />
            <Route path="support" element={<SupportInbox mode="reseller" />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function ResellerDashboard() {
  return (
    <I18nProvider>
      <PlatformMessagesProvider>
        <ResellerShell />
      </PlatformMessagesProvider>
    </I18nProvider>
  );
}
