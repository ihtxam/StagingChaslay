import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { Gift } from 'lucide-react';
import { resolveShopKey, shopBasePath } from '@/lib/shop-cart';
import { useI18n } from '@/lib/i18n';
import { shopDocumentTitle } from '@/lib/brand';
import ShopLangSwitcher from '@/components/shop/ShopLangSwitcher';

type GiftSettings = {
  enabled: boolean;
  presetDenominations: number[];
  minAmount: number;
  maxAmount: number;
  customAmountEnabled: boolean;
};

type PaymentSession = {
  id: string;
  sessionData: string;
  clientKey: string;
  environment: string;
  error?: string;
  demoConfirmAvailable?: boolean;
};

export default function GiftCardsPage() {
  const { t } = useI18n();
  const { merchantSlug } = useParams<{ merchantSlug?: string }>();
  const shopKey = useMemo(() => resolveShopKey(merchantSlug), [merchantSlug]);
  const base = shopBasePath(shopKey);

  const [merchant, setMerchant] = useState<any>(null);
  const [settings, setSettings] = useState<GiftSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [purchaseId, setPurchaseId] = useState<string | null>(null);
  const [session, setSession] = useState<PaymentSession | null>(null);
  const [payMsg, setPayMsg] = useState('');
  const dropinRef = useRef<HTMLDivElement>(null);
  const dropinMounted = useRef(false);

  useEffect(() => {
    if (!shopKey) return;
    document.title = shopDocumentTitle('Gift cards', merchant?.name);
    (async () => {
      try {
        const [shopRes, gcRes] = await Promise.all([
          axios.get(`/api/shop/${shopKey}`),
          axios.get(`/api/shop/${shopKey}/gift-cards/settings`),
        ]);
        setMerchant(shopRes.data?.data);
        setSettings(gcRes.data?.settings);
        const presets = gcRes.data?.settings?.presetDenominations || [];
        if (presets.length) setAmount(Number(presets[0]));
      } catch {
        setError(t('loadFailed'));
      } finally {
        setLoading(false);
      }
    })();
  }, [shopKey, merchant?.name, t]);

  const resolvedAmount = useMemo(() => {
    if (amount === -1) {
      const n = parseFloat(customAmount.replace(',', '.'));
      return Number.isFinite(n) ? n : 0;
    }
    return amount || 0;
  }, [amount, customAmount]);

  const startPurchase = async (e: FormEvent) => {
    e.preventDefault();
    if (!shopKey || !settings?.enabled) return;
    setSubmitting(true);
    setError(null);
    setPayMsg('');
    try {
      const res = await axios.post(`/api/shop/${shopKey}/gift-cards/purchase`, {
        amount: resolvedAmount,
        recipientEmail,
        recipientName: recipientName || undefined,
        senderName: senderName || undefined,
        senderEmail: senderEmail || undefined,
        message: message || undefined,
      });
      const pid = res.data?.purchase?.id;
      setPurchaseId(pid);
      setSession(res.data?.paymentSession || null);
      if (res.data?.paymentSession?.demoConfirmAvailable && !res.data?.paymentSession?.id) {
        setPayMsg(t('shopGiftCardDemoPayHint'));
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || t('actionFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDemo = useCallback(async () => {
    if (!shopKey || !purchaseId) return;
    setSubmitting(true);
    try {
      await axios.post(
        `/api/shop/${shopKey}/gift-cards/purchase/${purchaseId}/confirm-payment`,
        { pspReference: `DEMO-GC-${Date.now()}` }
      );
      window.location.href = `${base}/gift-cards/confirm/${purchaseId}`;
    } catch (err: any) {
      setError(err?.response?.data?.error || t('actionFailed'));
    } finally {
      setSubmitting(false);
    }
  }, [shopKey, purchaseId, base, t]);

  useEffect(() => {
    if (!session?.id || !dropinRef.current || dropinMounted.current) return;
    dropinMounted.current = true;
    const mount = async () => {
      try {
        const AdyenCheckout = (await import('@adyen/adyen-web')).default;
        await import(/* @vite-ignore */ '@adyen/adyen-web/dist/adyen.css').catch(() => undefined);
        const checkout = await AdyenCheckout({
          environment: session.environment as 'test' | 'live',
          clientKey: session.clientKey,
          session: { id: session.id, sessionData: session.sessionData },
          onPaymentCompleted: async () => {
            try {
              await axios.post(
                `/api/shop/${shopKey}/gift-cards/purchase/${purchaseId}/confirm-payment`,
                {}
              );
              window.location.href = `${base}/gift-cards/confirm/${purchaseId}`;
            } catch {
              setPayMsg(t('shopGiftCardConfirmPending'));
            }
          },
          onError: () => setPayMsg(t('actionFailed')),
        });
        checkout.create('dropin').mount(dropinRef.current!);
      } catch {
        setPayMsg(t('shopGiftCardPayLoadFailed'));
      }
    };
    void mount();
  }, [session, shopKey, purchaseId, base, t]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 text-stone-500">
        …
      </div>
    );
  }

  if (!settings?.enabled) {
    return (
      <div className="min-h-screen bg-stone-50 px-4 py-12">
        <div className="max-w-lg mx-auto text-center">
          <p className="text-stone-600">{t('shopGiftCardUnavailable')}</p>
          <Link to={base || '/'} className="mt-4 inline-block text-stone-900 underline">
            {t('shopBackHome')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <Link to={base || '/'} className="font-semibold tracking-tight truncate">
            {merchant?.name || 'Shop'}
          </Link>
          <div className="flex items-center gap-2">
            <ShopLangSwitcher />
            <Link
              to={`${base}/menu`}
              className="hidden sm:inline-flex px-4 py-2 rounded-full bg-stone-900 text-white text-sm font-medium"
            >
              {t('shopOrderOnline')} →
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-stone-900 text-white flex items-center justify-center">
            <Gift size={20} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('shopGiftCardTitle')}</h1>
        </div>
        <p className="text-stone-600 mb-8">{t('shopGiftCardSubtitle')}</p>

        {!purchaseId ? (
          <form
            onSubmit={startPurchase}
            className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-6"
          >
            <div>
              <p className="text-sm font-medium mb-3">{t('shopGiftCardChooseAmount')}</p>
              <div className="flex flex-wrap gap-2">
                {settings.presetDenominations.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setAmount(d)}
                    className={`px-4 py-2.5 rounded-full border text-sm font-medium transition-colors ${
                      amount === d
                        ? 'bg-stone-900 text-white border-stone-900'
                        : 'bg-white text-stone-800 border-stone-300 hover:border-stone-400'
                    }`}
                  >
                    CHF {d}
                  </button>
                ))}
                {settings.customAmountEnabled && (
                  <button
                    type="button"
                    onClick={() => setAmount(-1)}
                    className={`px-4 py-2.5 rounded-full border text-sm font-medium ${
                      amount === -1
                        ? 'bg-stone-900 text-white border-stone-900'
                        : 'bg-white text-stone-800 border-stone-300'
                    }`}
                  >
                    {t('shopGiftCardCustom')}
                  </button>
                )}
              </div>
              {amount === -1 && (
                <input
                  type="number"
                  min={settings.minAmount}
                  max={settings.maxAmount}
                  step="0.05"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder={`CHF ${settings.minAmount} – ${settings.maxAmount}`}
                  className="mt-3 w-full rounded-xl border border-stone-300 px-4 py-3"
                  required
                />
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-sm font-medium">{t('shopGiftCardRecipientEmail')}</span>
                <input
                  type="email"
                  required
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-300 px-4 py-3"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">{t('shopGiftCardRecipientName')}</span>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-300 px-4 py-3"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">{t('shopGiftCardSenderName')}</span>
                <input
                  type="text"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-300 px-4 py-3"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">{t('shopGiftCardSenderEmail')}</span>
                <input
                  type="email"
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-300 px-4 py-3"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-sm font-medium">{t('shopGiftCardMessage')}</span>
              <textarea
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="mt-1 w-full rounded-xl border border-stone-300 px-4 py-3 resize-none"
                placeholder={t('shopGiftCardMessagePlaceholder')}
              />
            </label>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={submitting || resolvedAmount <= 0}
              className="w-full py-3.5 rounded-full bg-stone-900 text-white font-semibold disabled:opacity-50"
            >
              {submitting
                ? '…'
                : t('shopGiftCardPay').replace('{amount}', resolvedAmount.toFixed(2))}
            </button>
          </form>
        ) : (
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-2">{t('shopGiftCardPayment')}</h2>
            <p className="text-stone-600 text-sm mb-4">
              CHF {resolvedAmount.toFixed(2)} → {recipientEmail}
            </p>
            {payMsg && <p className="text-amber-700 text-sm mb-3">{payMsg}</p>}
            {session?.demoConfirmAvailable && !session?.id && (
              <button
                type="button"
                onClick={() => void confirmDemo()}
                disabled={submitting}
                className="mb-4 w-full py-3 rounded-full border border-stone-300 font-medium"
              >
                {t('shopGiftCardDemoConfirm')}
              </button>
            )}
            <div ref={dropinRef} />
          </div>
        )}
      </main>
    </div>
  );
}
