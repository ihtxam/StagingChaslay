import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { resolveShopKey, shopBasePath } from '@/lib/shop-cart';
import { useI18n } from '@/lib/i18n';
import ShopLangSwitcher from '@/components/shop/ShopLangSwitcher';

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

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="max-w-lg mx-auto px-4 py-4 flex justify-between items-center">
          <span className="font-semibold">{t('shopGiftCardTitle')}</span>
          <ShopLangSwitcher />
        </div>
      </header>
      <main className="max-w-lg mx-auto px-4 py-12 text-center">
        {error && <p className="text-red-600">{error}</p>}
        {data && (
          <>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-2xl">
              ✓
            </div>
            <h1 className="text-2xl font-semibold mb-2">{t('shopGiftCardSuccess')}</h1>
            <p className="text-stone-600 mb-6">{t('shopGiftCardSuccessHint')}</p>
            {data.cardCode && (
              <div className="bg-white border border-stone-200 rounded-2xl p-6 mb-6">
                <p className="text-sm text-stone-500 mb-1">{t('shopGiftCardCode')}</p>
                <p className="font-mono text-xl tracking-wide">{data.cardCode}</p>
                <p className="mt-3 text-lg font-semibold">
                  CHF {Number(data.cardBalance || data.amount).toFixed(2)}
                </p>
              </div>
            )}
            <Link
              to={`${base}/menu`}
              className="inline-flex px-6 py-3 rounded-full bg-stone-900 text-white font-medium"
            >
              {t('shopOrderOnline')} →
            </Link>
          </>
        )}
        {!data && !error && <p className="text-stone-500">…</p>}
      </main>
    </div>
  );
}
