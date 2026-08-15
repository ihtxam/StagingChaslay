import { FormEvent, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';

type VoucherUsageType = 'single_use' | 'multi_use' | 'customer';
type VoucherDiscountType = 'percent' | 'fixed';

type Voucher = {
  id: string;
  code: string;
  name?: string | null;
  usageType: VoucherUsageType;
  maxRedemptions: number;
  customerId?: string | null;
  customer?: { id: string; email?: string | null; name?: string } | null;
  discountType: VoucherDiscountType;
  discountValue: number;
  minOrderAmount: number;
  validFrom?: string | null;
  validTo?: string | null;
  isActive: boolean;
  redemptionCount: number;
};

type CustomerOpt = { id: string; email?: string | null; firstName?: string | null; lastName?: string | null };

const emptyForm = () => ({
  code: '',
  name: '',
  usageType: 'multi_use' as VoucherUsageType,
  maxRedemptions: '10',
  customerId: '',
  discountType: 'percent' as VoucherDiscountType,
  discountValue: '10',
  minOrderAmount: '',
  validFrom: '',
  validTo: '',
  isActive: true,
});

export default function Vouchers() {
  const { t, formatDateTime } = useI18n();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [customers, setCustomers] = useState<CustomerOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [redemptions, setRedemptions] = useState<any[]>([]);
  const [redemptionsFor, setRedemptionsFor] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [vRes, cRes] = await Promise.all([
        api.get('/merchant/vouchers'),
        api.get('/merchant/customers'),
      ]);
      setVouchers(vRes.data.vouchers || []);
      setCustomers(cRes.data.customers || []);
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('voucherLoadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const usageLabels = useMemo(
    () => ({
      single_use: t('voucherUsageSingle'),
      multi_use: t('voucherUsageMulti'),
      customer: t('voucherUsageCustomer'),
    }),
    [t]
  );

  const discountValueInputProps = useMemo(
    () =>
      form.discountType === 'percent'
        ? { min: 0, max: 100, step: 1 }
        : { min: 0.01, step: 0.01 },
    [form.discountType]
  );

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm());
  };

  const startEdit = (v: Voucher) => {
    setEditingId(v.id);
    setForm({
      code: v.code,
      name: v.name || '',
      usageType: v.usageType,
      maxRedemptions: String(v.maxRedemptions),
      customerId: v.customerId || '',
      discountType: v.discountType,
      discountValue: String(v.discountValue),
      minOrderAmount: v.minOrderAmount > 0 ? String(v.minOrderAmount) : '',
      validFrom: v.validFrom ? v.validFrom.slice(0, 16) : '',
      validTo: v.validTo ? v.validTo.slice(0, 16) : '',
      isActive: v.isActive,
    });
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.code.trim()) {
      toast.error(t('voucherCodeRequired'));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim() || null,
        usageType: form.usageType,
        maxRedemptions: form.usageType === 'single_use' ? 1 : Number(form.maxRedemptions) || 1,
        customerId: form.usageType === 'customer' ? form.customerId || null : null,
        discountType: form.discountType,
        discountValue: Number(form.discountValue) || 0,
        minOrderAmount: form.minOrderAmount ? Number(form.minOrderAmount) : 0,
        validFrom: form.validFrom ? new Date(form.validFrom).toISOString() : null,
        validTo: form.validTo ? new Date(form.validTo).toISOString() : null,
        isActive: form.isActive,
      };
      if (editingId) {
        await api.put(`/merchant/vouchers/${editingId}`, payload);
        toast.success(t('voucherUpdated'));
      } else {
        await api.post('/merchant/vouchers', payload);
        toast.success(t('voucherCreated'));
      }
      resetForm();
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('voucherSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm(t('voucherDeleteConfirm'))) return;
    try {
      await api.delete(`/merchant/vouchers/${id}`);
      toast.success(t('voucherDeleted'));
      if (editingId === id) resetForm();
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('voucherDeleteFailed'));
    }
  };

  const showRedemptions = async (id: string) => {
    setRedemptionsFor(id);
    try {
      const res = await api.get(`/merchant/vouchers/${id}/redemptions`);
      setRedemptions(res.data.redemptions || []);
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('voucherRedemptionsFailed'));
      setRedemptions([]);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('vouchers')}</h1>
        <p className="text-sm muted mt-1">{t('vouchersHint')}</p>
      </div>

      <form onSubmit={save} className="card p-4 space-y-4">
        <h2 className="font-semibold">{editingId ? t('voucherEdit') : t('voucherCreate')}</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="muted block mb-1 text-sm">{t('voucherCode')}</span>
            <input
              className="w-full border px-3 py-2 rounded"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              placeholder="SUMMER20"
              required
            />
          </label>
          <label className="block">
            <span className="muted block mb-1 text-sm">{t('voucherName')}</span>
            <input
              className="w-full border px-3 py-2 rounded"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="muted block mb-1 text-sm">{t('voucherUsageType')}</span>
            <select
              className="w-full border px-3 py-2 rounded"
              value={form.usageType}
              onChange={(e) =>
                setForm((f) => ({ ...f, usageType: e.target.value as VoucherUsageType }))
              }
            >
              <option value="single_use">{usageLabels.single_use}</option>
              <option value="multi_use">{usageLabels.multi_use}</option>
              <option value="customer">{usageLabels.customer}</option>
            </select>
          </label>
          {form.usageType === 'multi_use' ? (
            <label className="block">
              <span className="muted block mb-1 text-sm">{t('voucherMaxRedemptions')}</span>
              <input
                type="number"
                min={1}
                className="w-full border px-3 py-2 rounded"
                value={form.maxRedemptions}
                onChange={(e) => setForm((f) => ({ ...f, maxRedemptions: e.target.value }))}
              />
            </label>
          ) : null}
          {form.usageType === 'customer' ? (
            <label className="block sm:col-span-2">
              <span className="muted block mb-1 text-sm">{t('voucherCustomer')}</span>
              <select
                className="w-full border px-3 py-2 rounded"
                value={form.customerId}
                onChange={(e) => setForm((f) => ({ ...f, customerId: e.target.value }))}
                required
              >
                <option value="">{t('voucherSelectCustomer')}</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {[c.firstName, c.lastName].filter(Boolean).join(' ') || c.email || c.id}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="block">
            <span className="muted block mb-1 text-sm">{t('voucherDiscountType')}</span>
            <select
              className="w-full border px-3 py-2 rounded"
              value={form.discountType}
              onChange={(e) =>
                setForm((f) => ({ ...f, discountType: e.target.value as VoucherDiscountType }))
              }
            >
              <option value="percent">{t('voucherDiscountPercent')}</option>
              <option value="fixed">{t('voucherDiscountFixed')}</option>
            </select>
          </label>
          <label className="block">
            <span className="muted block mb-1 text-sm">{t('voucherDiscountValue')}</span>
            <input
              type="number"
              {...discountValueInputProps}
              className="w-full border px-3 py-2 rounded"
              value={form.discountValue}
              onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))}
              required
            />
          </label>
          <label className="block">
            <span className="muted block mb-1 text-sm">{t('offerMinOrder')}</span>
            <input
              type="number"
              min={0}
              step={0.05}
              className="w-full border px-3 py-2 rounded"
              value={form.minOrderAmount}
              onChange={(e) => setForm((f) => ({ ...f, minOrderAmount: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="muted block mb-1 text-sm">{t('voucherValidFrom')}</span>
            <input
              type="datetime-local"
              className="w-full border px-3 py-2 rounded"
              value={form.validFrom}
              onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="muted block mb-1 text-sm">{t('voucherValidTo')}</span>
            <input
              type="datetime-local"
              className="w-full border px-3 py-2 rounded"
              value={form.validTo}
              onChange={(e) => setForm((f) => ({ ...f, validTo: e.target.value }))}
            />
          </label>
        </div>
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
          />
          {t('voucherActive')}
        </label>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? t('saving') : editingId ? t('save') : t('voucherCreate')}
          </button>
          {editingId ? (
            <button type="button" className="btn-secondary" onClick={resetForm}>
              {t('cancel')}
            </button>
          ) : null}
        </div>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2 pr-3">{t('voucherCode')}</th>
              <th className="py-2 pr-3">{t('voucherDiscount')}</th>
              <th className="py-2 pr-3">{t('voucherUsageType')}</th>
              <th className="py-2 pr-3">{t('voucherRedemptions')}</th>
              <th className="py-2 pr-3">{t('status')}</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="py-6 text-center muted">
                  {t('loading')}
                </td>
              </tr>
            ) : vouchers.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-6 text-center muted">
                  {t('voucherNoneYet')}
                </td>
              </tr>
            ) : (
              vouchers.map((v) => (
                <tr key={v.id} className="border-b border-stone-100">
                  <td className="py-3 pr-3 font-mono font-semibold">{v.code}</td>
                  <td className="py-3 pr-3">
                    {v.discountType === 'percent'
                      ? `${v.discountValue}%`
                      : `CHF ${v.discountValue.toFixed(2)}`}
                  </td>
                  <td className="py-3 pr-3">{usageLabels[v.usageType] || v.usageType}</td>
                  <td className="py-3 pr-3">
                    {v.redemptionCount}
                    {v.usageType === 'multi_use' ? ` / ${v.maxRedemptions}` : ''}
                  </td>
                  <td className="py-3 pr-3">{v.isActive ? t('active') : t('inactive')}</td>
                  <td className="py-3 text-right whitespace-nowrap">
                    <button type="button" className="text-teal-700 mr-2" onClick={() => startEdit(v)}>
                      {t('edit')}
                    </button>
                    <button
                      type="button"
                      className="text-stone-600 mr-2"
                      onClick={() => void showRedemptions(v.id)}
                    >
                      {t('voucherRedemptions')}
                    </button>
                    <button type="button" className="text-red-600" onClick={() => void remove(v.id)}>
                      {t('delete')}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {redemptionsFor ? (
        <div className="card p-4 space-y-2">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">{t('voucherRedemptions')}</h3>
            <button type="button" className="text-sm" onClick={() => setRedemptionsFor(null)}>
              {t('shopClose')}
            </button>
          </div>
          {redemptions.length === 0 ? (
            <p className="text-sm muted">{t('voucherNoRedemptions')}</p>
          ) : (
            <ul className="text-sm space-y-1">
              {redemptions.map((r) => (
                <li key={r.id} className="flex justify-between gap-2 border-b py-1">
                  <span>
                    {r.order?.orderNumber || r.order?.id || '—'} · −CHF{' '}
                    {Number(r.discountAmount).toFixed(2)}
                  </span>
                  <span className="muted">{formatDateTime(r.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
