import { useParams } from 'react-router-dom';
import { resolveShopKey } from '@/lib/shop-cart';
import ShopFooter from '@/components/shop/ShopFooter';
import { Link } from 'react-router-dom';
import { useI18n } from '@/lib/i18n';
import ShopPlatformFooterBand from '@/components/shop/ShopPlatformFooterBand';

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
        <ShopFooter shopKey={shopKey} basePath={basePath} />
      </div>
    );
  }

  return (
    <footer className={`shop-storefront-footer mt-auto w-full text-stone-200 ${shellClass}`}>
      {merchantName ? (
        <div className="shop-page-content pb-0 pt-8">
          <div className="rounded-xl bg-stone-800/95 px-4 py-4 text-white">
            <p className="text-base font-semibold">{merchantName}</p>
            <nav className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-stone-300">
              <Link to={basePath || '/'} className="hover:text-white">
                {t('shopHome')}
              </Link>
              <Link to={menuPath} className="hover:text-white">
                {t('shopOrder')}
              </Link>
            </nav>
          </div>
        </div>
      ) : null}
      <ShopPlatformFooterBand />
    </footer>
  );
}
