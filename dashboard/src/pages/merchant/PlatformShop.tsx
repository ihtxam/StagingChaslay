import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import api from '@/lib/api';
import {
  mountAdyenDropin,
  normalizeAdyenPaymentSession,
  formatAdyenError,
  type AdyenPaymentSession,
} from '@/lib/adyen-checkout';
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
  subtotal?: string;
  discountAmount?: string;
  total: string;
  currency: string;
  voucherCode?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt?: string;
  paidAt?: string | null;
  trackingUrl?: string | null;
  items: Array<{ name: string; quantity: number; unitPrice: number; lineTotal?: number }>;
};

type Quote = {
  subtotal: number;
  discountAmount: number;
  total: number;
  voucherCode?: string | null;
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

function statusLabel(status: string, t: (k: string) => string) {
  const map: Record<string, string> = {
    pending: t('platformShopStatusPending'),
    paid: t('platformShopStatusPaid'),
    accepted: t('platformShopStatusAccepted'),
    processing: t('platformShopStatusProcessing'),
    shipped: t('platformShopStatusShipped'),
    fulfilled: t('platformShopStatusFulfilled'),
    cancelled: t('platformShopStatusCancelled'),
  };
  return map[status] || status;
}

const FOLLOW_STEPS = ['paid', 'accepted', 'processing', 'shipped'] as const;

function StatusTimeline({ status, t }: { status: string; t: (k: string) => string }) {
  if (status === 'cancelled') {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
        {statusLabel(status, t)}
      </p>
    );
  }
  const pos =
    status === 'fulfilled'
      ? FOLLOW_STEPS.length - 1
      : FOLLOW_STEPS.indexOf(status as (typeof FOLLOW_STEPS)[number]);
  return (
    <ol className="space-y-2">
      {FOLLOW_STEPS.map((s, i) => {
        const reached = pos >= 0 && i <= pos;
        const current = status === s || (status === 'fulfilled' && s === 'shipped');
        return (
          <li key={s} className="flex items-center gap-2 text-sm">
            <span
              className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                reached ? 'bg-emerald-500' : 'bg-[var(--border)]'
              }`}
            />
            <span
              className={
                current
                  ? 'font-semibold text-[var(--text)]'
                  : reached
                    ? 'text-[var(--text)]'
                    : 'text-[var(--text-muted)]'
              }
            >
              {statusLabel(s, t)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function DraggableSheet({
  title,
  subtitle,
  onClose,
  closeLabel,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  closeLabel: string;
  children: ReactNode;
}) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button, a, input, textarea, select')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      origX: offset.x,
      origY: offset.y,
    };
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d?.active) return;
    const maxX = Math.max(48, window.innerWidth * 0.45);
    const maxY = Math.max(48, window.innerHeight * 0.45);
    setOffset({
      x: Math.max(-maxX, Math.min(maxX, d.origX + (e.clientX - d.startX))),
      y: Math.max(-maxY, Math.min(maxY, d.origY + (e.clientY - d.startY))),
    });
  };
  const onPointerUp = () => {
    if (drag.current) drag.current.active = false;
  };

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[280] flex items-center justify-center bg-black/50 p-3 sm:p-6"
      style={{
        paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
      }}
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="flex min-h-0 w-full max-w-lg max-h-full flex-col overflow-hidden rounded-2xl bg-[var(--bg-elevated)] shadow-2xl border border-[var(--border)]"
        style={{
          marginLeft: offset.x,
          marginTop: offset.y,
          maxHeight: 'calc(100dvh - 1.5rem)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-[var(--border)]">
          <div
            className="flex cursor-grab active:cursor-grabbing touch-none items-center justify-center pt-2 pb-1 select-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <div className="h-1.5 w-12 rounded-full bg-[var(--border)]" aria-hidden />
          </div>
          <div
            className="flex cursor-grab active:cursor-grabbing items-start justify-between gap-3 px-4 pb-3 select-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-[var(--text)]">{title}</h2>
              {subtitle ? <p className="text-xs text-[var(--text-muted)] mt-0.5">{subtitle}</p> : null}
            </div>
            <button type="button" className="text-sm font-semibold text-[var(--text-muted)] underline" onClick={onClose}>
              {closeLabel}
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>,
    document.body
  );
}

function adyenLocaleFor(locale: string) {
  if (locale === 'fr') return 'fr-CH';
  if (locale === 'de') return 'de-CH';
  return 'en-US';
}

export default function PlatformShop() {
  const { t, locale } = useI18n();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  const [buyProduct, setBuyProduct] = useState<Product | null>(null);
  const [viewOrder, setViewOrder] = useState<Order | null>(null);
  const [step, setStep] = useState<1 | 2 | 'done'>(1);
  const [qty, setQty] = useState(1);
  const [voucherCode, setVoucherCode] = useState('');
  const [notes, setNotes] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [voucherError, setVoucherError] = useState('');
  const [busy, setBusy] = useState(false);
  const [checkoutOrderId, setCheckoutOrderId] = useState<string | null>(null);
  const [session, setSession] = useState<AdyenPaymentSession | null>(null);
  const [payMsg, setPayMsg] = useState('');
  const [dropinEl, setDropinEl] = useState<HTMLDivElement | null>(null);
  const dropinMounted = useRef(false);
  const checkoutOrderIdRef = useRef<string | null>(null);
  const checkoutFingerprint = useRef('');
  const quoteSeq = useRef(0);
  const [popupOffset, setPopupOffset] = useState({ x: 0, y: 0 });
  const popupDrag = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  useEffect(() => {
    checkoutOrderIdRef.current = checkoutOrderId;
  }, [checkoutOrderId]);

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

  const closeBuy = useCallback(() => {
    setBuyProduct(null);
    setStep(1);
    setQty(1);
    setVoucherCode('');
    setNotes('');
    setQuote(null);
    setVoucherError('');
    setSession(null);
    setCheckoutOrderId(null);
    setPayMsg('');
    setBusy(false);
    setPopupOffset({ x: 0, y: 0 });
    popupDrag.current = null;
    dropinMounted.current = false;
    checkoutFingerprint.current = '';
    if (dropinEl) dropinEl.innerHTML = '';
  }, [dropinEl]);

  const openBuy = (product: Product) => {
    setBuyProduct(product);
    setStep(1);
    setQty(1);
    setVoucherCode('');
    setNotes('');
    setQuote(null);
    setVoucherError('');
    setSession(null);
    setCheckoutOrderId(null);
    setPayMsg('');
    dropinMounted.current = false;
    checkoutFingerprint.current = '';
    setPopupOffset({ x: 0, y: 0 });
    popupDrag.current = null;
  };

  const closeOrder = useCallback(() => setViewOrder(null), []);

  const openOrder = useCallback(async (order: Order) => {
    setViewOrder(order);
    try {
      const res = await api.get(`/merchant/platform-shop/orders/${order.id}`);
      const fresh = res.data.order as Order | undefined;
      if (fresh) {
        setViewOrder(fresh);
        setOrders((prev) => prev.map((row) => (row.id === fresh.id ? { ...row, ...fresh } : row)));
      }
    } catch {
      /* keep the list snapshot if refresh fails */
    }
  }, []);

  useEffect(() => {
    if (!buyProduct) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [buyProduct]);

  const onPopupHeaderPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button, a, input, textarea, select')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    popupDrag.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      origX: popupOffset.x,
      origY: popupOffset.y,
    };
  };

  const onPopupHeaderPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = popupDrag.current;
    if (!drag?.active) return;
    const maxX = Math.max(48, window.innerWidth * 0.45);
    const maxY = Math.max(48, window.innerHeight * 0.45);
    const x = drag.origX + (e.clientX - drag.startX);
    const y = drag.origY + (e.clientY - drag.startY);
    setPopupOffset({
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    });
  };

  const onPopupHeaderPointerUp = () => {
    if (popupDrag.current) popupDrag.current.active = false;
  };

  useEffect(() => {
    const orderId = searchParams.get('orderId');
    if (orderId) setCheckoutOrderId(orderId);
  }, [searchParams]);

  useEffect(() => {
    if (!buyProduct) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeBuy();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [buyProduct, closeBuy]);

  const fingerprint = useMemo(
    () =>
      JSON.stringify({
        id: buyProduct?.id || '',
        qty,
        voucher: voucherCode.trim(),
        notes: notes.trim(),
      }),
    [buyProduct?.id, qty, voucherCode, notes]
  );

  const refreshQuote = useCallback(
    async (code: string) => {
      if (!buyProduct) return;
      const seq = ++quoteSeq.current;
      setQuoting(true);
      try {
        const res = await api.post('/merchant/platform-shop/quote', {
          items: [{ productId: buyProduct.id, quantity: qty }],
          voucherCode: code.trim() || undefined,
        });
        if (seq !== quoteSeq.current) return;
        setQuote(res.data.quote);
        setVoucherError('');
      } catch (err: unknown) {
        if (seq !== quoteSeq.current) return;
        setQuote({
          subtotal: unitPrice(buyProduct) * qty,
          discountAmount: 0,
          total: unitPrice(buyProduct) * qty,
          voucherCode: null,
        });
        if (code.trim()) {
          setVoucherError(
            (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
              t('platformShopVoucherInvalid')
          );
        } else {
          setVoucherError('');
        }
      } finally {
        if (seq === quoteSeq.current) setQuoting(false);
      }
    },
    [buyProduct, qty, t]
  );

  useEffect(() => {
    if (!buyProduct || step !== 1) return;
    const handle = window.setTimeout(() => {
      void refreshQuote(voucherCode);
    }, 280);
    return () => window.clearTimeout(handle);
  }, [buyProduct, qty, voucherCode, step, refreshQuote]);

  const goPay = async () => {
    if (!buyProduct || voucherError) return;
    if (session && checkoutOrderId && checkoutFingerprint.current === fingerprint) {
      setStep(2);
      dropinMounted.current = false;
      if (dropinEl) dropinEl.innerHTML = '';
      return;
    }
    setBusy(true);
    setPayMsg('');
    dropinMounted.current = false;
    if (dropinEl) dropinEl.innerHTML = '';
    try {
      const res = await api.post('/merchant/platform-shop/checkout', {
        items: [{ productId: buyProduct.id, quantity: qty }],
        voucherCode: voucherCode.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      if (res.data.free) {
        toast.success(t('platformShopOrderPlaced'));
        setStep('done');
        await load();
        return;
      }
      const normalized = normalizeAdyenPaymentSession(res.data.paymentSession);
      if (!normalized) throw new Error('Invalid payment session');
      setCheckoutOrderId(res.data.order?.id || null);
      setSession(normalized);
      checkoutFingerprint.current = fingerprint;
      setStep(2);
    } catch (err: unknown) {
      toast.error(
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          (err instanceof Error ? err.message : null) ||
          t('platformShopCheckoutFailed')
      );
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (step !== 2 || !session?.sessionData || !session.clientKey || !dropinEl || dropinMounted.current) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        await mountAdyenDropin({
          session,
          container: dropinEl,
          locale: adyenLocaleFor(locale),
          onPaymentCompleted: async (result) => {
            const orderId = checkoutOrderIdRef.current;
            if (cancelled || !orderId) return;
            setPayMsg(t('platformShopConfirming'));
            try {
              await api.post('/merchant/platform-shop/confirm', {
                orderId,
                resultCode: result?.resultCode || 'Authorised',
              });
              toast.success(t('platformShopOrderPlaced'));
              setStep('done');
              await load();
            } catch (err: unknown) {
              toast.error(
                (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
                  t('platformShopConfirmFailed')
              );
            }
          },
          onError: (err) => {
            if (!cancelled) setPayMsg(formatAdyenError(err, 'dropin') || t('platformShopCheckoutFailed'));
          },
        });
        if (!cancelled) dropinMounted.current = true;
      } catch (err) {
        if (!cancelled) {
          const msg = formatAdyenError(err, 'dropin') || t('platformShopDropinFailed');
          setPayMsg(msg);
          toast.error(msg);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, session, dropinEl, t, load, locale]);

  const displaySubtotal = quote?.subtotal ?? (buyProduct ? unitPrice(buyProduct) * qty : 0);
  const displayTotal = quote?.total ?? displaySubtotal;
  const voucherApplied = !!(quote?.voucherCode && (quote?.discountAmount || 0) > 0);

  if (loading) {
    return <div className="text-sm text-[var(--text-muted)]">{t('loading')}</div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="page-title">{t('platformShopTitle')}</h1>
        <p className="page-sub">{t('platformShopHint')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {products.map((product) => (
          <article
            key={product.id}
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] overflow-hidden shadow-sm"
          >
            {product.imageUrl ? (
              <img src={product.imageUrl} alt="" className="h-36 w-full object-cover bg-[var(--bg-muted)]" />
            ) : (
              <div className="h-36 bg-[var(--bg-muted)] flex items-center justify-center text-[var(--text-muted)] text-sm">
                {t('noPhoto')}
              </div>
            )}
            <div className="p-4 space-y-2">
              <h2 className="font-semibold text-[var(--text)]">{product.name}</h2>
              {product.description ? (
                <p className="text-xs text-[var(--text-muted)] line-clamp-3">{product.description}</p>
              ) : null}
              <div className="flex items-center justify-between gap-2">
                <div>
                  {product.discountPercent ? (
                    <>
                      <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{money(unitPrice(product))}</span>
                      <span className="ml-2 text-xs text-[var(--text-muted)] line-through">{money(product.price)}</span>
                    </>
                  ) : (
                    <span className="text-sm font-bold text-[var(--text)]">{money(product.price)}</span>
                  )}
                </div>
                <button type="button" className="btn-primary text-xs px-3 py-1.5" onClick={() => openBuy(product)}>
                  {t('buy')}
                </button>
              </div>
            </div>
          </article>
        ))}
        {!products.length ? (
          <p className="text-sm text-[var(--text-muted)] col-span-full">{t('platformShopNoProducts')}</p>
        ) : null}
      </div>

      {buyProduct && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[280] flex items-center justify-center bg-black/50 p-3 sm:p-6"
              style={{
                paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
                paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
              }}
              role="dialog"
              aria-modal="true"
              onClick={closeBuy}
            >
              <div
                className="flex min-h-0 w-full max-w-lg max-h-full flex-col overflow-hidden rounded-2xl bg-[var(--bg-elevated)] shadow-2xl border border-[var(--border)]"
                style={{
                  marginLeft: popupOffset.x,
                  marginTop: popupOffset.y,
                  maxHeight: 'calc(100dvh - 1.5rem)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="shrink-0 border-b border-[var(--border)]">
                  <div
                    className="flex cursor-grab active:cursor-grabbing touch-none items-center justify-center pt-2 pb-1 select-none"
                    onPointerDown={onPopupHeaderPointerDown}
                    onPointerMove={onPopupHeaderPointerMove}
                    onPointerUp={onPopupHeaderPointerUp}
                    onPointerCancel={onPopupHeaderPointerUp}
                  >
                    <div className="h-1.5 w-12 rounded-full bg-[var(--border)]" aria-hidden />
                  </div>
                  <div
                    className="flex cursor-grab active:cursor-grabbing items-start justify-between gap-3 px-4 pb-3 select-none"
                    onPointerDown={onPopupHeaderPointerDown}
                    onPointerMove={onPopupHeaderPointerMove}
                    onPointerUp={onPopupHeaderPointerUp}
                    onPointerCancel={onPopupHeaderPointerUp}
                  >
                    <div className="min-w-0">
                      <h2 className="text-base font-semibold text-[var(--text)]">
                        {step === 'done'
                          ? t('platformShopSuccess')
                          : step === 1
                            ? t('platformShopBuyTitle')
                            : t('platformShopPayOnline')}
                      </h2>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        {step === 'done'
                          ? t('platformShopOrderPlaced')
                          : step === 1
                            ? t('platformShopBuyHint')
                            : buyProduct.name}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="text-sm font-semibold text-[var(--text-muted)] underline"
                      onClick={closeBuy}
                    >
                      {step === 'done' ? t('close') : t('cancel')}
                    </button>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {step !== 'done' ? (
              <div className="px-4 pt-3 flex gap-2 text-[11px] font-semibold">
                <span
                  className={`rounded-full px-2.5 py-1 ${
                    step === 1
                      ? 'bg-[var(--accent)] text-[var(--accent-fg)]'
                      : 'bg-[var(--bg-muted)] text-[var(--text-muted)]'
                  }`}
                >
                  1. {t('platformShopStepDetails')}
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 ${
                    step === 2
                      ? 'bg-[var(--accent)] text-[var(--accent-fg)]'
                      : 'bg-[var(--bg-muted)] text-[var(--text-muted)]'
                  }`}
                >
                  2. {t('platformShopStepPayment')}
                </span>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="p-4 space-y-4">
                <div className="flex gap-3">
                  {buyProduct.imageUrl ? (
                    <img
                      src={buyProduct.imageUrl}
                      alt=""
                      className="h-20 w-20 rounded-lg object-cover bg-[var(--bg-muted)]"
                    />
                  ) : null}
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--text)]">{buyProduct.name}</p>
                    <p className="text-sm text-[var(--text-muted)]">{money(unitPrice(buyProduct))}</p>
                  </div>
                </div>
                <label className="block text-xs text-[var(--text-muted)]">
                  {t('quantity')}
                  <div className="mt-1 flex items-center gap-2">
                    <button
                      type="button"
                      className="w-8 h-8 rounded-md border border-[var(--border)] text-lg text-[var(--text)]"
                      onClick={() => setQty((n) => Math.max(1, n - 1))}
                    >
                      −
                    </button>
                    <input
                      className="input w-16 text-center"
                      type="number"
                      min={1}
                      value={qty}
                      onChange={(e) => setQty(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                    />
                    <button
                      type="button"
                      className="w-8 h-8 rounded-md border border-[var(--border)] text-lg text-[var(--text)]"
                      onClick={() => setQty((n) => n + 1)}
                    >
                      +
                    </button>
                  </div>
                </label>
                <label className="block text-xs text-[var(--text-muted)]">
                  {t('platformShopVoucher')}
                  <div className="mt-1 flex gap-2">
                    <input
                      className="input flex-1 text-sm"
                      value={voucherCode}
                      onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                      placeholder="SAVE10"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void refreshQuote(voucherCode);
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="btn-secondary text-xs shrink-0"
                      disabled={quoting}
                      onClick={() => void refreshQuote(voucherCode)}
                    >
                      {t('platformShopApplyVoucher')}
                    </button>
                  </div>
                  {voucherError ? <span className="text-red-600 dark:text-red-400">{voucherError}</span> : null}
                  {voucherApplied ? (
                    <span className="text-emerald-700 dark:text-emerald-400">{t('platformShopVoucherApplied')}</span>
                  ) : null}
                </label>
                <label className="block text-xs text-[var(--text-muted)]">
                  {t('notes')}
                  <textarea
                    className="input mt-1 w-full text-sm min-h-[60px]"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t('platformShopNotesPlaceholder')}
                    maxLength={2000}
                  />
                </label>
                <div className="text-sm space-y-1 border-t border-[var(--border)] pt-3 text-[var(--text)]">
                  <div className="flex justify-between">
                    <span>{t('subtotal')}</span>
                    <span>{money(displaySubtotal)}</span>
                  </div>
                  {(quote?.discountAmount || 0) > 0 ? (
                    <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                      <span>{t('discount')}</span>
                      <span>−{money(quote!.discountAmount)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between font-semibold">
                    <span>{t('total')}</span>
                    <span>{money(displayTotal)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-primary w-full text-sm"
                  disabled={busy || quoting || !!voucherError}
                  onClick={() => void goPay()}
                >
                  {busy ? t('loading') : t('platformShopContinueToPay')}
                </button>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="p-4 space-y-3">
                <button
                  type="button"
                  className="text-xs font-semibold text-[var(--text-muted)] underline"
                  onClick={() => {
                    setStep(1);
                    dropinMounted.current = false;
                    if (dropinEl) dropinEl.innerHTML = '';
                    setPayMsg('');
                  }}
                >
                  {t('back')}
                </button>
                <div className="flex justify-between text-sm text-[var(--text)]">
                  <span>
                    {qty}× {buyProduct.name}
                  </span>
                  <span className="font-semibold">{money(displayTotal)}</span>
                </div>
                <p className="text-xs text-[var(--text-muted)]">{t('platformShopPayHint')}</p>
                <div key={session?.id} ref={setDropinEl} className="min-h-[160px]" />
                {payMsg ? (
                  <p className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2">
                    {payMsg}
                  </p>
                ) : null}
              </div>
            ) : null}

            {step === 'done' ? (
              <div className="p-6 space-y-3 text-center">
                <p className="text-sm text-[var(--text)]">{t('platformShopOrderPlaced')}</p>
                <button type="button" className="btn-primary text-sm" onClick={closeBuy}>
                  {t('close')}
                </button>
              </div>
            ) : null}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      <section className="space-y-3">
        <h2 className="font-semibold text-[var(--text)]">{t('platformShopMyOrders')}</h2>
        {orders.length ? (
          <ul className="space-y-2">
            {orders.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 text-left shadow-sm hover:border-[var(--accent)]/40"
                  onClick={() => void openOrder(o)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-[var(--text)] min-w-0">
                      {(o.items || []).map((i) => `${i.quantity}× ${i.name}`).join(', ') || t('items')}
                    </p>
                    <span className="shrink-0 font-semibold text-[var(--text)]">{money(o.total, o.currency)}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
                    <span>{new Date(o.createdAt).toLocaleString()}</span>
                    <span className="font-semibold text-[var(--text)]">{statusLabel(o.status, t)}</span>
                  </div>
                  {o.trackingUrl ? (
                    <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">{t('platformShopTracking')}</p>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">{t('platformShopNoOrders')}</p>
        )}
      </section>

      {viewOrder ? (
        <DraggableSheet
          title={t('platformShopOrderDetails')}
          subtitle={`${t('platformShopOrderRef')} #${viewOrder.id.slice(0, 8)}`}
          onClose={closeOrder}
          closeLabel={t('close')}
        >
          <div className="p-4 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2">
                {t('status')}
              </p>
              {viewOrder.paymentStatus === 'pending' && viewOrder.status === 'pending' ? (
                <p className="mb-2 text-sm text-amber-700 dark:text-amber-300">{t('platformShopPaymentPending')}</p>
              ) : null}
              <StatusTimeline status={viewOrder.status} t={t} />
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/40 p-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                {t('platformShopFollowUp')}
              </p>
              {viewOrder.trackingUrl ? (
                <a
                  href={viewOrder.trackingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary inline-flex text-sm"
                >
                  {t('platformShopOpenTracking')}
                </a>
              ) : viewOrder.status === 'cancelled' ? null : (
                <p className="text-sm text-[var(--text-muted)]">
                  {['shipped', 'fulfilled'].includes(viewOrder.status)
                    ? t('platformShopNoTrackingYet')
                    : t('platformShopWaitingDispatch')}
                </p>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2">
                {t('items')}
              </p>
              <ul className="space-y-1 text-sm text-[var(--text)]">
                {(viewOrder.items || []).map((i, idx) => (
                  <li key={`${i.name}-${idx}`} className="flex justify-between gap-3">
                    <span>
                      {i.quantity}× {i.name}
                    </span>
                    <span>{money(i.lineTotal ?? i.unitPrice * i.quantity, viewOrder.currency)}</span>
                  </li>
                ))}
              </ul>
            </div>

            {viewOrder.notes ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-1">
                  {t('notes')}
                </p>
                <p className="text-sm text-[var(--text)] whitespace-pre-wrap">{viewOrder.notes}</p>
              </div>
            ) : null}

            <div className="text-sm space-y-1 border-t border-[var(--border)] pt-3 text-[var(--text)]">
              {viewOrder.voucherCode ? (
                <div className="flex justify-between">
                  <span>{t('platformShopVoucher')}</span>
                  <span>{viewOrder.voucherCode}</span>
                </div>
              ) : null}
              {viewOrder.subtotal != null ? (
                <div className="flex justify-between">
                  <span>{t('subtotal')}</span>
                  <span>{money(viewOrder.subtotal, viewOrder.currency)}</span>
                </div>
              ) : null}
              {Number(viewOrder.discountAmount || 0) > 0 ? (
                <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                  <span>{t('discount')}</span>
                  <span>−{money(viewOrder.discountAmount || 0, viewOrder.currency)}</span>
                </div>
              ) : null}
              <div className="flex justify-between font-semibold">
                <span>{t('total')}</span>
                <span>{money(viewOrder.total, viewOrder.currency)}</span>
              </div>
              <p className="text-xs text-[var(--text-muted)] pt-1">
                {t('date')}: {new Date(viewOrder.createdAt).toLocaleString()}
                {viewOrder.updatedAt ? (
                  <>
                    <br />
                    {t('platformShopUpdated')}: {new Date(viewOrder.updatedAt).toLocaleString()}
                  </>
                ) : null}
              </p>
            </div>
          </div>
        </DraggableSheet>
      ) : null}
    </div>
  );
}
