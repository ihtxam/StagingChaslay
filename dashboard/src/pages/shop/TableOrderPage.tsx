import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { CreditCard, Plus, ShoppingBag } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { resolveShopKey } from '@/lib/shop-cart';
import ShopThemeShell from '@/components/shop/ShopThemeShell';
import { useShopCmsTheme } from '@/hooks/useShopCmsTheme';
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

export default function TableOrderPage() {
  const { t } = useI18n();
  const { merchantSlug, tableId } = useParams<{ merchantSlug: string; tableId: string }>();
  const [searchParams] = useSearchParams();
  const signedAccess = searchParams.get('s') || '';
  const wantPay = searchParams.get('paid') === '1';
  const shopKey = useMemo(() => resolveShopKey(merchantSlug), [merchantSlug]);
  const cmsTheme = useShopCmsTheme(shopKey);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [menu, setMenu] = useState<MenuCategory[]>([]);
  const [tableLabel, setTableLabel] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [orders, setOrders] = useState<SessionOrder[]>([]);
  const [runningTotal, setRunningTotal] = useState(0);
  const [payAtTableEnabled, setPayAtTableEnabled] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [modifierProduct, setModifierProduct] = useState<ShopProductForModifiers | null>(null);
  const [notes, setNotes] = useState('');
  const [payOpen, setPayOpen] = useState(false);
  const [session, setSession] = useState<PaymentSession | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [payMsg, setPayMsg] = useState('');
  const [paying, setPaying] = useState(false);
  const dropinRef = useRef<HTMLDivElement | null>(null);
  const dropinMounted = useRef(false);

  const loadSession = useCallback(async () => {
    if (!shopKey || !tableId) return;
    const sessionParams = signedAccess ? { s: signedAccess } : undefined;
    const [sessionRes, menuRes] = await Promise.all([
      axios.get(`/api/shop/${shopKey}/table/${tableId}/session`, { params: sessionParams }),
      axios.get(`/api/shop/${shopKey}/menu`, { params: { channel: 'qr_table', table: tableId } }),
    ]);
    const sessionData = sessionRes.data;
    setTableLabel(sessionData.table?.label || tableId);
    setSessionToken(sessionData.session?.token || '');
    setOrders(sessionData.orders || []);
    setRunningTotal(Number(sessionData.runningTotal || 0));
    setPayAtTableEnabled(!!sessionData.settings?.qrPayAtTableEnabled);
    setMenu(menuRes.data.data || []);
  }, [shopKey, tableId, signedAccess]);

  useEffect(() => {
    void (async () => {
      try {
        await loadSession();
      } catch (e: unknown) {
        const err = e as { response?: { data?: { error?: string } } };
        toast.error(err.response?.data?.error || t('tableOrderLoadFailed'));
      } finally {
        setLoading(false);
      }
    })();
  }, [loadSession, t]);

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
        });
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
    if (!session?.sessionData || !session.clientKey || !dropinRef.current || dropinMounted.current) {
      return;
    }
    let cancelled = false;

    void (async () => {
      try {
        await import(/* @vite-ignore */ '@adyen/adyen-web/dist/adyen.css').catch(() => undefined);
        const AdyenCheckout = (await import('@adyen/adyen-web')).default;
        if (cancelled || !dropinRef.current) return;

        const checkout = await AdyenCheckout({
          environment: session.environment === 'live' ? 'live' : 'test',
          clientKey: session.clientKey,
          session: { id: session.id, sessionData: session.sessionData },
          onPaymentCompleted: async () => {
            setPayMsg(t('shopPaymentCompleted'));
            await axios.post(`/api/shop/${shopKey}/table/${tableId}/confirm-payment`, {
              tableSessionToken: sessionToken,
              resultCode: 'Authorised',
            });
            setPayOpen(false);
            setSession(null);
            dropinMounted.current = false;
            await loadSession();
          },
          onError: (err: { message?: string }) =>
            setPayMsg(err.message || t('shopPaymentFailed')),
        } as Parameters<typeof AdyenCheckout>[0]);

        checkout.create('dropin').mount(dropinRef.current);
        dropinMounted.current = true;
      } catch {
        setDemoMode(true);
        setPayMsg(t('shopCardFormUnavailable'));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, shopKey, tableId, sessionToken, loadSession, t]);

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
        customerName: tableLabel ? `Table ${tableLabel}` : 'Table guest',
        customerPhone: 'QR',
        notes: notes.trim() || undefined,
        paymentMethod: 'pay_later',
        guestCheckout: true,
      });
      toast.success(t('tableOrderSubmitted'));
      setCart([]);
      setNotes('');
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
    <ShopThemeShell shopKey={shopKey} cmsTheme={cmsTheme}>
      <div className="mx-auto max-w-lg min-h-screen bg-white pb-28">
        <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/95 px-4 py-3 backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            {t('tableOrderTitle')}
          </p>
          <h1 className="text-xl font-bold text-stone-900">
            {t('tableOrderTableLabel').replace('{label}', tableLabel)}
          </h1>
        </header>

        {orders.length > 0 ? (
          <section className="border-b border-stone-100 px-4 py-4">
            <h2 className="text-sm font-bold text-stone-800">{t('tableOrderHistory')}</h2>
            <div className="mt-2 space-y-2">
              {orders.map((o) => (
                <div key={o.id} className="rounded-lg border border-stone-200 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">#{o.orderNumber}</span>
                    <span className="text-xs uppercase text-stone-500">{o.status}</span>
                  </div>
                  <ul className="mt-1 text-stone-600">
                    {o.items.map((item, idx) => (
                      <li key={`${o.id}-${idx}`}>
                        {item.quantity}× {item.name}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 font-semibold tabular-nums">{o.total.toFixed(2)}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-sm font-bold">
                {t('tableOrderRunningTotal')}: {runningTotal.toFixed(2)}
              </p>
              {payAtTableEnabled && runningTotal > 0 ? (
                <button
                  type="button"
                  className="btn-primary inline-flex items-center gap-1.5 px-3 py-2 text-sm"
                  onClick={() => setPayOpen(true)}
                >
                  <CreditCard size={16} />
                  {t('tableOrderPayNow')}
                </button>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className="px-4 py-4 space-y-4">
          {menu.map((cat) => (
            <div key={cat.id}>
              <h2 className="text-sm font-bold text-stone-800">{cat.name}</h2>
              <div className="mt-2 space-y-2">
                {cat.items.map((item) => (
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
                ))}
              </div>
            </div>
          ))}
        </section>

        {cart.length > 0 ? (
          <div className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white p-4 shadow-lg">
            <div className="mx-auto max-w-lg space-y-2">
              <div className="flex items-center justify-between text-sm font-semibold">
                <span className="inline-flex items-center gap-1.5">
                  <ShoppingBag size={16} />
                  {t('tableOrderCartCount').replace('{n}', String(cart.length))}
                </span>
                <span className="tabular-nums">{cartTotal.toFixed(2)}</span>
              </div>
              <textarea
                className="input w-full text-sm"
                rows={2}
                placeholder={t('tableOrderNotesPlaceholder')}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <button
                type="button"
                disabled={submitting}
                onClick={() => void submitOrder()}
                className="btn-primary w-full py-3"
              >
                {submitting ? t('loading') : t('tableOrderSendToKitchen')}
              </button>
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
                {t('tableOrderPayAmount').replace('{amount}', runningTotal.toFixed(2))}
              </p>
              {payMsg ? <p className="mt-2 text-sm text-amber-700">{payMsg}</p> : null}
              <div ref={dropinRef} className="mt-4 min-h-[120px]" />
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
