import { useCallback, useEffect, useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Ban, Copy, KeyRound, Plus, RefreshCw } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import api from '@/lib/api';
import { I18nProvider, useI18n, type Locale } from '@/lib/i18n';
import { APP_PANEL_TITLE } from '@/lib/brand';
import { useAuthStore } from '@/store/auth';
import { ALL_EDITION_FEATURES, type EditionFeatureKey } from '@/lib/edition-features';
import EditionFeatureChecklist from '@/components/EditionFeatureChecklist';

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
  });

  const load = useCallback(async () => {
    try {
      const [m, e, p] = await Promise.all([
        api.get('/reseller/merchants', { params: { search: search || undefined } }),
        api.get('/reseller/editions'),
        api.get('/reseller/licenses/pool'),
      ]);
      setMerchants(m.data.merchants || []);
      setEditions(e.data.editions || []);
      setPool(p.data.pool || pool);
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('resellerLoadFailed'));
    }
  }, [search, t]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (ev: React.FormEvent) => {
    ev.preventDefault();
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
        password: form.password || undefined,
        deviceSeats: seats,
        customDays: form.licenseType === 'custom' ? Number(form.customDays) : undefined,
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

  const openPanel = async (m: any) => {
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
      });
      toast.success(t('resellerOpenMerchant'));
      navigate('/merchant');
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('resellerSaveFailed'));
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
              {editions.map((ed) => (
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

          <div className="sm:col-span-2 flex justify-end gap-2">
            <button type="button" className="btn-secondary text-sm" onClick={() => setShowCreate(false)}>
              {t('cancel')}
            </button>
            <button type="submit" className="btn-primary text-sm" disabled={saving}>
              {saving ? '…' : t('save')}
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
                <td className="px-3 py-2">{m.status}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    className="text-teal-700 hover:underline"
                    onClick={() => openPanel(m)}
                  >
                    {t('resellerOpenMerchant')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LicensesPage() {
  const { t } = useI18n();
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
                    {lic.expiresAt ? new Date(lic.expiresAt).toLocaleDateString() : '-'}
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
                  {issuing ? '…' : t('issueDeviceLicenses')}
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

  const load = async () => {
    const res = await api.get('/reseller/editions', { params: { all: '1' } });
    setEditions(res.data.editions || []);
  };

  useEffect(() => {
    load().catch(() => toast.error(t('posVersionLoadFailed')));
  }, [t]);

  const save = async () => {
    try {
      if (editingId) {
        const ed = editions.find((e) => e.id === editingId);
        if (ed?.ownerType === 'platform') {
          toast.error(t('posVersionCloneRequired'));
          return;
        }
        await api.put(`/reseller/editions/${editingId}`, form);
      } else {
        await api.post('/reseller/editions', form);
      }
      toast.success(t('saved'));
      setShowForm(false);
      setEditingId(null);
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('resellerSaveFailed'));
    }
  };

  const clone = async (id: string) => {
    try {
      await api.post(`/reseller/editions/${id}/clone`);
      toast.success(t('cloned'));
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('resellerSaveFailed'));
    }
  };

  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold">{t('posVersionManagement')}</h1>
        <button
          type="button"
          className="btn-primary text-sm"
          onClick={() => {
            setEditingId(null);
            setForm({
              name: '',
              note: '',
              businessCategory: 'both',
              features: [...ALL_EDITION_FEATURES],
            });
            setShowForm(true);
          }}
        >
          {t('posVersionNew')}
        </button>
      </div>
      {showForm && (
        <div className="card p-4 space-y-3">
          <input
            className="input"
            placeholder={t('posVersionName')}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <EditionFeatureChecklist
            value={form.features}
            onChange={(features) => setForm((f) => ({ ...f, features }))}
          />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary text-sm" onClick={() => setShowForm(false)}>
              {t('cancel')}
            </button>
            <button type="button" className="btn-primary text-sm" onClick={save}>
              {t('save')}
            </button>
          </div>
        </div>
      )}
      <div className="card !p-0 table-scroll">
        <table className="w-full text-sm min-w-[480px]">
          <thead className="bg-stone-50 text-left">
            <tr>
              <th className="px-3 py-2">{t('name')}</th>
              <th className="px-3 py-2">{t('owner')}</th>
              <th className="px-3 py-2">{t('features')}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {editions.map((ed) => (
              <tr key={ed.id} className="border-t">
                <td className="px-3 py-2 font-medium">{ed.name}</td>
                <td className="px-3 py-2">{ed.ownerType}</td>
                <td className="px-3 py-2">{ed.features?.length}</td>
                <td className="px-3 py-2 text-right space-x-2">
                  {ed.ownerType === 'platform' ? (
                    <button
                      type="button"
                      className="text-teal-700 hover:underline"
                      onClick={() => clone(ed.id)}
                    >
                      {t('clone')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="text-teal-700 hover:underline"
                      onClick={() => {
                        setEditingId(ed.id);
                        setForm({
                          name: ed.name,
                          note: ed.note || '',
                          businessCategory: ed.businessCategory || 'both',
                          features: ed.features || [...ALL_EDITION_FEATURES],
                        });
                        setShowForm(true);
                      }}
                    >
                      {t('edit')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
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
    { label: t('overview'), path: '/reseller', icon: '??' },
    {
      id: 'merchants',
      label: t('merchants'),
      icon: '??',
      children: [
        { label: t('resellerStores'), path: '/reseller/merchants', icon: '??' },
        { label: t('deviceLicenses'), path: '/reseller/licenses', icon: '??' },
      ],
    },
    {
      id: 'editions',
      label: t('posVersions'),
      icon: '??',
      children: [{ label: t('posVersionManagement'), path: '/reseller/editions', icon: '??' }],
    },
  ];

  return (
    <div className="flex h-full max-h-full panel-shell">
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        menuItems={menuItems}
        panelKey="reseller"
      />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 min-h-0">
        <Header
          title={`${user?.name || 'Reseller'} — Agency`}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          language={locale}
          onLanguageChange={(lang: Locale) => setLocale(lang)}
        />
        <main className="panel-main flex-1 p-3 sm:p-4">
          <Routes>
            <Route index element={<Overview />} />
            <Route path="merchants" element={<MerchantsPage />} />
            <Route path="licenses" element={<LicensesPage />} />
            <Route path="editions" element={<EditionsPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function ResellerDashboard() {
  return (
    <I18nProvider>
      <ResellerShell />
    </I18nProvider>
  );
}
