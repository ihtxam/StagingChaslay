import { useParams } from 'react-router-dom';
import { resolveShopKey } from '@/lib/shop-cart';
import ShopFooter from '@/components/shop/ShopFooter';
import { Link } from 'react-router-dom';
import { useI18n } from '@/lib/i18n';

/** Shop footer when the shop key is known; compact fallback otherwise. */
export default function ShopStorefrontFooter({
  basePath,
  merchantName,
  className = '',
}: {
  basePath: string;
  merchantName?: string | null;
  className?: string;
}) {
  const { t } = useI18n();
  const { merchantSlug } = useParams<{ merchantSlug?: string }>();
  const shopKey = resolveShopKey(merchantSlug);
  const menuPath = `${basePath}/menu`.replace(/\/+/g, '/');

  const shellClass = `shop-full-bleed mt-auto w-full ${className}`.trim();

  if (shopKey) {
    return (
      <div className={shellClass}>
        <ShopFooter shopKey={shopKey} />
      </div>
    );
  }

  return (
    <footer className={`shop-storefront-footer border-t border-stone-200 bg-white ${shellClass}`}>
      <div className="shop-page-content py-8 pb-6">
        {merchantName ? (
          <p className="text-base font-bold tracking-tight text-stone-900">{merchantName}</p>
        ) : null}
        <nav className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm font-medium text-stone-600">
          <Link to={basePath || '/'} className="hover:text-stone-900">
            {t('shopHome')}
          </Link>
          <Link to={menuPath} className="hover:text-stone-900">
            {t('shopOrder')}
          </Link>
        </nav>
        <p className="mt-5 text-xs text-stone-400">{t('shopPoweredByRebornPOS')}</p>
      </div>
    </footer>
  );
}
