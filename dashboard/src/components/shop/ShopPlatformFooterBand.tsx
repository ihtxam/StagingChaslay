import { APP_NAME, MARKETING_ORIGIN, PLATFORM_LEGAL_URLS, getRebornLogoWhiteUrl } from '@/lib/brand';
import { useI18n } from '@/lib/i18n';
import ShopPaymentMethodIcons from '@/components/shop/ShopPaymentMethodIcons';

type Props = {
  siteHost?: string;
};

/** Platform footer (Reborn logo, legal, payments) — login-style charcoal + burgundy gradient. */
export default function ShopPlatformFooterBand({ siteHost }: Props) {
  const { t } = useI18n();
  const year = new Date().getFullYear();
  const logoUrl = getRebornLogoWhiteUrl();

  const legalLinkClass =
    'text-stone-300 underline-offset-2 hover:text-white hover:underline transition-colors';

  return (
    <div className="shop-platform-footer mt-6 text-stone-300">
      <div className="shop-platform-footer__inner shop-page-content py-6">
        <div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <a
            href={MARKETING_ORIGIN}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center"
            aria-label={APP_NAME}
          >
            <img
              src={logoUrl}
              alt={APP_NAME}
              width={160}
              height={48}
              className="h-10 w-auto max-w-[180px] object-contain sm:h-11"
              loading="lazy"
              decoding="async"
            />
          </a>
          <p className="text-xs text-stone-400 sm:text-sm">
            {t('shopFooterPlatformCopyright', { year: String(year), brand: APP_NAME })}
          </p>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8">
          <nav className="text-xs sm:text-sm" aria-label={t('shopFooterPlatformLegal')}>
            <p className="flex flex-wrap items-center gap-x-1 gap-y-1">
              <a
                href={PLATFORM_LEGAL_URLS.privacy}
                className={legalLinkClass}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('shopFooterPlatformPrivacy')}
              </a>
              <span className="text-stone-600" aria-hidden>
                |
              </span>
              <a
                href={PLATFORM_LEGAL_URLS.terms}
                className={legalLinkClass}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('shopFooterPlatformTerms')}
              </a>
              <span className="text-stone-600" aria-hidden>
                |
              </span>
              <a
                href={PLATFORM_LEGAL_URLS.imprint}
                className={legalLinkClass}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('shopFooterPlatformImprint')}
              </a>
            </p>
          </nav>

          <div className="sm:text-right">
            <ShopPaymentMethodIcons className="sm:justify-end" />
            <p className="mt-2 text-[11px] text-stone-400 sm:text-xs">{t('shopFooterPricesIncludeVat')}</p>
          </div>
        </div>
      </div>

      {siteHost ? (
        <div className="relative z-[1] border-t border-white/10 bg-white py-2.5 text-center">
          <p className="text-xs font-medium text-stone-800">{siteHost}</p>
        </div>
      ) : null}
    </div>
  );
}
