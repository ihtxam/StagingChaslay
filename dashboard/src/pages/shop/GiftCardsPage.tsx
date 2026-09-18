import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { Gift, Mail, Package } from 'lucide-react';
import { resolveShopKey, loadCustomerToken, shopBasePath } from '@/lib/shop-cart';
import { useI18n } from '@/lib/i18n';
import { shopDocumentTitle } from '@/lib/brand';
import { localizedShopCopy } from '@/lib/shop-site-settings';
import ShopMinimalHeader from '@/components/shop/ShopMinimalHeader';
import ShopThemeShell from '@/components/shop/ShopThemeShell';
import { useShopCmsTheme } from '@/hooks/useShopCmsTheme';
import {
  adyenLocaleFor,
  formatAdyenError,
  mountAdyenDropin,
  normalizeAdyenPaymentSession,
  shopCheckoutOriginPayload,
} from '@/lib/adyen-checkout';

type GiftSettings = {
  enabled: boolean;
  digitalVoucherEnabled?: boolean;
  physicalPostEnabled?: boolean;
  presetDenominations: number[];
  minAmount: number;
  maxAmount: number;
  customAmountEnabled: boolean;
};

type DeliveryType = 'digital' | 'physical';

type PaymentSession = {
  id: string;
  sessionData: string;
  clientKey: string;
  environment: string;
  error?: string;
  demoConfirmAvailable?: boolean;
};

export default function GiftCardsPage() {
  const { t, locale } = useI18n();
  const { merchantSlug } = useParams<{ merchantSlug?: string }>();
  const shopKey = useMemo(() => resolveShopKey(merchantSlug), [merchantSlug]);
  const { theme: cmsTheme, site: shopSite } = useShopCmsTheme(shopKey);
  const base = shopBasePath(shopKey);

  const [merchant, setMerchant] = useState<any>(null);
  const [settings, setSettings] = useState<GiftSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('digital');
  const [amount, setAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [message, setMessage] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [shippingZip, setShippingZip] = useState('');
  const [shippingCity, setShippingCity] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [purchaseId, setPurchaseId] = useState<string | null>(null);
  const [session, setSession] = useState<PaymentSession | null>(null);
  const [payMsg, setPayMsg] = useState('');
  const [dropinEl, setDropinEl] = useState<HTMLDivElement | null>(null);
  const dropinMounted = useRef(false);
  const loggedIn = !!loadCustomerToken(shopKey);
  const [balanceCode, setBalanceCode] = useState('');
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceResult, setBalanceResult] = useState<{
    balance: number;
    code: string;
    holderName?: string | null;
  } | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  useEffect(() => {
    if (!shopKey) return;
    if (!localizedShopCopy(shopSite?.metaTitle, locale)) {
      document.title = shopDocumentTitle('Gift cards');
    }
    (async () => {
      try {
        const [shopRes, gcRes] = await Promise.all([
          axios.get(`/api/shop/${shopKey}`),
          axios.get(`/api/shop/${shopKey}/gift-cards/settings`),
        ]);
        setMerchant(shopRes.data?.data);
        const s = gcRes.data?.settings as GiftSettings;
        setSettings(s);
        const presets = s?.presetDenominations || [];
        if (presets.length) setAmount(Number(presets[0]));
        if (s?.digitalVoucherEnabled === false && s?.physicalPostEnabled) {
          setDeliveryType('physical');
        }
      } catch {
        setError(t('loadFailed'));
      } finally {
        setLoading(false);
      }
    })();
  }, [shopKey, merchant?.name, t, shopSite?.metaTitle, locale]);

  const resolvedAmount = useMemo(() => {
    if (amount === -1) {
      const n = parseFloat(customAmount.replace(',', '.'));
      return Number.isFinite(n) ? n : 0;
    }
    return amount || 0;
  }, [amount, customAmount]);

  const showDigital = settings?.digitalVoucherEnabled !== false;
  const showPhysical = settings?.physicalPostEnabled === true;

  const checkBalance = async (e: FormEvent) => {
    e.preventDefault();
    const code = balanceCode.trim();
    if (!shopKey || !code) return;
    setBalanceLoading(true);
    setBalanceError(null);
    setBalanceResult(null);
    try {
      const res = await axios.get(
        `/api/shop/${shopKey}/gift-cards/balance/${encodeURIComponent(code)}`
      );
      setBalanceResult({
        balance: Number(res.data?.balance) || 0,
        code: String(res.data?.code || code),
        holderName: res.data?.holderName || null,
      });
    } catch (err: any) {
      setBalanceError(err?.response?.data?.error || t('giftCardNotFound'));
    } finally {
      setBalanceLoading(false);
    }
  };

  const startPurchase = async (e: FormEvent) => {
    e.preventDefault();
    if (!shopKey || !settings?.enabled) return;
    setSubmitting(true);
    setError(null);
    setPayMsg('');
    try {
      const res = await axios.post(`/api/shop/${shopKey}/gift-cards/purchase`, {
        amount: resolvedAmount,
        deliveryType,
        recipientEmail,
        recipientName: recipientName || undefined,
        senderName: senderName || undefined,
        senderEmail: senderEmail || undefined,
        message: message || undefined,
        shippingAddress: deliveryType === 'physical' ? shippingAddress : undefined,
        shippingZip: deliveryType === 'physical' ? shippingZip : undefined,
        shippingCity: deliveryType === 'physical' ? shippingCity : undefined,
        shippingCountry: deliveryType === 'physical' ? 'CH' : undefined,
        ...shopCheckoutOriginPayload(base),
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
    const normalized = normalizeAdyenPaymentSession(session);
    if (!normalized || !dropinEl || dropinMounted.current) return;
    dropinMounted.current = true;
    const mount = async () => {
      try {
        await mountAdyenDropin({
          session: normalized,
          container: dropinEl,
          locale: adyenLocaleFor(locale),
          credentialSource: 'merchant',
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
          onError: (err) =>
            setPayMsg(formatAdyenError(err, 'dropin', 'merchant') || t('actionFailed')),
        });
      } catch (err) {
        setPayMsg(formatAdyenError(err, 'dropin', 'merchant') || t('shopGiftCardPayLoadFailed'));
        dropinMounted.current = false;
      }
    };
    void mount();
  }, [session, dropinEl, shopKey, purchaseId, base, t, locale]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf8f5] text-stone-500">
        …
      </div>
    );
  }

  if (!settings?.enabled) {
    return (
      <ShopThemeShell theme={cmsTheme} site={shopSite} pageTitle="Gift cards" className="min-h-screen">
        <div className="min-h-screen bg-[#faf8f5] text-stone-900">
          <ShopMinimalHeader
            basePath={base}
            merchantName={merchant?.name}
            logoUrl={merchant?.shopLogoUrl}
            loggedIn={loggedIn}
          />
          <div className="shop-page-content py-12 text-center">
            <p className="text-stone-600">{t('shopGiftCardUnavailable')}</p>
            <Link to={base || '/'} className="mt-4 inline-block text-stone-900 underline">
              {t('shopBackHome')}
            </Link>
          </div>
        </div>
      </ShopThemeShell>
    );
  }

  return (
    <ShopThemeShell theme={cmsTheme} site={shopSite} pageTitle="Gift cards" className="min-h-screen">
    <div className="min-h-screen bg-[#faf8f5] text-stone-900">
      <ShopMinimalHeader
        basePath={base}
        merchantName={merchant?.name}
        logoUrl={merchant?.shopLogoUrl}
        loggedIn={loggedIn}
      />

      <main className="shop-page-content max-w-3xl py-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-stone-900 text-white flex items-center justify-center">
            <Gift size={20} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('shopGiftCardTitle')}</h1>
        </div>
        <p className="text-stone-600 mb-8">{t('shopGiftCardSubtitleFull')}</p>

        {!purchaseId ? (
          <>
            <section className="mb-6 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-stone-900">{t('shopGiftCardCheckBalance')}</h2>
              <p className="mt-1 text-sm text-stone-500">{t('shopGiftCardCheckBalanceHint')}</p>
              <form
                onSubmit={(e) => void checkBalance(e)}
                className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
              >
                <label className="block min-w-0 flex-1">
                  <span className="sr-only">{t('shopGiftCardCode')}</span>
                  <input
                    type="text"
                    value={balanceCode}
                    onChange={(e) => {
                      setBalanceCode(e.target.value);
                      if (balanceError) setBalanceError(null);
                      if (balanceResult) setBalanceResult(null);
                    }}
                    placeholder={t('shopGiftCardCode')}
                    className="w-full rounded-xl border border-stone-300 px-4 py-3 font-mono text-sm"
                    autoComplete="off"
                  />
                </label>
                <button
                  type="submit"
                  disabled={balanceLoading || !balanceCode.trim()}
                  className="inline-flex shrink-0 items-center justify-center rounded-full border border-stone-300 bg-white px-5 py-3 text-sm font-semibold text-stone-900 hover:border-stone-400 disabled:opacity-50"
                >
                  {balanceLoading ? '…' : t('shopGiftCardCheckBalance')}
                </button>
              </form>
              {balanceError ? <p className="mt-3 text-sm text-red-600">{balanceError}</p> : null}
              {balanceResult ? (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                  <p className="text-sm text-emerald-900">{t('shopGiftCardBalance')}</p>
                  <p className="mt-1 text-3xl font-bold tracking-tight text-emerald-950">
                    CHF {balanceResult.balance.toFixed(2)}
                  </p>
                  {balanceResult.holderName ? (
                    <p className="mt-1 text-sm text-emerald-800">{balanceResult.holderName}</p>
                  ) : null}
                  <Link
                    to={`${base}/gift/${encodeURIComponent(balanceResult.code)}`.replace(/\/+/g, '/')}
                    className="mt-3 inline-flex text-sm font-semibold text-emerald-900 underline"
                  >
                    {t('shopGiftCardViewFull')}
                  </Link>
                </div>
              ) : null}
            </section>

          <form
            onSubmit={startPurchase}
            className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-6"
          >
            {showDigital && showPhysical ? (
              <div>
                <p className="text-sm font-medium mb-3">{t('shopGiftCardDeliveryType')}</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setDeliveryType('digital')}
                    className={`rounded-xl border p-4 text-left transition-colors ${
                      deliveryType === 'digital'
                        ? 'border-stone-900 bg-stone-900 text-white'
                        : 'border-stone-200 hover:border-stone-400'
                    }`}
                  >
                    <Mail className="mb-2 h-5 w-5" />
                    <p className="font-semibold">{t('shopGiftCardDigital')}</p>
                    <p
                      className={`text-xs mt-1 ${deliveryType === 'digital' ? 'text-stone-200' : 'text-stone-500'}`}
                    >
                      {t('shopGiftCardDigitalHint')}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryType('physical')}
                    className={`rounded-xl border p-4 text-left transition-colors ${
                      deliveryType === 'physical'
                        ? 'border-stone-900 bg-stone-900 text-white'
                        : 'border-stone-200 hover:border-stone-400'
                    }`}
                  >
                    <Package className="mb-2 h-5 w-5" />
                    <p className="font-semibold">{t('shopGiftCardPhysical')}</p>
                    <p
                      className={`text-xs mt-1 ${deliveryType === 'physical' ? 'text-stone-200' : 'text-stone-500'}`}
                    >
                      {t('shopGiftCardPhysicalHint')}
                    </p>
                  </button>
                </div>
              </div>
            ) : null}

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
              <label className="block sm:col-span-2">
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
              <label className="block sm:col-span-2">
                <span className="text-sm font-medium">{t('shopGiftCardSenderEmail')}</span>
                <input
                  type="email"
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-300 px-4 py-3"
                />
              </label>
            </div>

            {deliveryType === 'physical' ? (
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 space-y-3">
                <p className="text-sm font-semibold">{t('shopGiftCardShippingAddress')}</p>
                <input
                  className="w-full rounded-xl border border-stone-300 px-4 py-3 text-sm"
                  placeholder={t('shopStreetAddress')}
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  required
                />
                <div className="grid sm:grid-cols-2 gap-3">
                  <input
                    className="w-full rounded-xl border border-stone-300 px-4 py-3 text-sm"
                    placeholder={t('shopZip')}
                    value={shippingZip}
                    onChange={(e) => setShippingZip(e.target.value)}
                    required
                  />
                  <input
                    className="w-full rounded-xl border border-stone-300 px-4 py-3 text-sm"
                    placeholder={t('shopCity')}
                    value={shippingCity}
                    onChange={(e) => setShippingCity(e.target.value)}
                    required
                  />
                </div>
              </div>
            ) : null}

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
              className="w-full py-3.5 rounded-full bg-[var(--shop-accent,#e11d48)] text-white font-semibold disabled:opacity-50"
            >
              {submitting
                ? '…'
                : t('shopGiftCardPay').replace('{amount}', resolvedAmount.toFixed(2))}
            </button>
          </form>
          </>
        ) : (
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-2">{t('shopGiftCardPayment')}</h2>
            <p className="text-stone-600 text-sm mb-4">
              CHF {resolvedAmount.toFixed(2)} ·{' '}
              {deliveryType === 'physical' ? t('shopGiftCardPhysical') : t('shopGiftCardDigital')}
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
            <div ref={setDropinEl} />
          </div>
        )}
      </main>
    </div>
    </ShopThemeShell>
  );
}
