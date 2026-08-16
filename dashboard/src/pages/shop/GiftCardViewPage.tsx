import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { resolveShopKey, shopBasePath } from '@/lib/shop-cart';
import { useI18n } from '@/lib/i18n';
import ShopLangSwitcher from '@/components/shop/ShopLangSwitcher';

export default function GiftCardViewPage() {
  const { t } = useI18n();
  const { merchantSlug, code = '' } = useParams<{ merchantSlug?: string; code?: string }>();
  const shopKey = useMemo(() => resolveShopKey(merchantSlug), [merchantSlug]);
  const base = shopBasePath(shopKey);
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
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="max-w-lg mx-auto px-4 py-4 flex justify-between items-center">
          <Link to={base || '/'} className="font-semibold truncate">
            {t('giftCard')}
          </Link>
          <ShopLangSwitcher />
        </div>
      </header>
      <main className="max-w-lg mx-auto px-4 py-12">
        {error && <p className="text-center text-red-600">{error}</p>}
        {data && (
          <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center shadow-sm">
            <p className="text-sm text-stone-500 mb-2">{t('shopGiftCardBalance')}</p>
            <p className="text-4xl font-bold mb-4">CHF {Number(data.balance).toFixed(2)}</p>
            <p className="font-mono text-sm bg-stone-100 rounded-lg py-2 px-3 inline-block">
              {data.code}
            </p>
            {data.holderName && (
              <p className="mt-4 text-stone-600 text-sm">{data.holderName}</p>
            )}
            <Link
              to={`${base}/menu`}
              className="mt-8 inline-flex px-6 py-3 rounded-full bg-stone-900 text-white font-medium"
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
