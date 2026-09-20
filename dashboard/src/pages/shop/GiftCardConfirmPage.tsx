import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { User } from 'lucide-react';
import { resolveShopKey, loadCustomerToken, shopBasePath } from '@/lib/shop-cart';
import { useI18n } from '@/lib/i18n';
import ShopMinimalHeader from '@/components/shop/ShopMinimalHeader';
import ShopGiftCardVoucher from '@/components/shop/ShopGiftCardVoucher';

type PurchaseView = {
  id: string;
  amount: string;
  deliveryType?: string;
  recipientEmail?: string;
  recipientName?: string | null;
  message?: string | null;
  paymentStatus?: string;
  shippingAddress?: string | null;
  shippingZip?: string | null;
  shippingCity?: string | null;
  cardCode?: string | null;
  cardBalance?: string | null;
  qrPayload?: string | null;
  barcodePayload?: string | null;
};

export default function GiftCardConfirmPage() {
  const { t } = useI18n();
  const { merchantSlug, purchaseId = '' } = useParams<{
    merchantSlug?: string;
    purchaseId?: string;
  }>();
  const shopKey = useMemo(() => resolveShopKey(merchantSlug), [merchantSlug]);
  const base = shopBasePath(shopKey);
  const accountPath = `${base}/account`.replace(/\/+/g, '/');
  const giftCardsPath = `${base}/gift-cards`.replace(/\/+/g, '/');
  const loggedIn = !!loadCustomerToken(shopKey);
  const [data, setData] = useState<PurchaseView | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!shopKey || !purchaseId) return;
    try {
      const res = await axios.get(`/api/shop/${shopKey}/gift-cards/purchase/${purchaseId}`);
      setData(res.data?.purchase);
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.error || t('loadFailed'));
    }
  }, [shopKey, purchaseId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!data || data.paymentStatus === 'completed' || data.paymentStatus === 'failed') return;
    const poll = window.setInterval(() => void load(), 3000);
    return () => window.clearInterval(poll);
  }, [data?.paymentStatus, load]);

  const isPhysical = data?.deliveryType === 'physical';
  const isPaid = data?.paymentStatus === 'completed';
  const isFailed = data?.paymentStatus === 'failed' || data?.paymentStatus === 'cancelled';
  const isPending = !!data && !isPaid && !isFailed;

  return (
    <div className="min-h-screen bg-[#faf8f5] text-stone-900">
      <ShopMinimalHeader
        basePath={base}
        merchantName={undefined}
        shopKey={shopKey}
        loggedIn={loggedIn}
      />
      <main className="shop-page-content max-w-lg py-12">
        {error && <p className="text-center text-red-600">{error}</p>}

        {isFailed && (
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center text-2xl">
              !
            </div>
            <h1 className="text-2xl font-semibold mb-2">{t('shopPaymentCancelled')}</h1>
            <p className="text-stone-600 mb-6">{t('shopPaymentCancelledMsg')}</p>
            <Link
              to={giftCardsPath}
              className="inline-flex px-6 py-3 rounded-full bg-stone-900 text-white font-medium"
            >
              {t('shopGiftCardTitle')} →
            </Link>
          </div>
        )}

        {isPending && (
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-stone-100 text-stone-600 flex items-center justify-center text-2xl">
              …
            </div>
            <h1 className="text-2xl font-semibold mb-2">{t('shopGiftCardPayment')}</h1>
            <p className="text-stone-600 mb-6">{t('shopGiftCardConfirmPending')}</p>
            <Link
              to={giftCardsPath}
              className="inline-flex px-6 py-3 rounded-full border border-stone-300 bg-white font-medium text-stone-900"
            >
              {t('shopGiftCardTitle')}
            </Link>
          </div>
        )}

        {isPaid && data && (
          <>
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-2xl">
                ✓
              </div>
              <h1 className="text-2xl font-semibold mb-2">
                {isPhysical ? t('shopGiftCardPhysicalSuccess') : t('shopGiftCardSuccess')}
              </h1>
              <p className="text-stone-600">
                {isPhysical ? t('shopGiftCardPhysicalSuccessHint') : t('shopGiftCardSuccessHint')}
              </p>
            </div>

            {isPhysical && data.shippingAddress ? (
              <div className="bg-white border border-stone-200 rounded-2xl p-5 mb-6 text-sm text-stone-600">
                <p className="font-semibold text-stone-900 mb-2">{t('shopGiftCardShippingTo')}</p>
                <p>{data.recipientName}</p>
                <p>{data.shippingAddress}</p>
                <p>
                  {data.shippingZip} {data.shippingCity}
                </p>
              </div>
            ) : null}

            {data.cardCode && !isPhysical ? (
              <div className="bg-white border border-stone-200 rounded-2xl p-6 mb-6">
                <p className="text-center text-lg font-semibold mb-1">
                  CHF {Number(data.cardBalance || data.amount).toFixed(2)}
                </p>
                <ShopGiftCardVoucher
                  code={data.cardCode}
                  qrPayload={data.qrPayload}
                  barcodePayload={data.barcodePayload}
                />
                <p className="mt-4 text-center text-xs text-stone-500">{t('shopGiftCardPosHint')}</p>
              </div>
            ) : null}

            {data.cardCode && isPhysical ? (
              <div className="bg-white border border-stone-200 rounded-2xl p-5 mb-6 text-center">
                <p className="text-sm text-stone-500 mb-1">{t('shopGiftCardCode')}</p>
                <p className="font-mono text-lg">{data.cardCode}</p>
                <p className="mt-2 text-sm text-stone-500">{t('shopGiftCardPhysicalCodeHint')}</p>
              </div>
            ) : null}

            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                to={`${base}/menu`}
                className="inline-flex px-6 py-3 rounded-full bg-stone-900 text-white font-medium"
              >
                {t('shopOrderOnline')} →
              </Link>
              <Link
                to={accountPath}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-stone-300 bg-white font-medium text-stone-900"
              >
                <User className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                {t('shopMyAccount')}
              </Link>
            </div>
          </>
        )}

        {!data && !error && <p className="text-center text-stone-500">…</p>}
      </main>
    </div>
  );
}
