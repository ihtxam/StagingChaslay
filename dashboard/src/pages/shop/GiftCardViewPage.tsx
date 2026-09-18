import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { resolveShopKey, loadCustomerToken, shopBasePath } from '@/lib/shop-cart';
import { useI18n } from '@/lib/i18n';
import ShopMinimalHeader from '@/components/shop/ShopMinimalHeader';
import ShopGiftCardVoucher from '@/components/shop/ShopGiftCardVoucher';

export default function GiftCardViewPage() {
  const { t } = useI18n();
  const { merchantSlug, code = '' } = useParams<{ merchantSlug?: string; code?: string }>();
  const shopKey = useMemo(() => resolveShopKey(merchantSlug), [merchantSlug]);
  const base = shopBasePath(shopKey);
  const loggedIn = !!loadCustomerToken(shopKey);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!shopKey || !code) return;
    axios
      .get(`/api/shop/${shopKey}/gift-cards/balance/${encodeURIComponent(code)}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err?.response?.data?.error || t('giftCardNotFound')));
  }, [shopKey, code, t]);

  return (
    <div className="min-h-screen bg-[#faf8f5] text-stone-900">
      <ShopMinimalHeader basePath={base} loggedIn={loggedIn} />
      <main className="shop-page-content max-w-lg py-12">
        {error && <p className="text-center text-red-600">{error}</p>}
        {data && (
          <div className="bg-white border border-stone-200 rounded-2xl p-8 shadow-sm">
            <p className="text-center text-sm text-stone-500 mb-2">{t('shopGiftCardBalance')}</p>
            <p className="text-center text-4xl font-bold mb-6">
              CHF {Number(data.balance).toFixed(2)}
            </p>
            {data.holderName ? (
              <p className="text-center text-stone-600 text-sm mb-6">{data.holderName}</p>
            ) : null}
            <ShopGiftCardVoucher
              code={data.code}
              qrPayload={data.qrPayload}
              barcodePayload={data.barcodePayload}
            />
            <p className="mt-6 text-center text-xs text-stone-500">{t('shopGiftCardPosHint')}</p>
            <Link
              to={`${base}/menu`}
              className="mt-8 flex justify-center px-6 py-3 rounded-full bg-stone-900 text-white font-medium w-fit mx-auto"
            >
              {t('shopOrderOnline')} →
            </Link>
          </div>
        )}
        {!data && !error && <p className="text-center text-stone-500">…</p>}
      </main>
    </div>
  );
}
