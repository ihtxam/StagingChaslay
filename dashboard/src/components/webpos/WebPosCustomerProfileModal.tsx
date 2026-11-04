import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { MembershipPlan } from '@/lib/membership-plans';
import type { WebPosCustomer } from '@/components/WebPosCustomerPicker';

export type PosCustomerOrder = {
  id: string;
  createdAt?: string;
  total?: string | number;
  status?: string;
  items?: Array<{
    id?: string;
    productId?: string | null;
    productName?: string | null;
    name?: string | null;
    quantity?: string | number;
    unitPrice?: string | number;
    totalPrice?: string | number;
    selectedExtras?: Array<{ id: string; name: string; price: number }>;
    comboSelections?: Array<{
      slotId?: string;
      slotName: string;
      productId?: string;
      productName: string;
      extraPrice?: number;
      selectedExtras?: Array<{ id: string; name: string; price: number }>;
    }>;
  }>;
};

export type PosCustomerProfile = {
  customer: WebPosCustomer & {
    allergies?: string | null;
    habits?: string | null;
    membershipPlanId?: string | null;
    membershipLabel?: string | null;
    membershipDiscountPercent?: number;
    loyaltyPoints?: number | null;
    totalSpent?: string | number | null;
    lastOrderAt?: string | null;
  };
  orders: PosCustomerOrder[];
  statistics?: { totalSpent: number; orderCount: number; averageOrderValue: number };
  membershipPlans?: MembershipPlan[];
};

type Tab = 'overview' | 'orders' | 'details';

type Props = {
  open: boolean;
  customerId: string | null;
  onClose: () => void;
  onSaved: (customer: WebPosCustomer & { membershipPlanId?: string | null }) => void;
  onAddOrderToCart: (order: PosCustomerOrder) => void;
  onChangeCustomer: () => void;
  money: (n: number) => string;
};

export default function WebPosCustomerProfileModal({
  open,
  customerId,
  onClose,
  onSaved,
  onAddOrderToCart,
  onChangeCustomer,
  money,
}: Props) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<PosCustomerProfile | null>(null);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    defaultAddress: '',
    defaultZip: '',
    defaultCity: '',
    allergies: '',
    habits: '',
    membershipPlanId: '',
  });

  useEffect(() => {
    if (!open || !customerId) {
      setProfile(null);
      return;
    }
    setTab('overview');
    let cancelled = false;
    setLoading(true);
    void api
      .get(`/merchant/customers/${customerId}/pos-profile`)
      .then((res) => {
        if (cancelled) return;
        const data = res.data as PosCustomerProfile;
        setProfile(data);
        const c = data.customer;
        setForm({
          firstName: c.firstName || '',
          lastName: c.lastName || '',
          email: c.email || '',
          phone: c.phone || '',
          defaultAddress: c.defaultAddress || '',
          defaultZip: c.defaultZip || '',
          defaultCity: c.defaultCity || '',
          allergies: c.allergies || '',
          habits: c.habits || '',
          membershipPlanId: c.membershipPlanId || '',
        });
      })
      .catch((e: { response?: { data?: { error?: string } } }) => {
        if (!cancelled) {
          toast.error(e.response?.data?.error || t('webPosCustomerProfileFailed'));
          onClose();
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, customerId, onClose, t]);

  if (!open) return null;

  const c = profile?.customer;
  const name = c
    ? [c.firstName, c.lastName].filter(Boolean).join(' ') || c.phone || c.email || '—'
    : '…';

  const save = async () => {
    if (!customerId) return;
    setSaving(true);
    try {
      const res = await api.patch(`/merchant/customers/${customerId}`, {
        firstName: form.firstName.trim() || null,
        lastName: form.lastName.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.replace(/\D/g, '').slice(0, 15) || null,
        defaultAddress: form.defaultAddress.trim() || null,
        defaultZip: form.defaultZip.trim() || null,
        defaultCity: form.defaultCity.trim() || null,
        allergies: form.allergies.trim() || null,
        habits: form.habits.trim() || null,
        membershipPlanId: form.membershipPlanId || null,
      });
      const saved = res.data?.customer || {};
      toast.success(t('customersToastUpdated'));
      onSaved({
        id: customerId,
        firstName: saved.firstName ?? form.firstName,
        lastName: saved.lastName ?? form.lastName,
        email: saved.email ?? form.email,
        phone: saved.phone ?? form.phone,
        defaultAddress: saved.defaultAddress ?? form.defaultAddress,
        defaultZip: saved.defaultZip ?? form.defaultZip,
        defaultCity: saved.defaultCity ?? form.defaultCity,
        membershipPlanId: saved.membershipPlanId ?? form.membershipPlanId,
      });
      setTab('overview');
      const refreshed = await api.get(`/merchant/customers/${customerId}/pos-profile`);
      setProfile(refreshed.data);
    } catch (e: { response?: { data?: { error?: string } } }) {
      toast.error(e.response?.data?.error || t('customersToastSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'overview', label: t('webPosCustomerOverview') },
    { id: 'orders', label: t('webPosCustomerOrders') },
    { id: 'details', label: t('webPosCustomerDetails') },
  ];

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-lg font-bold text-stone-900">{name}</p>
            {c?.membershipLabel ? (
              <p className="mt-0.5 text-sm font-semibold text-teal-800">
                {c.membershipLabel}
                {c.membershipDiscountPercent
                  ? ` · −${c.membershipDiscountPercent}%`
                  : ''}
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-stone-500">{t('webPosCustomerNoLevel')}</p>
            )}
          </div>
          <button
            type="button"
            className="rounded-lg p-1 text-stone-500 hover:bg-stone-100"
            onClick={onClose}
            aria-label={t('close')}
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex gap-1 border-b px-3 pt-2">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`rounded-t-lg px-3 py-2 text-sm font-semibold ${
                tab === item.id
                  ? 'bg-stone-100 text-stone-900'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {loading || !profile ? (
            <p className="py-8 text-center text-sm text-stone-500">{t('loading')}</p>
          ) : tab === 'overview' ? (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-violet-50 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase text-violet-700">
                    {t('customersPoints')}
                  </p>
                  <p className="text-lg font-bold text-violet-950">{c?.loyaltyPoints ?? 0}</p>
                </div>
                <div className="rounded-xl bg-emerald-50 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase text-emerald-700">
                    {t('customersSpent')}
                  </p>
                  <p className="text-lg font-bold text-emerald-950">
                    {money(Number(profile.statistics?.totalSpent ?? c?.totalSpent ?? 0))}
                  </p>
                </div>
                <div className="rounded-xl bg-stone-100 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase text-stone-600">
                    {t('webPosCustomerOrderCount')}
                  </p>
                  <p className="text-lg font-bold text-stone-900">
                    {profile.statistics?.orderCount ?? 0}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-rose-700">
                  {t('customersAllergies')}
                </p>
                <p className="mt-0.5 text-stone-800">{c?.allergies || t('webPosCustomerNone')}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-stone-600">
                  {t('customersHabits')}
                </p>
                <p className="mt-0.5 text-stone-800">{c?.habits || t('webPosCustomerNone')}</p>
              </div>
              <p className="text-xs text-stone-500">
                {[c?.email, c?.phone, c?.defaultAddress, c?.defaultZip, c?.defaultCity]
                  .filter(Boolean)
                  .join(' · ') || t('webPosCustomerNoContact')}
              </p>
            </div>
          ) : tab === 'orders' ? (
            <div className="space-y-2">
              {(profile.orders || []).length === 0 ? (
                <p className="py-6 text-center text-sm text-stone-500">{t('webPosCustomerNoOrders')}</p>
              ) : (
                profile.orders.map((order) => (
                  <div key={order.id} className="rounded-xl border border-stone-200 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">
                          {order.createdAt
                            ? new Date(order.createdAt).toLocaleString()
                            : order.id.slice(0, 8)}
                        </p>
                        <p className="text-xs text-stone-500">
                          {money(Number(order.total) || 0)}
                          {order.status ? ` · ${order.status}` : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="btn-primary shrink-0 text-xs"
                        onClick={() => onAddOrderToCart(order)}
                      >
                        {t('webPosAddOrderToCart')}
                      </button>
                    </div>
                    <ul className="mt-2 space-y-0.5 text-xs text-stone-600">
                      {(order.items || []).map((item, idx) => (
                        <li key={item.id || idx}>
                          {item.quantity}× {item.productName || item.name || '—'}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                className="input"
                placeholder={t('customersFirstName')}
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              />
              <input
                className="input"
                placeholder={t('customersLastName')}
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              />
              <input
                className="input"
                placeholder={t('customersEmail')}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              <input
                className="input"
                placeholder={t('customersPhone')}
                value={form.phone}
                onChange={(e) =>
                  setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 15) })
                }
              />
              <input
                className="input sm:col-span-2"
                placeholder={t('customersAddress')}
                value={form.defaultAddress}
                onChange={(e) => setForm({ ...form, defaultAddress: e.target.value })}
              />
              <input
                className="input"
                placeholder={t('customersZip')}
                value={form.defaultZip}
                onChange={(e) => setForm({ ...form, defaultZip: e.target.value })}
              />
              <input
                className="input"
                placeholder={t('customersCity')}
                value={form.defaultCity}
                onChange={(e) => setForm({ ...form, defaultCity: e.target.value })}
              />
              <select
                className="input sm:col-span-2"
                value={form.membershipPlanId}
                onChange={(e) => setForm({ ...form, membershipPlanId: e.target.value })}
              >
                <option value="">{t('webPosCustomerNoLevel')}</option>
                {(profile.membershipPlans || []).map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.label}
                    {plan.type === 'discount' && plan.discountPercent
                      ? ` (−${plan.discountPercent}%)`
                      : ''}
                  </option>
                ))}
              </select>
              <textarea
                className="input sm:col-span-2 min-h-[4rem]"
                placeholder={t('customersAllergies')}
                value={form.allergies}
                onChange={(e) => setForm({ ...form, allergies: e.target.value })}
              />
              <textarea
                className="input sm:col-span-2 min-h-[4rem]"
                placeholder={t('customersHabits')}
                value={form.habits}
                onChange={(e) => setForm({ ...form, habits: e.target.value })}
              />
              <button
                type="button"
                className="btn-primary sm:col-span-2"
                disabled={saving}
                onClick={() => void save()}
              >
                {saving ? t('saving') : t('customersSave')}
              </button>
            </div>
          )}
        </div>
        <div className="flex justify-between gap-2 border-t px-4 py-3">
          <button type="button" className="btn-secondary text-sm" onClick={onChangeCustomer}>
            {t('webPosChangeCustomer')}
          </button>
          <button type="button" className="btn-secondary text-sm" onClick={onClose}>
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
}
