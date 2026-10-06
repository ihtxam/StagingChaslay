import { useParams } from 'react-router-dom';
import { resolveShopKey } from '@/lib/shop-cart';
import ShopFooter from '@/components/shop/ShopFooter';
import { Link } from 'react-router-dom';
import { useI18n } from '@/lib/i18n';
import { APP_NAME, MARKETING_ORIGIN, PLATFORM_LEGAL_URLS, REBORN_LOGO_WHITE } from '@/lib/brand';
import ShopPaymentMethodIcons from '@/components/shop/ShopPaymentMethodIcons';

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

  const year = new Date().getFullYear();
  const legalLinkClass =
    'text-stone-300 underline-offset-2 hover:text-white hover:underline transition-colors';

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
      <div className="shop-platform-footer mt-6 bg-stone-950">
        <div className="shop-page-content py-6">
          <div className="flex flex-col gap-4 border-b border-stone-800 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <a href={MARKETING_ORIGIN} target="_blank" rel="noopener noreferrer" className="inline-flex">
              <img src={REBORN_LOGO_WHITE} alt={APP_NAME} className="h-8 w-auto sm:h-9" loading="lazy" />
            </a>
            <p className="text-xs text-stone-500">{t('shopFooterPlatformCopyright', { year: String(year), brand: APP_NAME })}</p>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <nav className="text-xs sm:text-sm">
              <a href={PLATFORM_LEGAL_URLS.privacy} className={legalLinkClass} target="_blank" rel="noopener noreferrer">
                {t('shopFooterPlatformPrivacy')}
              </a>
              <span className="mx-1 text-stone-600">|</span>
              <a href={PLATFORM_LEGAL_URLS.terms} className={legalLinkClass} target="_blank" rel="noopener noreferrer">
                {t('shopFooterPlatformTerms')}
              </a>
              <span className="mx-1 text-stone-600">|</span>
              <a href={PLATFORM_LEGAL_URLS.imprint} className={legalLinkClass} target="_blank" rel="noopener noreferrer">
                {t('shopFooterPlatformImprint')}
              </a>
            </nav>
            <div className="sm:text-right">
              <ShopPaymentMethodIcons className="sm:justify-end" />
              <p className="mt-2 text-[11px] text-stone-500">{t('shopFooterPricesIncludeVat')}</p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
