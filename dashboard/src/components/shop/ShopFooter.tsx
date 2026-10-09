import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { Mail, MapPin, Phone } from 'lucide-react';
import { resolveShopKey, shopBasePath } from '@/lib/shop-cart';
import { shopMerchantWideBasePath } from '@/lib/shop-base-path';
import { formatShopPhoneDisplay } from '@/lib/shop-phone-format';
import { useI18n } from '@/lib/i18n';
import type { StoreHours } from '@/lib/shop-hours';
import { summarizeStoreHours } from '@/lib/shop-hours-display';
import ShopPlatformFooterBand from '@/components/shop/ShopPlatformFooterBand';
import ShopAppStoreBadges from '@/components/shop/ShopAppStoreBadges';

type ShopFooterInfo = {
  name: string;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  vatNumber?: string | null;
  storeHours?: StoreHours | null;
  giftCards?: { enabled?: boolean };
  language?: string;
};

function formatAddressLine(info: ShopFooterInfo): string | null {
  const parts = [info.address, info.city, info.country].map((p) => String(p || '').trim()).filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

type Props = {
  shopKey: string;
  basePath?: string;
};

export default function ShopFooter({ shopKey, basePath: basePathProp }: Props) {
  const { t, locale } = useI18n();
  const { merchantSlug, locationSlug } = useParams<{ merchantSlug?: string; locationSlug?: string }>();
  const resolvedKey = shopKey || resolveShopKey(merchantSlug);
  const basePath =
    basePathProp ||
    shopBasePath(resolvedKey, locationSlug ? String(locationSlug) : null);

  const [info, setInfo] = useState<ShopFooterInfo | null>(null);

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
          email: data.email || null,
          vatNumber: data.vatNumber || null,
          storeHours: (data.storeHours as StoreHours) || null,
          giftCards: data.giftCards || undefined,
          language: data.language || undefined,
        });
      } catch {
        if (!cancelled) setInfo(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resolvedKey]);

  const merchantWide = shopMerchantWideBasePath(basePath);
  const menuPath = `${basePath}/menu`.replace(/\/+/g, '/');
  const giftPath = `${merchantWide}/gift-cards`.replace(/\/+/g, '/');
  const locationsPath = `${merchantWide}/locations`.replace(/\/+/g, '/');
  const homePath = merchantWide || basePath || '/';

  const hoursLocale = info?.language || locale || 'en';
  const hourRows = useMemo(
    () => summarizeStoreHours(info?.storeHours, undefined, hoursLocale),
    [info?.storeHours, hoursLocale]
  );

  if (!resolvedKey || !info?.name) return null;

  const addressLine = formatAddressLine(info);
  const phoneDisplay = formatShopPhoneDisplay(info.phone);
  const phoneTel = String(info.phone || '').replace(/\s+/g, '');
  const vat = String(info.vatNumber || '').trim();
  const email = String(info.email || '').trim();
  const giftCardsOn = info.giftCards?.enabled === true;

  return (
    <footer id="contact" className="shop-global-footer shop-platform-footer mt-auto w-full text-stone-200">
      <div className="shop-page-content relative z-[1] pb-2 pt-10">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          <div className="rounded-xl bg-stone-900/70 px-4 py-4 ring-1 ring-white/10 sm:px-5">
            <p className="inline-block rounded bg-stone-700/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-stone-300">
              {t('shopFooterMerchantImprint')}
            </p>
            <p className="mt-2 text-lg font-semibold leading-snug text-white">{info.name}</p>
            {addressLine ? (
              <p className="mt-3 flex items-start gap-2 text-sm text-stone-300">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                <span>{addressLine}</span>
              </p>
            ) : null}
            {phoneDisplay ? (
              <p className="mt-2 flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 shrink-0 text-stone-400" strokeWidth={2} aria-hidden />
                <a href={`tel:${phoneTel}`} className="text-stone-100 hover:underline">
                  {phoneDisplay}
                </a>
              </p>
            ) : null}
            {email ? (
              <p className="mt-2 flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 shrink-0 text-stone-400" strokeWidth={2} aria-hidden />
                <a href={`mailto:${email}`} className="break-all text-stone-100 hover:underline">
                  {email}
                </a>
              </p>
            ) : null}
            {vat ? (
              <p className="mt-2 text-xs text-stone-400">{t('shopFooterVatNumber', { vat })}</p>
            ) : null}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              {t('shopOpeningHours')}
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-stone-200">
              {hourRows.map((row) => (
                <li key={row.label}>
                  <span className="text-stone-300">{row.label}:</span>{' '}
                  <span className="text-white">{row.hours.replace(/-/g, ' - ')}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              {t('shopFooterQuickLinks')}
            </p>
            <nav className="mt-3 flex flex-col gap-2 text-sm" aria-label={t('shopFooterQuickLinks')}>
              <Link to={menuPath} className="text-stone-200 hover:text-white hover:underline">
                {t('shopFooterMenu')}
              </Link>
              <Link to={menuPath} className="text-stone-200 hover:text-white hover:underline">
                {t('shopFooterOrderOnline')}
              </Link>
              {giftCardsOn ? (
                <Link to={giftPath} className="text-stone-200 hover:text-white hover:underline">
                  {t('shopFooterGiftCards')}
                </Link>
              ) : null}
              <Link to={homePath} className="text-stone-200 hover:text-white hover:underline">
                {t('shopFooterAboutUs')}
              </Link>
              <Link to={locationsPath} className="text-stone-200 hover:text-white hover:underline">
                {t('shopFooterLocations')}
              </Link>
            </nav>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              {t('shopFooterDownloadApp')}
            </p>
            <div className="mt-3">
              <ShopAppStoreBadges />
            </div>
          </div>
        </div>
      </div>

      <ShopPlatformFooterBand />
    </footer>
  );
}
