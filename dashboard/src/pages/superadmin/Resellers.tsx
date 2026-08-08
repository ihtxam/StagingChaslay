import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { useI18n } from '@/lib/i18n';

type Reseller = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  merchantCount: number;
  licenseSeats: number;
  seatsUsed: number;
  seatsRemaining: number;
  activeOrTrialCount?: number;
  suspendedCount?: number;
  billableMerchantCount?: number;
  deviceCount?: number;
};

type Prices = {
  currency: string;
  basePosMonthly: number;
  featurePrices: Record<string, number>;
};

type Invoice = {
  reseller: Reseller;
  period: { year: number; month: number; label: string; note: string };
  pricingUnit: string;
  stats: Record<string, number>;
  currency: string;
  merchants: Array<{
    merchantId: string;
    name: string;
    status: string;
    billable: boolean;
    activeLicenses: number;
    devices: number;
    activeFeatures: string[];
  }>;
  lines: Array<{
    code: string;
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
  subtotalBase: number;
  subtotalFeatures: number;
  totalDue: number;
};

const empty = { name: '', email: '', password: '', phone: '', licenseSeats: 0 };
const FEATURE_KEYS = [
  'online_shop',
  'loyalty',
  'gift_cards',
  'terminals',
  'website_cms',
  'online_payments',
  'offers',
  'reservations',
] as const;

export default function Resellers() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const startImpersonation = useAuthStore((s) => s.startImpersonation);
  const [rows, setRows] = useState<Reseller[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Reseller | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [detailTab, setDetailTab] = useState<'stats' | 'billing'>('stats');
  const [period, setPeriod] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() + 1 };
  });
  const [allocSeats, setAllocSeats] = useState(0);
  const [allocating, setAllocating] = useState(false);
  const [prices, setPrices] = useState<Prices | null>(null);
  const [showPrices, setShowPrices] = useState(false);
  const [savingPrices, setSavingPrices] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await api.post('/superadmin/resellers/ensure-agency').catch(() => null);
      const [res, priceRes] = await Promise.all([
        api.get('/superadmin/resellers'),
        api.get('/superadmin/reseller-billing/prices'),
      ]);
      setRows(res.data.resellers || []);
      setPrices(priceRes.data.prices || null);
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('resellerLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const loadInvoice = async (resellerId: string, y = period.year, m = period.month) => {
    try {
      const res = await api.get(`/superadmin/resellers/${resellerId}/billing`, {
        params: { year: y, month: m },
      });
      setInvoice(res.data.invoice || null);
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('resellerBillingFailed'));
    }
  };

  const openDetail = async (r: Reseller) => {
    setDetail(r);
    setDetailTab('stats');
    setAllocSeats(r.licenseSeats || 0);
    await loadInvoice(r.id);
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/superadmin/resellers', form);
      toast.success(t('resellerCreated'));
      setForm(empty);
      setShowCreate(false);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('resellerSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (r: Reseller) => {
    const next = r.status === 'active' ? 'suspended' : 'active';
    try {
      await api.put(`/superadmin/resellers/${r.id}`, { status: next });
      toast.success(next === 'active' ? t('resellerActivated') : t('resellerSuspended'));
      load();
    } catch {
      toast.error(t('resellerSaveFailed'));
    }
  };

  const allocate = async () => {
    if (!detail) return;
    setAllocating(true);
    try {
      const res = await api.post(`/superadmin/resellers/${detail.id}/allocate-seats`, {
        seats: Number(allocSeats) || 0,
      });
      toast.success(t('resellerSeatsAllocatedOk'));
      setDetail(res.data.reseller);
      load();
      await loadInvoice(detail.id);
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('resellerSaveFailed'));
    } finally {
      setAllocating(false);
    }
  };

  const savePrices = async () => {
    if (!prices) return;
    setSavingPrices(true);
    try {
      const res = await api.put('/superadmin/reseller-billing/prices', prices);
      setPrices(res.data.prices);
      toast.success(t('resellerPricesSaved'));
      setShowPrices(false);
      if (detail) await loadInvoice(detail.id);
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('resellerSaveFailed'));
    } finally {
      setSavingPrices(false);
    }
  };

  const openAs = async (r: Reseller) => {
    if (r.status !== 'active') {
      toast.error(t('resellerSuspended'));
      return;
    }
    setOpeningId(r.id);
    try {
      const res = await api.post(`/superadmin/resellers/${r.id}/impersonate`);
      const { token, reseller } = res.data;
      if (!token || !reseller) throw new Error('Invalid response');
      startImpersonation(token, {
        id: reseller.id,
        email: reseller.email,
        name: reseller.name,
        role: 'reseller',
        resellerId: reseller.id,
        impersonatedBy: 'superadmin',
      });
      toast.success(`${t('resellerOpenAs')} ${reseller.name}`);
      navigate('/reseller');
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('resellerSaveFailed'));
    } finally {
      setOpeningId(null);
    }
  };

  const money = (n: number, currency = 'CHF') =>
    `${currency} ${Number(n || 0).toFixed(2)}`;

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-stone-900">{t('resellerManage')}</h1>
          <p className="text-sm text-stone-600 mt-1">{t('resellerManageHint')}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary text-sm" onClick={() => setShowPrices(true)}>
            {t('resellerPriceList')}
          </button>
          <button type="button" className="btn-primary text-sm" onClick={() => setShowCreate(true)}>
            {t('resellerAdd')}
          </button>
        </div>
      </div>

      {showPrices && prices && (
        <div className="card p-4 space-y-3">
          <h2 className="font-semibold">{t('resellerPriceList')} (CHF / {t('resellerMonthly')})</h2>
          <p className="text-xs text-stone-500">{t('resellerPriceListHint')}</p>
          <label className="text-sm block max-w-xs">
            {t('resellerBasePosFee')}
            <input
              type="number"
              min={0}
              step={0.01}
              className="input mt-1"
              value={prices.basePosMonthly}
              onChange={(e) =>
                setPrices({ ...prices, basePosMonthly: Number(e.target.value) || 0 })
              }
            />
          </label>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
            {FEATURE_KEYS.map((key) => (
              <label key={key} className="text-sm">
                {key.replace(/_/g, ' ')}
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className="input mt-1"
                  value={prices.featurePrices[key] ?? 0}
                  onChange={(e) =>
                    setPrices({
                      ...prices,
                      featurePrices: {
                        ...prices.featurePrices,
                        [key]: Number(e.target.value) || 0,
                      },
                    })
                  }
                />
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary text-sm" onClick={() => setShowPrices(false)}>
              {t('cancel')}
            </button>
            <button type="button" className="btn-primary text-sm" disabled={savingPrices} onClick={savePrices}>
              {savingPrices ? 'ù' : t('save')}
            </button>
          </div>
        </div>
      )}

      {showCreate && (
        <form onSubmit={create} className="card p-4 grid sm:grid-cols-2 gap-3">
          <label className="text-sm">
            {t('name')} *
            <input
              className="input mt-1"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
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
            {t('password')} *
            <input
              className="input mt-1"
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            {t('phone')}
            <input
              className="input mt-1"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            {t('resellerLicenseSeats')}
            <input
              type="number"
              min={0}
              className="input mt-1"
              value={form.licenseSeats}
              onChange={(e) => setForm((f) => ({ ...f, licenseSeats: Number(e.target.value) || 0 }))}
            />
          </label>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <button type="button" className="btn-secondary text-sm" onClick={() => setShowCreate(false)}>
              {t('cancel')}
            </button>
            <button type="submit" className="btn-primary text-sm" disabled={saving}>
              {saving ? 'ù' : t('save')}
            </button>
          </div>
        </form>
      )}

      <div className="card !p-0 table-scroll">
        {loading ? (
          <p className="p-4 text-sm text-stone-500">{t('loading')}</p>
        ) : (
          <table className="w-full text-sm min-w-[860px]">
            <thead className="bg-stone-50 text-left">
              <tr>
                <th className="px-3 py-2">{t('name')}</th>
                <th className="px-3 py-2">{t('email')}</th>
                <th className="px-3 py-2">{t('merchants')}</th>
                <th className="px-3 py-2">{t('resellerLicenseSeats')}</th>
                <th className="px-3 py-2">{t('resellerBillable')}</th>
                <th className="px-3 py-2">{t('status')}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-stone-100">
                  <td className="px-3 py-2 font-medium">
                    <button type="button" className="text-left hover:underline" onClick={() => openDetail(r)}>
                      <span className="cell-truncate block" title={r.name}>
                        {r.name}
                      </span>
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <span className="cell-truncate block" title={r.email}>
                      {r.email}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {r.merchantCount}
                    <span className="text-xs text-stone-500 block">
                      {r.activeOrTrialCount ?? 0} {t('resellerActiveShort')} / {r.suspendedCount ?? 0}{' '}
                      {t('resellerSuspendedShort')}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {r.seatsUsed}/{r.licenseSeats}
                    <span className="text-xs text-stone-500 block">
                      {r.seatsRemaining} {t('resellerRemaining')}
                    </span>
                  </td>
                  <td className="px-3 py-2">{r.billableMerchantCount ?? 0}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        r.status === 'active'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right space-x-2 whitespace-nowrap">
                    <button
                      type="button"
                      className="text-teal-700 hover:underline"
                      onClick={() => openDetail(r)}
                    >
                      {t('resellerDetail')}
                    </button>
                    <button
                      type="button"
                      className="text-teal-700 hover:underline"
                      disabled={openingId === r.id}
                      onClick={() => openAs(r)}
                    >
                      {openingId === r.id ? 'ù' : t('resellerOpenAs')}
                    </button>
                    <button
                      type="button"
                      className="text-stone-600 hover:underline"
                      onClick={() => toggleStatus(r)}
                    >
                      {r.status === 'active' ? t('suspend') : t('activate')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b flex justify-between items-start gap-3">
              <div>
                <h2 className="text-lg font-bold">{detail.name}</h2>
                <p className="text-sm text-stone-500">{detail.email}</p>
              </div>
              <button type="button" className="text-stone-500" onClick={() => setDetail(null)}>
                ?
              </button>
            </div>

            <div className="px-5 pt-3 flex gap-2 border-b">
              <button
                type="button"
                className={`text-sm px-3 py-2 border-b-2 ${
                  detailTab === 'stats' ? 'border-teal-600 text-teal-800' : 'border-transparent'
                }`}
                onClick={() => setDetailTab('stats')}
              >
                {t('resellerStats')}
              </button>
              <button
                type="button"
                className={`text-sm px-3 py-2 border-b-2 ${
                  detailTab === 'billing' ? 'border-teal-600 text-teal-800' : 'border-transparent'
                }`}
                onClick={() => setDetailTab('billing')}
              >
                {t('resellerBilling')}
              </button>
            </div>

            <div className="p-5 space-y-4">
              {detailTab === 'stats' && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      [t('merchants'), invoice?.stats.merchantCount ?? detail.merchantCount],
                      [t('resellerActiveShort'), invoice?.stats.activeOrTrialCount ?? detail.activeOrTrialCount],
                      [t('resellerSuspendedShort'), invoice?.stats.suspendedCount ?? detail.suspendedCount],
                      [t('resellerDevices'), invoice?.stats.deviceCount ?? detail.deviceCount],
                      [t('resellerSeatsAllocatedLabel'), invoice?.stats.licenseSeatsAllocated ?? detail.licenseSeats],
                      [t('resellerSeatsUsed'), invoice?.stats.licenseSeatsUsed ?? detail.seatsUsed],
                      [t('resellerRemaining'), invoice?.stats.licenseSeatsRemaining ?? detail.seatsRemaining],
                      [t('resellerBillable'), invoice?.stats.billableMerchantCount ?? detail.billableMerchantCount],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="border rounded-lg p-3">
                        <p className="text-xs text-stone-500">{label}</p>
                        <p className="text-xl font-bold">{value ?? 0}</p>
                      </div>
                    ))}
                  </div>
                  <div className="border rounded-lg p-3 flex flex-wrap items-end gap-3">
                    <label className="text-sm">
                      {t('resellerAllocateSeats')}
                      <input
                        type="number"
                        min={0}
                        className="input mt-1 w-32"
                        value={allocSeats}
                        onChange={(e) => setAllocSeats(Number(e.target.value) || 0)}
                      />
                    </label>
                    <button
                      type="button"
                      className="btn-primary text-sm"
                      disabled={allocating}
                      onClick={allocate}
                    >
                      {allocating ? 'ù' : t('resellerAllocate')}
                    </button>
                    <p className="text-xs text-stone-500 flex-1 min-w-[200px]">
                      {t('resellerAllocateHint')}
                    </p>
                  </div>
                </>
              )}

              {detailTab === 'billing' && (
                <>
                  <div className="flex flex-wrap gap-3 items-end">
                    <label className="text-sm">
                      {t('year')}
                      <input
                        type="number"
                        className="input mt-1 w-28"
                        value={period.year}
                        onChange={(e) =>
                          setPeriod((p) => ({ ...p, year: Number(e.target.value) || p.year }))
                        }
                      />
                    </label>
                    <label className="text-sm">
                      {t('month')}
                      <input
                        type="number"
                        min={1}
                        max={12}
                        className="input mt-1 w-20"
                        value={period.month}
                        onChange={(e) =>
                          setPeriod((p) => ({ ...p, month: Number(e.target.value) || p.month }))
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="btn-secondary text-sm"
                      onClick={() => loadInvoice(detail.id, period.year, period.month)}
                    >
                      {t('refresh')}
                    </button>
                  </div>
                  {invoice ? (
                    <>
                      <p className="text-xs text-stone-500">
                        {invoice.period.label} ù {invoice.pricingUnit}
                      </p>
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-stone-50 text-left">
                            <tr>
                              <th className="px-3 py-2">{t('description')}</th>
                              <th className="px-3 py-2">{t('qty')}</th>
                              <th className="px-3 py-2">{t('unitPrice')}</th>
                              <th className="px-3 py-2 text-right">{t('amount')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {invoice.lines.map((line) => (
                              <tr key={line.code} className="border-t">
                                <td className="px-3 py-2">{line.description}</td>
                                <td className="px-3 py-2">{line.quantity}</td>
                                <td className="px-3 py-2">{money(line.unitPrice, invoice.currency)}</td>
                                <td className="px-3 py-2 text-right font-medium">
                                  {money(line.amount, invoice.currency)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t bg-stone-50">
                              <td colSpan={3} className="px-3 py-2 text-right font-semibold">
                                {t('resellerTotalDue')}
                              </td>
                              <td className="px-3 py-2 text-right font-bold">
                                {money(invoice.totalDue, invoice.currency)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                      <div className="table-scroll border rounded-lg !p-0">
                        <table className="w-full text-sm min-w-[560px]">
                          <thead className="bg-stone-50 text-left">
                            <tr>
                              <th className="px-3 py-2">{t('merchants')}</th>
                              <th className="px-3 py-2">{t('status')}</th>
                              <th className="px-3 py-2">{t('licenses')}</th>
                              <th className="px-3 py-2">{t('resellerFeatures')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {invoice.merchants.map((m) => (
                              <tr key={m.merchantId} className="border-t">
                                <td className="px-3 py-2 font-medium">{m.name}</td>
                                <td className="px-3 py-2">
                                  {m.status}
                                  {m.billable ? (
                                    <span className="ml-1 text-xs text-emerald-700">?</span>
                                  ) : null}
                                </td>
                                <td className="px-3 py-2">{m.activeLicenses}</td>
                                <td className="px-3 py-2 text-xs">
                                  {m.activeFeatures.length
                                    ? m.activeFeatures.join(', ')
                                    : 'ù'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-stone-500">{t('loading')}</p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
