import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Bell, ChevronDown, CreditCard, Plus, ShoppingBag } from 'lucide-react';
import { formatOrderNumberDisplay } from '@/lib/order-number';
import { useI18n } from '@/lib/i18n';
import { customerShopError } from '@/lib/shop-public-error';
import { resolveShopKey, shopMenuApiPath, resolveShopLocationSlug, shopBasePath, shopCustomerAuthConfig } from '@/lib/shop-cart';
import ShopThemeShell from '@/components/shop/ShopThemeShell';
import { useShopCmsTheme } from '@/hooks/useShopCmsTheme';
import {
  adyenLocaleFor,
  formatAdyenError,
  mountAdyenDropin,
  shopCheckoutOriginPayload,
} from '@/lib/adyen-checkout';
import ShopProductModifiersModal, {
  productHasModifiers,
  type ShopProductForModifiers,
} from '@/components/shop/ShopProductModifiersModal';

type MenuCategory = {
  id: string;
  name: string;
  items: Array<{
    id: string;
    name: string;
    price: number;
    description?: string;
    image?: string;
    modifierGroups?: ShopProductForModifiers['modifierGroups'];
  }>;
};

type SessionOrder = {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  createdAt: string;
  items: Array<{ name: string; quantity: number; totalPrice: number }>;
};

type CartLine = {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  selectedExtras?: Array<{ id: string; name: string; price: number }>;
};

type PaymentSession = {
  id: string;
  sessionData: string;
  clientKey: string;
  environment?: string;
};

const WAITER_COOLDOWN_MS = 60_000;

function tableSessionStorageKey(shopKey: string, tableId: string) {
  return `table_qr_session_v1:${shopKey}:${tableId}`;
}

function waiterCallStorageKey(tableId: string) {
  return `table_qr_waiter_call_v1:${tableId}`;
}

function orderStatusLabel(status: string, t: (key: string) => string): string {
  const s = String(status || '').toLowerCase();
  if (s === 'preparing' || s === 'accepted') return t('tableOrderStatusPreparing');
  if (s === 'ready') return t('tableOrderStatusReady');
  if (s === 'pending' || s === 'pending_approval') return t('tableOrderStatusPending');
  if (s === 'completed') return t('tableOrderStatusReady');
  return status;
}

export default function TableOrderPage() {
  const { t, locale } = useI18n();
  const { merchantSlug, tableId, locationSlug: routeLocationSlug } = useParams<{
    merchantSlug: string;
    tableId: string;
    locationSlug?: string;
  }>();
  const [searchParams] = useSearchParams();
  const signedAccess = searchParams.get('s') || '';
  const wantPay = searchParams.get('paid') === '1';
  const locationSlug =
    resolveShopLocationSlug({ locationSlug: routeLocationSlug }) ||
    searchParams.get('location')?.trim() ||
    null;
  const shopKey = useMemo(() => resolveShopKey(merchantSlug), [merchantSlug]);
  const { theme: cmsTheme, site: shopSite } = useShopCmsTheme(shopKey);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [menu, setMenu] = useState<MenuCategory[]>([]);
  const [tableLabel, setTableLabel] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [orders, setOrders] = useState<SessionOrder[]>([]);
  const [runningTotal, setRunningTotal] = useState(0);
  const [payAtTableEnabled, setPayAtTableEnabled] = useState(false);
  const [photoMenuEnabled, setPhotoMenuEnabled] = useState(true);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [modifierProduct, setModifierProduct] = useState<ShopProductForModifiers | null>(null);
  const [notes, setNotes] = useState('');
  const [payOpen, setPayOpen] = useState(false);
  const [session, setSession] = useState<PaymentSession | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [payMsg, setPayMsg] = useState('');
  const [paying, setPaying] = useState(false);
  const [dropinEl, setDropinEl] = useState<HTMLDivElement | null>(null);
  const dropinMounted = useRef(false);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [cartOpen, setCartOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [waiterOpen, setWaiterOpen] = useState(false);
  const [tipChooserOpen, setTipChooserOpen] = useState(false);
  const [tipAmount, setTipAmount] = useState(0);

  const loadSession = useCallback(async () => {
    if (!shopKey || !tableId) return;
    const storedToken =
      typeof sessionStorage !== 'undefined'
        ? sessionStorage.getItem(tableSessionStorageKey(shopKey, tableId)) || ''
        : '';
    const sessionParams = signedAccess ? { s: signedAccess } : undefined;
    const [sessionRes, menuRes] = await Promise.all([
      axios.get(`/api/shop/${shopKey}/table/${tableId}/session`, { params: sessionParams }),
      axios.get(shopMenuApiPath(shopKey, locationSlug), {
        params: { channel: 'qr_table', table: tableId },
      }),
    ]);
    const sessionData = sessionRes.data;
    setTableLabel(sessionData.table?.label || tableId);
    const token = sessionData.session?.token || storedToken || '';
    setSessionToken(token);
    if (token && typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(tableSessionStorageKey(shopKey, tableId), token);
    }
    setOrders(sessionData.orders || []);
    setRunningTotal(Number(sessionData.runningTotal || 0));
    setPayAtTableEnabled(!!sessionData.settings?.qrPayAtTableEnabled);
    setPhotoMenuEnabled(sessionData.settings?.photoMenuEnabled !== false);
    setMenu(menuRes.data.data || []);
  }, [shopKey, tableId, signedAccess, locationSlug]);

  useEffect(() => {
    void (async () => {
      try {
        await loadSession();
      } catch (e: unknown) {
        const err = e as { response?: { data?: { error?: string } } };
        toast.error(customerShopError(err.response?.data?.error, t('tableOrderLoadFailed')));
      } finally {
        setLoading(false);
      }
    })();
  }, [loadSession, t]);

  useEffect(() => {
    if (!shopKey || !tableId) return;
    const id = window.setInterval(() => {
      void loadSession();
    }, 8000);
    return () => window.clearInterval(id);
  }, [shopKey, tableId, loadSession]);

  useEffect(() => {
    if (wantPay && payAtTableEnabled && runningTotal > 0) {
      setPayOpen(true);
    }
  }, [wantPay, payAtTableEnabled, runningTotal]);

  useEffect(() => {
    if (!payOpen || !payAtTableEnabled || !shopKey || !tableId || !sessionToken) return;
    void (async () => {
      try {
        const res = await axios.post(`/api/shop/${shopKey}/table/${tableId}/payment-session`, {
          tableSessionToken: sessionToken,
          ...shopCheckoutOriginPayload(shopBasePath(shopKey, locationSlug)),
        }, shopCustomerAuthConfig(shopKey));
        if (res.data.alreadyPaid) {
          await loadSession();
          setPayOpen(false);
          return;
        }
        setSession(res.data.paymentSession);
        setDemoMode(false);
      } catch (e: unknown) {
        setDemoMode(true);
        const err = e as { response?: { data?: { error?: string } } };
        setPayMsg(err.response?.data?.error || t('shopCardNotConfigured'));
      }
    })();
  }, [payOpen, payAtTableEnabled, shopKey, tableId, sessionToken, loadSession, t]);

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
          locale: adyenLocaleFor(locale),
          credentialSource: 'merchant',
          onPaymentCompleted: async (result) => {
            if (cancelled) return;
            setPayMsg(t('shopPaymentCompleted'));
            await axios.post(`/api/shop/${shopKey}/table/${tableId}/confirm-payment`, {
              tableSessionToken: sessionToken,
              resultCode: result?.resultCode || 'Authorised',
            });
            setPayOpen(false);
            setSession(null);
            dropinMounted.current = false;
            await loadSession();
          },
          onError: (err) =>
            setPayMsg(formatAdyenError(err, 'dropin', 'merchant') || t('shopPaymentFailed')),
        });
        if (!cancelled) dropinMounted.current = true;
      } catch (err) {
        setDemoMode(true);
        setPayMsg(formatAdyenError(err, 'dropin', 'merchant') || t('shopCardFormUnavailable'));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, dropinEl, shopKey, tableId, sessionToken, loadSession, t, locale]);

  const confirmDemoPayment = async () => {
    setPaying(true);
    setPayMsg('');
    try {
      await axios.post(`/api/shop/${shopKey}/table/${tableId}/confirm-payment`, {
        tableSessionToken: sessionToken,
        resultCode: 'Authorised',
        demo: true,
      });
      setPayMsg(t('shopPaymentConfirmed'));
      setPayOpen(false);
      setSession(null);
      dropinMounted.current = false;
      await loadSession();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setPayMsg(err.response?.data?.error || t('shopConfirmFailed'));
    } finally {
      setPaying(false);
    }
  };

  const cartTotal = useMemo(
    () =>
      cart.reduce((sum, line) => {
        const extras = (line.selectedExtras || []).reduce((s, e) => s + e.price, 0);
        return sum + (line.price + extras) * line.quantity;
      }, 0),
    [cart]
  );

  const addProduct = (item: MenuCategory['items'][number]) => {
    if (productHasModifiers(item as ShopProductForModifiers)) {
      setModifierProduct(item as ShopProductForModifiers);
      return;
    }
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === item.id && !l.selectedExtras?.length);
      if (existing) {
        return prev.map((l) =>
          l.id === existing.id ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [
        ...prev,
        {
          id: `${item.id}-${Date.now()}`,
          productId: item.id,
          name: item.name,
          price: item.price,
          quantity: 1,
        },
      ];
    });
  };

  const toggleCategory = (catId: string) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  };

  const callWaiter = async (messageKey: string) => {
    if (!shopKey || !tableId || !sessionToken) return;
    const last =
      typeof localStorage !== 'undefined'
        ? Number(localStorage.getItem(waiterCallStorageKey(tableId)) || 0)
        : 0;
    if (Date.now() - last < WAITER_COOLDOWN_MS) {
      toast.error(t('tableOrderWaiterCallCooldown'));
      return;
    }
    try {
      await axios.post(`/api/shop/${shopKey}/table/${tableId}/waiter-call`, {
        tableSessionToken: sessionToken,
        messageKey,
      });
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(waiterCallStorageKey(tableId), String(Date.now()));
      }
      toast.success(t('tableOrderWaiterCallSent'));
      setWaiterOpen(false);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || t('tableOrderWaiterCallFailed'));
    }
  };

  const submitOrder = async () => {
    if (!cart.length || !tableId) return;
    setSubmitting(true);
    try {
      await axios.post(`/api/shop/${shopKey}/orders`, {
        items: cart.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          selectedExtras: (line.selectedExtras || []).map((e) => ({ id: e.id })),
        })),
        fulfillmentChannel: 'dine_in',
        tableId,
        tableSessionToken: sessionToken,
        orderSource: 'qr_table',
        locationSlug: locationSlug || undefined,
        customerName: tableLabel ? `Table ${tableLabel}` : 'Table guest',
        customerPhone: 'QR',
        notes: notes.trim() || undefined,
        paymentMethod: 'pay_later',
        guestCheckout: true,
      });
      toast.success(t('tableOrderSubmitted'));
      setCart([]);
      setNotes('');
      setCartOpen(false);
      await loadSession();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || t('tableOrderSubmitFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 text-stone-600">
        {t('loading')}
      </div>
    );
  }

  return (
    <ShopThemeShell theme={cmsTheme} site={shopSite}>
      <div className={`mx-auto min-h-screen bg-white pb-28 ${photoMenuEnabled ? 'max-w-xl' : 'max-w-lg'}`}>
        <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/95 px-4 py-3 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                {t('tableOrderTitle')}
              </p>
              <h1 className="text-xl font-bold text-stone-900">
                {t('tableOrderTableLabel').replace('{label}', tableLabel)}
              </h1>
            </div>
            <div className="flex items-center gap-1.5">
              {orders.length > 0 ? (
                <div className="relative">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-2 text-xs font-semibold text-stone-700"
                    onClick={() => setOrdersOpen((v) => !v)}
                  >
                    {t('tableOrderHistory')}
                    <ChevronDown size={14} className={ordersOpen ? 'rotate-180' : ''} />
                  </button>
                  {ordersOpen ? (
                    <div className="absolute right-0 z-20 mt-1 w-[min(18rem,calc(100vw-2rem))] max-h-72 overflow-y-auto rounded-xl border border-stone-200 bg-white p-2 shadow-lg">
                      {orders.map((o) => (
                        <div key={o.id} className="rounded-lg border border-stone-100 p-2 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold">
                              #{formatOrderNumberDisplay(o.orderNumber)}
                            </span>
                            <span className="text-[10px] uppercase text-stone-500">
                              {orderStatusLabel(o.status, t)}
                            </span>
                          </div>
                          <p className="mt-1 font-semibold tabular-nums">{o.total.toFixed(2)}</p>
                        </div>
                      ))}
                      <p className="mt-2 px-1 text-xs font-bold">
                        {t('tableOrderRunningTotal')}: {runningTotal.toFixed(2)}
                      </p>
                      {payAtTableEnabled && runningTotal > 0 ? (
                        <button
                          type="button"
                          className="btn-primary mt-2 w-full py-2 text-xs"
                          onClick={() => {
                            setOrdersOpen(false);
                            setTipChooserOpen(true);
                          }}
                        >
                          {t('tableOrderPayNow')}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="relative">
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-stone-200 text-stone-700"
                  aria-label={t('tableOrderWaiterCall')}
                  onClick={() => setWaiterOpen((v) => !v)}
                >
                  <Bell size={16} />
                </button>
                {waiterOpen ? (
                  <div className="absolute right-0 z-20 mt-1 w-52 rounded-xl border border-stone-200 bg-white p-1 shadow-lg">
                    {(
                      [
                        ['please_come', t('tableOrderWaiterCallPleaseCome')],
                        ['bring_bill', t('tableOrderWaiterCallBringBill')],
                        ['need_help', t('tableOrderWaiterCallNeedHelp')],
                      ] as const
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        className="block w-full rounded-lg px-3 py-2 text-left text-xs font-medium text-stone-700 hover:bg-stone-50"
                        onClick={() => void callWaiter(key)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <section className="px-4 py-4 space-y-3">
          {menu.map((cat) => {
            const expanded = expandedCats.has(cat.id);
            return (
            <div key={cat.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-left"
                onClick={() => toggleCategory(cat.id)}
              >
                <h2 className="text-sm font-bold text-stone-800">{cat.name}</h2>
                <ChevronDown size={16} className={`text-stone-500 ${expanded ? 'rotate-180' : ''}`} />
              </button>
              {expanded ? (
              <div className={photoMenuEnabled ? 'mt-2 grid grid-cols-2 gap-2.5' : 'mt-2 space-y-2'}>
                {cat.items.map((item) =>
                  photoMenuEnabled ? (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => addProduct(item)}
                      className="overflow-hidden rounded-2xl border border-stone-200 bg-white text-left shadow-sm hover:border-stone-300"
                    >
                      <div className="aspect-[4/3] bg-stone-100">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-2xl font-bold text-stone-300">
                            {item.name.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="p-2.5">
                        <p className="line-clamp-2 text-sm font-semibold text-stone-900">{item.name}</p>
                        {item.description ? (
                          <p className="mt-0.5 line-clamp-2 text-[11px] text-stone-500">{item.description}</p>
                        ) : null}
                        <div className="mt-2 flex items-center justify-between gap-1">
                          <span className="text-sm font-semibold tabular-nums">{item.price.toFixed(2)}</span>
                          <Plus size={16} className="text-teal-600" />
                        </div>
                      </div>
                    </button>
                  ) : (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => addProduct(item)}
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-stone-200 p-3 text-left hover:bg-stone-50"
                    >
                      <div>
                        <p className="font-semibold text-stone-900">{item.name}</p>
                        {item.description ? (
                          <p className="text-xs text-stone-500 line-clamp-2">{item.description}</p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-semibold tabular-nums">{item.price.toFixed(2)}</span>
                        <Plus size={16} className="text-teal-600" />
                      </div>
                    </button>
                  )
                )}
              </div>
              ) : null}
            </div>
            );
          })}
        </section>

        {cart.length > 0 ? (
          <div className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white p-4 shadow-lg">
            <button
              type="button"
              className="mx-auto flex w-full max-w-lg items-center justify-between text-sm font-semibold"
              onClick={() => setCartOpen(true)}
            >
              <span className="inline-flex items-center gap-1.5">
                <ShoppingBag size={16} />
                {t('tableOrderCartCount').replace('{n}', String(cart.length))}
              </span>
              <span className="tabular-nums">{cartTotal.toFixed(2)}</span>
            </button>
          </div>
        ) : null}

        {cartOpen ? (
          <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 p-4 sm:items-center">
            <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl max-h-[85vh] overflow-y-auto">
              <h2 className="text-lg font-bold">{t('tableOrderCartTitle')}</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {cart.map((line) => (
                  <li key={line.id} className="flex justify-between gap-2">
                    <span>
                      {line.quantity}× {line.name}
                    </span>
                    <span className="tabular-nums font-semibold">
                      {((line.price + (line.selectedExtras || []).reduce((s, e) => s + e.price, 0)) *
                        line.quantity
                      ).toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
              <textarea
                className="input mt-3 w-full text-sm"
                rows={2}
                placeholder={t('tableOrderNotesPlaceholder')}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void submitOrder()}
                  className="btn-primary w-full py-3"
                >
                  {submitting ? t('loading') : t('tableOrderConfirmSend')}
                </button>
                <button
                  type="button"
                  className="w-full rounded-xl border border-stone-200 py-3 text-sm font-semibold"
                  onClick={() => setCartOpen(false)}
                >
                  {t('tableOrderAddMore')}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {tipChooserOpen ? (
          <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 p-4 sm:items-center">
            <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl">
              <h2 className="text-lg font-bold">{t('tableOrderTipTitle')}</h2>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="rounded-xl border border-stone-200 py-3 text-sm font-semibold"
                  onClick={() => {
                    setTipAmount(0);
                    setTipChooserOpen(false);
                    setPayOpen(true);
                  }}
                >
                  {t('tableOrderTipNone')}
                </button>
                {[1, 2, 5].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    className="rounded-xl border border-stone-200 py-3 text-sm font-semibold"
                    onClick={() => {
                      setTipAmount(Math.round(((runningTotal * pct) / 100) * 20) / 20);
                      setTipChooserOpen(false);
                      setPayOpen(true);
                    }}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {payOpen ? (
          <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 p-4 sm:items-center">
            <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-bold">{t('tableOrderPayTitle')}</h2>
                <button
                  type="button"
                  className="text-stone-500 hover:text-stone-800"
                  onClick={() => {
                    setPayOpen(false);
                    setSession(null);
                    dropinMounted.current = false;
                  }}
                >
                  ×
                </button>
              </div>
              <p className="mt-1 text-sm text-stone-600">
                {t('tableOrderPayAmount').replace(
                  '{amount}',
                  (runningTotal + tipAmount).toFixed(2)
                )}
              </p>
              {tipAmount > 0 ? (
                <p className="text-xs text-stone-500">
                  {t('shopTip')}: {tipAmount.toFixed(2)} CHF
                </p>
              ) : null}
              {payMsg ? <p className="mt-2 text-sm text-amber-700">{payMsg}</p> : null}
              <div ref={setDropinEl} className="mt-4 min-h-[120px]" />
              {demoMode ? (
                <button
                  type="button"
                  disabled={paying}
                  className="btn-primary mt-4 w-full py-3"
                  onClick={() => void confirmDemoPayment()}
                >
                  {paying ? t('loading') : t('tableOrderPayDemo')}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {modifierProduct ? (
          <ShopProductModifiersModal
            product={modifierProduct}
            onClose={() => setModifierProduct(null)}
            onConfirm={(extras, unitPrice) => {
              setCart((prev) => [
                ...prev,
                {
                  id: `${modifierProduct.id}-${Date.now()}`,
                  productId: modifierProduct.id,
                  name: modifierProduct.name,
                  price: unitPrice,
                  quantity: 1,
                  selectedExtras: extras,
                },
              ]);
              setModifierProduct(null);
            }}
          />
        ) : null}
      </div>
    </ShopThemeShell>
  );
}
