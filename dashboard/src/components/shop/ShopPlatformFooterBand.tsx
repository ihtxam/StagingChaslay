import { APP_NAME, PLATFORM_MARKETING_ORIGIN, getRebornLogoWhiteUrl } from '@/lib/brand';
import { useI18n } from '@/lib/i18n';
import ShopPaymentMethodIcons from '@/components/shop/ShopPaymentMethodIcons';
import { usePlatformLegalUrls } from '@/hooks/usePlatformLegalUrls';

type Props = {
  siteHost?: string;
};

/** Platform footer (Reborn logo, legal, payments) — login-style charcoal + burgundy gradient. */
export default function ShopPlatformFooterBand({ siteHost }: Props) {
  const { t } = useI18n();
  const year = new Date().getFullYear();
  const logoUrl = getRebornLogoWhiteUrl();
  const legal = usePlatformLegalUrls();

  const legalLinkClass =
    'text-stone-400 underline-offset-2 hover:text-white hover:underline transition-colors';

  return (
    <div className="shop-platform-footer__band relative z-[1] mt-8 border-t border-white/10">
      <div className="shop-platform-footer__inner shop-page-content py-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <a
              href={PLATFORM_MARKETING_ORIGIN}
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
            <nav className="text-xs sm:text-sm" aria-label={t('shopFooterPlatformLegal')}>
              <p className="flex flex-wrap items-center gap-x-1 gap-y-1">
                <a
                  href={legal.privacy}
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
                  href={legal.terms}
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
                  href={legal.cookies}
                  className={legalLinkClass}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('shopFooterPlatformCookies')}
                </a>
              </p>
            </nav>
          </div>

          <div className="lg:text-right">
            <p className="text-xs text-stone-400 sm:text-sm">
              {t('shopFooterPlatformCopyright', { year: String(year), brand: APP_NAME })}
            </p>
            <ShopPaymentMethodIcons className="mt-3 lg:justify-end" />
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
