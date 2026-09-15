import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { resolveShopKey, shopBasePath } from '@/lib/shop-cart';
import { useI18n } from '@/lib/i18n';
import ShopLangSwitcher from '@/components/shop/ShopLangSwitcher';
import ShopGiftCardVoucher from '@/components/shop/ShopGiftCardVoucher';

export default function GiftCardConfirmPage() {
  const { t } = useI18n();
  const { merchantSlug, purchaseId = '' } = useParams<{
    merchantSlug?: string;
    purchaseId?: string;
  }>();
  const [searchParams] = useSearchParams();
  const shopKey = useMemo(() => resolveShopKey(merchantSlug), [merchantSlug]);
  const base = shopBasePath(shopKey);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!shopKey || !purchaseId) return;
    const run = async () => {
      try {
        if (searchParams.get('paid') === '1') {
          try {
            await axios.post(
              `/api/shop/${shopKey}/gift-cards/purchase/${purchaseId}/confirm-payment`,
              {}
            );
          } catch {
            /* may already be confirmed */
          }
        }
        const res = await axios.get(
          `/api/shop/${shopKey}/gift-cards/purchase/${purchaseId}`
        );
        setData(res.data?.purchase);
      } catch (err: any) {
        setError(err?.response?.data?.error || t('loadFailed'));
      }
    };
    void run();
  }, [shopKey, purchaseId, searchParams, t]);

  const isPhysical = data?.deliveryType === 'physical';

  return (
    <div className="min-h-screen bg-[#faf8f5] text-stone-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="max-w-lg mx-auto px-4 py-4 flex justify-between items-center">
          <span className="font-semibold">{t('shopGiftCardTitle')}</span>
          <ShopLangSwitcher />
        </div>
      </header>
      <main className="max-w-lg mx-auto px-4 py-12">
        {error && <p className="text-center text-red-600">{error}</p>}
        {data && (
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

            <div className="text-center">
              <Link
                to={`${base}/menu`}
                className="inline-flex px-6 py-3 rounded-full bg-stone-900 text-white font-medium"
              >
                {t('shopOrderOnline')} →
              </Link>
            </div>
          </>
        )}
        {!data && !error && <p className="text-center text-stone-500">…</p>}
      </main>
    </div>
  );
}
