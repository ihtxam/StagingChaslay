import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { mountAdyenDropin, normalizeAdyenPaymentSession, formatAdyenError } from '@/lib/adyen-checkout';
import { useI18n } from '@/lib/i18n';

type Plan = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  priceMonthly: string;
  priceYearly?: string | null;
  currency: string;
  maxDevices: number;
  maxPosPosts?: number;
  maxWaiterPosts?: number;
  maxStaff?: number;
  features?: string[] | null;
  edition?: { id: string; name: string } | null;
  includedAddons?: {
    inventory?: boolean;
    signage?: boolean;
    kds?: boolean;
    ods?: boolean;
  } | null;
};

type Addon = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  addonKey: string;
  priceMonthly: string;
  priceYearly?: string | null;
  currency: string;
  quantity: number;
};

type MerchantBilling = {
  subscriptionPlan?: string;
  subscriptionEndsAt?: string | null;
  editionName?: string | null;
  maxPosPosts?: number;
  maxWaiterPosts?: number;
  maxStaff?: number;
  inventoryAddonEnabled?: boolean;
  signageAddonEnabled?: boolean;
  kdsAddonEnabled?: boolean;
  odsAddonEnabled?: boolean;
  kioskAddonEnabled?: boolean;
  justEatAddonEnabled?: boolean;
  uberEatsAddonEnabled?: boolean;
  storekeeperAddonEnabled?: boolean;
};

type PaymentSession = {
  id: string;
  sessionData: string;
  clientKey: string;
  environment: string;
};

type BillingPayment = {
  id: string;
  amount: string;
  currency: string;
  billingCycle: string;
  status: string;
  paidAt?: string | null;
  createdAt: string;
  plan?: { name: string; slug: string } | null;
};

function money(amount: string | number, currency = 'CHF') {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency || 'CHF',
  }).format(Number(amount));
}

function limitLabel(n?: number) {
  return n === 0 || n == null ? 'Unlimited' : String(n);
}

export default function Billing() {
  const { t, formatDate, formatDateTime } = useI18n();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [activeAddonIds, setActiveAddonIds] = useState<Set<string>>(new Set());
  const [merchant, setMerchant] = useState<MerchantBilling | null>(null);
  const [currentSlug, setCurrentSlug] = useState<string>('free');
  const [subscriptionEndsAt, setSubscriptionEndsAt] = useState<string | null>(null);
  const [payments, setPayments] = useState<BillingPayment[]>([]);
  const [adyenReady, setAdyenReady] = useState(false);
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [checkoutPlan, setCheckoutPlan] = useState<Plan | null>(null);
  const [checkoutAddon, setCheckoutAddon] = useState<Addon | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [checkoutKind, setCheckoutKind] = useState<'plan' | 'addon'>('plan');
  const [session, setSession] = useState<PaymentSession | null>(null);
  const [payMsg, setPayMsg] = useState('');
  const [payDebug, setPayDebug] = useState('');
  const [busy, setBusy] = useState(false);
  const [dropinEl, setDropinEl] = useState<HTMLDivElement | null>(null);
  const dropinMounted = useRef(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/merchant/billing');
      setPlans(res.data.plans || []);
      setAddons(res.data.addons || []);
      const active = new Set<string>(
        (res.data.activeAddons || []).map(
          (row: { addonId?: string; addon?: { id: string } }) => row.addonId || row.addon?.id
        ).filter(Boolean)
      );
      setActiveAddonIds(active);
      setMerchant(res.data.merchant || null);
      setCurrentSlug(res.data.merchant?.subscriptionPlan || 'free');
      setSubscriptionEndsAt(res.data.merchant?.subscriptionEndsAt || null);
      setPayments(res.data.payments || []);
      setAdyenReady(!!res.data.platformAdyenConfigured);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to load billing');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!session?.sessionData || !session.clientKey || !dropinEl || dropinMounted.current) {
      return;
    }
    let cancelled = false;

    void (async () => {
      try {
        await mountAdyenDropin({
          session,
          container: dropinEl,
          onPaymentCompleted: async (result) => {
            if (cancelled) return;
            setPayMsg(t('billingActivating'));
            try {
              const confirmUrl =
                checkoutKind === 'addon' ? '/merchant/billing/addon/confirm' : '/merchant/billing/confirm';
              await api.post(confirmUrl, {
                paymentId,
                resultCode: result?.resultCode || 'Authorised',
              });
              toast.success(t('billingActivated'));
              setCheckoutPlan(null);
              setCheckoutAddon(null);
              setSession(null);
              setPaymentId(null);
              dropinMounted.current = false;
              await load();
            } catch (err: any) {
              toast.error(err.response?.data?.error || 'Payment received but activation failed');
            }
          },
          onError: (err) => {
            if (!cancelled) {
              setPayMsg(formatAdyenError(err, 'dropin') || 'Payment failed');
            }
          },
        });
        if (!cancelled) dropinMounted.current = true;
      } catch (err) {
        if (!cancelled) {
          setPayMsg(formatAdyenError(err, 'dropin'));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, paymentId, dropinEl, load, t, checkoutKind]);

  const resetCheckout = () => {
    setCheckoutPlan(null);
    setCheckoutAddon(null);
    setSession(null);
    setPaymentId(null);
    dropinMounted.current = false;
  };

  const startPlanCheckout = async (plan: Plan) => {
    setBusy(true);
    setPayMsg('');
    setCheckoutKind('plan');
    setCheckoutAddon(null);
    setSession(null);
    setPaymentId(null);
    dropinMounted.current = false;
    setCheckoutPlan(plan);
    try {
      const res = await api.post('/merchant/billing/checkout', {
        planId: plan.id,
        billingCycle: cycle,
        returnUrl: `${window.location.origin}/merchant/billing`,
      });

      if (res.data.free) {
        toast.success(t('billingFreeActivated').replace('{name}', plan.name));
        resetCheckout();
        await load();
        return;
      }

      setPaymentId(res.data.payment?.id || null);
      const normalized = normalizeAdyenPaymentSession(res.data.paymentSession);
      if (!normalized) throw new Error('Invalid payment session');
      setSession(normalized);
    } catch (err: any) {
      resetCheckout();
      toast.error(err.response?.data?.error || 'Checkout failed');
    } finally {
      setBusy(false);
    }
  };

  const startAddonCheckout = async (addon: Addon) => {
    setBusy(true);
    setPayMsg('');
    setCheckoutKind('addon');
    setCheckoutAddon(addon);
    setCheckoutPlan(null);
    setSession(null);
    setPaymentId(null);
    dropinMounted.current = false;
    try {
      const res = await api.post('/merchant/billing/addon/checkout', {
        addonId: addon.id,
        billingCycle: cycle,
        returnUrl: `${window.location.origin}/merchant/billing`,
      });

      if (res.data.free) {
        toast.success(`Add-on activated: ${addon.name}`);
        resetCheckout();
        await load();
        return;
      }

      setPaymentId(res.data.payment?.id || null);
      const normalized = normalizeAdyenPaymentSession(res.data.paymentSession);
      if (!normalized) throw new Error('Invalid payment session');
      setSession(normalized);
    } catch (err: any) {
      resetCheckout();
      toast.error(err.response?.data?.error || 'Add-on checkout failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="card">Loading billing…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <h1 className="text-2xl font-bold">{t('billingAndSubscription')}</h1>
        <p className="text-gray-600 mt-1">
          {t('billingCurrentSubscription')}: <strong className="capitalize">{currentSlug}</strong>
          {merchant?.editionName ? ` · ${merchant.editionName}` : null}
          {subscriptionEndsAt ? ` · renews / ends ${formatDate(subscriptionEndsAt)}` : null}
        </p>
        {merchant ? (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm">
            <div className="rounded border px-3 py-2 bg-slate-50">
              <div className="text-gray-500">POS stations</div>
              <div className="font-semibold">{limitLabel(merchant.maxPosPosts)}</div>
            </div>
            <div className="rounded border px-3 py-2 bg-slate-50">
              <div className="text-gray-500">Waiter devices</div>
              <div className="font-semibold">{limitLabel(merchant.maxWaiterPosts)}</div>
            </div>
            <div className="rounded border px-3 py-2 bg-slate-50">
              <div className="text-gray-500">Staff users</div>
              <div className="font-semibold">{limitLabel(merchant.maxStaff)}</div>
            </div>
            <div className="rounded border px-3 py-2 bg-slate-50">
              <div className="text-gray-500">Active add-ons</div>
              <div className="font-semibold text-xs mt-0.5">
                {[
                  merchant.inventoryAddonEnabled && 'Inventory',
                  merchant.signageAddonEnabled && 'Signage',
                  merchant.kdsAddonEnabled && 'KDS',
                  merchant.kioskAddonEnabled && 'Kiosk',
                  merchant.odsAddonEnabled && 'ODS',
                  merchant.justEatAddonEnabled && 'Just Eat',
                  merchant.uberEatsAddonEnabled && 'Uber Eats',
                  merchant.storekeeperAddonEnabled && 'Storekeeper',
                ]
                  .filter(Boolean)
                  .join(', ') || 'None'}
              </div>
            </div>
          </div>
        ) : null}
        {!adyenReady && (
          <p className="mt-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            {t('billingAdyenNotConfigured')}
          </p>
        )}
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold">Packages</h2>
          <div className="inline-flex rounded border overflow-hidden text-sm">
            <button
              type="button"
              className={`px-3 py-1.5 ${cycle === 'monthly' ? 'bg-slate-900 text-white' : 'bg-white'}`}
              onClick={() => setCycle('monthly')}
            >
              Monthly
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 ${cycle === 'yearly' ? 'bg-slate-900 text-white' : 'bg-white'}`}
              onClick={() => setCycle('yearly')}
            >
              Yearly
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {plans.map((plan) => {
            const price =
              cycle === 'yearly'
                ? plan.priceYearly != null && plan.priceYearly !== ''
                  ? Number(plan.priceYearly)
                  : Number(plan.priceMonthly) * 12
                : Number(plan.priceMonthly);
            const isCurrent = plan.slug === currentSlug;
            return (
              <div
                key={plan.id}
                className={`border rounded-lg p-4 flex flex-col ${
                  isCurrent ? 'border-emerald-500 ring-1 ring-emerald-200' : 'border-gray-200'
                }`}
              >
                <div className="font-semibold text-lg">{plan.name}</div>
                {plan.edition?.name ? (
                  <div className="text-xs text-gray-500 mt-0.5">{plan.edition.name}</div>
                ) : null}
                <div className="text-2xl font-bold mt-2">
                  {money(price, plan.currency)}
                  <span className="text-sm font-normal text-gray-500">
                    /{cycle === 'yearly' ? 'year' : 'month'}
                  </span>
                </div>
                {plan.description && <p className="text-sm text-gray-600 mt-2">{plan.description}</p>}
                <ul className="mt-3 space-y-1 text-sm text-gray-700 flex-1">
                  {(plan.features || []).map((f) => (
                    <li key={f}>• {f}</li>
                  ))}
                  <li>
                    • POS {limitLabel(plan.maxPosPosts)} · Waiter {limitLabel(plan.maxWaiterPosts)} · Staff{' '}
                    {limitLabel(plan.maxStaff)}
                  </li>
                </ul>
                <button
                  type="button"
                  disabled={busy || isCurrent}
                  className="btn btn-primary mt-4 w-full disabled:opacity-50"
                  onClick={() => void startPlanCheckout(plan)}
                >
                  {isCurrent
                    ? t('billingCurrentSubscriptionBtn')
                    : price <= 0
                      ? t('billingActivateFree')
                      : t('billingBuyWithAdyen')}
                </button>
              </div>
            );
          })}
        </div>
        {!plans.length && <p className="text-gray-500 text-sm">{t('billingNoSubscriptions')}</p>}
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Add-ons</h2>
        <p className="text-sm text-gray-600 mb-4">
          Optional extras on top of your package — inventory, kitchen screens, extra stations, and more.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {addons.map((addon) => {
            const price =
              cycle === 'yearly'
                ? addon.priceYearly != null && addon.priceYearly !== ''
                  ? Number(addon.priceYearly)
                  : Number(addon.priceMonthly) * 12
                : Number(addon.priceMonthly);
            const isActive = activeAddonIds.has(addon.id);
            return (
              <div key={addon.id} className="border rounded-lg p-4 flex flex-col border-gray-200">
                <div className="font-semibold">{addon.name}</div>
                <div className="text-xl font-bold mt-1">
                  {money(price, addon.currency)}
                  <span className="text-sm font-normal text-gray-500">
                    /{cycle === 'yearly' ? 'year' : 'month'}
                  </span>
                </div>
                {addon.description ? <p className="text-sm text-gray-600 mt-2 flex-1">{addon.description}</p> : <div className="flex-1" />}
                <button
                  type="button"
                  disabled={busy || isActive}
                  className="btn mt-4 w-full disabled:opacity-50"
                  onClick={() => void startAddonCheckout(addon)}
                >
                  {isActive ? 'Active' : price <= 0 ? 'Activate' : 'Subscribe'}
                </button>
              </div>
            );
          })}
        </div>
        {!addons.length && <p className="text-gray-500 text-sm">No add-ons available.</p>}
      </div>

      {(checkoutPlan || checkoutAddon) && (
        <div className="card">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h2 className="text-lg font-semibold">
                Pay for {checkoutPlan?.name || checkoutAddon?.name}
              </h2>
              <p className="text-sm text-gray-600">Secure checkout via Adyen.</p>
            </div>
            <button type="button" className="btn" onClick={resetCheckout}>
              Cancel
            </button>
          </div>
          {session ? (
            <div ref={setDropinEl} className="min-h-[140px]" />
          ) : (
            <p className="text-sm text-gray-500">Preparing checkout…</p>
          )}
          {payMsg && (
            <p className="text-sm mt-3 text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
              {payMsg}
              {payDebug ? (
                <span className="block mt-1 text-xs text-red-600/80 font-mono">{payDebug}</span>
              ) : null}
            </p>
          )}
        </div>
      )}

      <div className="card">
        <h2 className="text-lg font-semibold mb-3">{t('billingPaymentHistory')}</h2>
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">{t('billingSubscriptionCol')}</th>
                <th className="py-2 pr-3">Cycle</th>
                <th className="py-2 pr-3">Amount</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="py-2 pr-3">{formatDateTime(p.paidAt || p.createdAt)}</td>
                  <td className="py-2 pr-3">{p.plan?.name || '-'}</td>
                  <td className="py-2 pr-3 capitalize">{p.billingCycle}</td>
                  <td className="py-2 pr-3">{money(p.amount, p.currency)}</td>
                  <td className="py-2 capitalize">{p.status}</td>
                </tr>
              ))}
              {!payments.length && (
                <tr>
                  <td colSpan={5} className="py-4 text-gray-500 text-center">
                    {t('billingNoPayments')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
