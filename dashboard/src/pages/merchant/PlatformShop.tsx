import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import api from '@/lib/api';
import { mountAdyenDropin, formatAdyenError } from '@/lib/adyen-checkout';
import { useI18n } from '@/lib/i18n';

type Product = {
  id: string;
  name: string;
  description?: string | null;
  price: string;
  discountPercent?: number | null;
  imageUrl?: string | null;
};

type Order = {
  id: string;
  status: string;
  paymentStatus: string;
  total: string;
  currency: string;
  createdAt: string;
  items: Array<{ name: string; quantity: number; unitPrice: number; lineTotal: number }>;
};

type PaymentSession = {
  id: string;
  sessionData: string;
  clientKey: string;
  environment: string;
};

function money(amount: string | number, currency = 'CHF') {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(amount));
}

function unitPrice(product: Product) {
  const base = Number(product.price) || 0;
  const pct = Math.min(100, Math.max(0, Number(product.discountPercent) || 0));
  if (!pct) return base;
  return Math.round(base * (1 - pct / 100) * 100) / 100;
}

export default function PlatformShop() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [voucherCode, setVoucherCode] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [checkoutOrderId, setCheckoutOrderId] = useState<string | null>(null);
  const [session, setSession] = useState<PaymentSession | null>(null);
  const [payMsg, setPayMsg] = useState('');
  const [dropinEl, setDropinEl] = useState<HTMLDivElement | null>(null);
  const dropinMounted = useRef(false);

  const load = useCallback(async () => {
    try {
      const [prodRes, ordRes] = await Promise.all([
        api.get('/merchant/platform-shop/products'),
        api.get('/merchant/platform-shop/orders'),
      ]);
      setProducts(prodRes.data.products || []);
      setOrders(ordRes.data.orders || []);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        t('platformShopLoadFailed');
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const orderId = searchParams.get('orderId');
    if (orderId) setCheckoutOrderId(orderId);
  }, [searchParams]);

  const cartLines = useMemo(() => {
    return products
      .filter((p) => (cart[p.id] || 0) > 0)
      .map((p) => ({
        product: p,
        qty: cart[p.id] || 0,
        unit: unitPrice(p),
        line: unitPrice(p) * (cart[p.id] || 0),
      }));
  }, [products, cart]);

  const cartTotal = useMemo(
    () => cartLines.reduce((sum, l) => sum + l.line, 0),
    [cartLines]
  );

  const addToCart = (productId: string) => {
    setCart((prev) => ({ ...prev, [productId]: (prev[productId] || 0) + 1 }));
  };

  const setQty = (productId: string, qty: number) => {
    setCart((prev) => {
      const next = { ...prev };
      if (qty <= 0) delete next[productId];
      else next[productId] = qty;
      return next;
    });
  };

  const startCheckout = async () => {
    if (!cartLines.length) {
      toast.error(t('platformShopCartEmpty'));
      return;
    }
    setBusy(true);
    setPayMsg('');
    try {
      const items = cartLines.map((l) => ({ productId: l.product.id, quantity: l.qty }));
      const res = await api.post('/merchant/platform-shop/checkout', {
        items,
        voucherCode: voucherCode.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      if (res.data.free) {
        toast.success(t('platformShopOrderPlaced'));
        setCart({});
        setVoucherCode('');
        setNotes('');
        setSession(null);
        setCheckoutOrderId(null);
        dropinMounted.current = false;
        await load();
        return;
      }
      setCheckoutOrderId(res.data.order?.id || null);
      setSession(res.data.paymentSession || null);
    } catch (err: unknown) {
      toast.error(
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          t('platformShopCheckoutFailed')
      );
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!session?.sessionData || !session.clientKey || !dropinEl || dropinMounted.current) return;
    let cancelled = false;
    void (async () => {
      try {
        await mountAdyenDropin({
          session,
          container: dropinEl,
          onPaymentCompleted: async (result) => {
            if (cancelled || !checkoutOrderId) return;
            setPayMsg(t('billingActivating'));
            try {
              await api.post('/merchant/platform-shop/confirm', {
                orderId: checkoutOrderId,
                resultCode: result?.resultCode || 'Authorised',
              });
              toast.success(t('platformShopOrderPlaced'));
              setCart({});
              setSession(null);
              setCheckoutOrderId(null);
              dropinMounted.current = false;
              await load();
            } catch (err: unknown) {
              toast.error(
                (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
                  'Payment received but order confirmation failed'
              );
            }
          },
          onError: (err) => {
            if (!cancelled) setPayMsg(formatAdyenError(err, 'dropin') || 'Payment failed');
          },
        });
        if (!cancelled) dropinMounted.current = true;
      } catch (err) {
        if (!cancelled) setPayMsg(formatAdyenError(err, 'mount') || 'Could not load payment form');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, dropinEl, checkoutOrderId, t, load]);

  if (loading) {
    return <div className="text-sm text-stone-500">{t('loading')}</div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-stone-900">{t('platformShopTitle')}</h1>
        <p className="text-sm text-stone-600 mt-1">{t('platformShopHint')}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => (
            <article
              key={product.id}
              className="rounded-xl border border-stone-200 bg-white overflow-hidden shadow-sm"
            >
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt=""
                  className="h-36 w-full object-cover bg-stone-100"
                />
              ) : (
                <div className="h-36 bg-stone-100 flex items-center justify-center text-stone-400 text-sm">
                  {t('noPhoto')}
                </div>
              )}
              <div className="p-4 space-y-2">
                <h2 className="font-semibold text-stone-900">{product.name}</h2>
                {product.description ? (
                  <p className="text-xs text-stone-600 line-clamp-3">{product.description}</p>
                ) : null}
                <div className="flex items-center justify-between gap-2">
                  <div>
                    {product.discountPercent ? (
                      <>
                        <span className="text-sm font-bold text-blue-600">
                          {money(unitPrice(product))}
                        </span>
                        <span className="ml-2 text-xs text-stone-400 line-through">
                          {money(product.price)}
                        </span>
                      </>
                    ) : (
                      <span className="text-sm font-bold text-stone-900">
                        {money(product.price)}
                      </span>
                    )}
                  </div>
                  <button type="button" className="btn-primary text-xs px-3 py-1.5" onClick={() => addToCart(product.id)}>
                    {t('addToCart')}
                  </button>
                </div>
              </div>
            </article>
          ))}
          {!products.length ? (
            <p className="text-sm text-stone-500 col-span-full">{t('platformShopNoProducts')}</p>
          ) : null}
        </div>

        <aside className="rounded-xl border border-stone-200 bg-white p-4 h-fit space-y-4 sticky top-4">
          <h2 className="font-semibold text-stone-900">{t('cart')}</h2>
          {cartLines.length ? (
            <ul className="space-y-2 text-sm">
              {cartLines.map((line) => (
                <li key={line.product.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{line.product.name}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      className="w-6 h-6 rounded border text-stone-600"
                      onClick={() => setQty(line.product.id, line.qty - 1)}
                    >
                      −
                    </button>
                    <span className="w-6 text-center">{line.qty}</span>
                    <button
                      type="button"
                      className="w-6 h-6 rounded border text-stone-600"
                      onClick={() => setQty(line.product.id, line.qty + 1)}
                    >
                      +
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-stone-500">{t('platformShopCartEmpty')}</p>
          )}
          <div className="text-sm font-semibold flex justify-between">
            <span>{t('total')}</span>
            <span>{money(cartTotal)}</span>
          </div>
          <label className="block text-xs text-stone-600">
            {t('platformShopVoucher')}
            <input
              className="input mt-1 w-full text-sm"
              value={voucherCode}
              onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
              placeholder="SAVE10"
            />
          </label>
          <label className="block text-xs text-stone-600">
            {t('notes')}
            <textarea
              className="input mt-1 w-full text-sm min-h-[60px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          {!session ? (
            <button
              type="button"
              className="btn-primary w-full text-sm"
              disabled={busy || !cartLines.length}
              onClick={() => void startCheckout()}
            >
              {busy ? t('loading') : t('checkout')}
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-stone-600">{t('platformShopPayOnline')}</p>
              <div ref={setDropinEl} />
              {payMsg ? <p className="text-xs text-red-600">{payMsg}</p> : null}
            </div>
          )}
        </aside>
      </div>

      {orders.length ? (
        <section className="space-y-3">
          <h2 className="font-semibold text-stone-900">{t('platformShopMyOrders')}</h2>
          <div className="overflow-x-auto rounded-xl border border-stone-200">
            <table className="min-w-full text-sm">
              <thead className="bg-stone-50 text-left text-stone-600">
                <tr>
                  <th className="px-3 py-2">{t('date')}</th>
                  <th className="px-3 py-2">{t('status')}</th>
                  <th className="px-3 py-2">{t('total')}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-t border-stone-100">
                    <td className="px-3 py-2">{new Date(o.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-2 capitalize">{o.paymentStatus || o.status}</td>
                    <td className="px-3 py-2">{money(o.total, o.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
