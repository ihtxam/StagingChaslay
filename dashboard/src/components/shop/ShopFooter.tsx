import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { MapPin, Phone } from 'lucide-react';
import { resolveShopKey } from '@/lib/shop-cart';
import { formatShopPhoneDisplay } from '@/lib/shop-phone-format';
import { useI18n } from '@/lib/i18n';
import {
  APP_NAME,
  MARKETING_ORIGIN,
  PLATFORM_LEGAL_URLS,
  REBORN_LOGO_WHITE,
  SHOP_HOST,
} from '@/lib/brand';
import ShopPaymentMethodIcons from '@/components/shop/ShopPaymentMethodIcons';

type ShopFooterInfo = {
  name: string;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
};

function formatAddressLine(info: ShopFooterInfo): string | null {
  const parts = [info.address, info.city, info.country].map((p) => String(p || '').trim()).filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

type Props = {
  shopKey: string;
};

export default function ShopFooter({ shopKey }: Props) {
  const { t } = useI18n();
  const { merchantSlug, locationSlug } = useParams<{ merchantSlug?: string; locationSlug?: string }>();
  const resolvedKey = shopKey || resolveShopKey(merchantSlug);

  const [info, setInfo] = useState<ShopFooterInfo | null>(null);
  const [siteHost, setSiteHost] = useState(SHOP_HOST);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setSiteHost(window.location.hostname || SHOP_HOST);
    }
  }, []);

  useEffect(() => {
    if (!resolvedKey) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`/api/shop/${encodeURIComponent(resolvedKey)}`);
        const data = res.data?.data;
        if (cancelled || !data) return;
        setInfo({
          name: data.name || '',
          address: data.address || null,
          city: data.city || null,
          country: data.country || null,
          phone: data.phone || null,
        });
      } catch {
        if (!cancelled) setInfo(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resolvedKey]);

  const year = useMemo(() => new Date().getFullYear(), []);

  if (!resolvedKey || !info?.name) return null;

  const addressLine = formatAddressLine(info);
  const phoneDisplay = formatShopPhoneDisplay(info.phone);
  const phoneTel = String(info.phone || '').replace(/\s+/g, '');

  const legalLinkClass =
    'text-stone-300 underline-offset-2 hover:text-white hover:underline transition-colors';

  return (
    <footer id="contact" className="shop-global-footer mt-auto w-full text-stone-200">
      <div className="shop-page-content pb-0 pt-8">
        <div className="rounded-xl bg-stone-800/95 px-4 py-4 text-white shadow-sm sm:px-5">
          <p className="text-base font-semibold leading-snug">{info.name}</p>
          {addressLine ? (
            <p className="mt-2 flex items-start gap-2 text-sm text-stone-300">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
              <span>{addressLine}</span>
            </p>
          ) : null}
          {phoneDisplay ? (
            <p className="mt-2 flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 shrink-0 text-stone-300" strokeWidth={2} aria-hidden />
              <a href={`tel:${phoneTel}`} className="text-stone-100 hover:underline">
                {phoneDisplay}
              </a>
            </p>
          ) : null}
        </div>
      </div>

      <div className="shop-platform-footer mt-6 bg-stone-950 text-stone-300">
        <div className="shop-page-content py-6">
          <div className="flex flex-col gap-4 border-b border-stone-800 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <a
              href={MARKETING_ORIGIN}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center"
              aria-label={APP_NAME}
            >
              <img
                src={REBORN_LOGO_WHITE}
                alt={APP_NAME}
                width={140}
                height={36}
                className="h-8 w-auto max-w-[160px] sm:h-9"
                loading="lazy"
                decoding="async"
              />
            </a>
            <p className="text-xs text-stone-500 sm:text-sm">
              {t('shopFooterPlatformCopyright', { year: String(year), brand: APP_NAME })}
            </p>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8">
            <nav className="space-y-2 text-xs sm:text-sm" aria-label={t('shopFooterPlatformLegal')}>
              <p className="flex flex-wrap items-center gap-x-1 gap-y-1">
                <a href={PLATFORM_LEGAL_URLS.privacy} className={legalLinkClass} target="_blank" rel="noopener noreferrer">
                  {t('shopFooterPlatformPrivacy')}
                </a>
                <span className="text-stone-600" aria-hidden>
                  |
                </span>
                <a href={PLATFORM_LEGAL_URLS.terms} className={legalLinkClass} target="_blank" rel="noopener noreferrer">
                  {t('shopFooterPlatformTerms')}
                </a>
                <span className="text-stone-600" aria-hidden>
                  |
                </span>
                <a href={PLATFORM_LEGAL_URLS.imprint} className={legalLinkClass} target="_blank" rel="noopener noreferrer">
                  {t('shopFooterPlatformImprint')}
                </a>
              </p>
            </nav>

            <div className="sm:text-right">
              <ShopPaymentMethodIcons className="sm:justify-end" />
              <p className="mt-2 text-[11px] text-stone-500 sm:text-xs">{t('shopFooterPricesIncludeVat')}</p>
            </div>
          </div>
        </div>

        <div className="border-t border-stone-900 bg-white py-2.5 text-center">
          <p className="text-xs font-medium text-stone-800">{siteHost}</p>
        </div>
      </div>
    </footer>
  );
}
