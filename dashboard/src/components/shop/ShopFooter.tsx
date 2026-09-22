import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { resolveShopKey, resolveShopLocationSlug, shopBasePath } from '@/lib/shop-cart';
import { formatShopPhoneDisplay } from '@/lib/shop-phone-format';
import { useI18n } from '@/lib/i18n';

type ShopFooterInfo = {
  name: string;
  description?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  email?: string | null;
  phone?: string | null;
};

function formatAddress(info: ShopFooterInfo): string | null {
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
  const locSlug = resolveShopLocationSlug({ locationSlug });
  const basePath = useMemo(() => shopBasePath(resolvedKey, locSlug), [resolvedKey, locSlug]);

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
          description: data.description || null,
          address: data.address || null,
          city: data.city || null,
          country: data.country || null,
          email: data.email || null,
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

  if (!resolvedKey || !info?.name) return null;

  const addressLine = formatAddress(info);
  const year = new Date().getFullYear();
  const description =
    String(info.description || '').trim() ||
    t('shopFooterAboutFallback', { shopName: info.name });
  const phoneDisplay = formatShopPhoneDisplay(info.phone);
  const phoneTel = String(info.phone || '').replace(/\s+/g, '');

  const linkClass =
    'text-sm text-[#666666] hover:text-stone-900 transition-colors underline-offset-2 hover:underline';

  return (
    <footer id="contact" className="shop-global-footer mt-auto w-full border-t border-stone-200 bg-white text-stone-700">
      <div className="shop-page-content py-10">
        <div className="grid grid-cols-1 gap-6 border-b border-stone-200 pb-8 lg:grid-cols-3 lg:gap-8">
          <div>
            <h2 className="text-base font-bold text-stone-900">{info.name}</h2>
            <p className="mt-3 text-sm leading-relaxed text-[#666666]">{description}</p>
          </div>

          <div>
            <h2 className="text-base font-bold text-stone-900">{t('shopFooterQuickLinks')}</h2>
            <ul className="mt-3 space-y-2">
              <li>
                <Link to={basePath || '/'} className={linkClass}>
                  {t('shopHome')}
                </Link>
              </li>
              <li>
                <Link to={`${basePath}/menu`} className={linkClass}>
                  {t('shopFooterMenu')}
                </Link>
              </li>
              <li>
                <Link to={`${basePath}/checkout`} className={linkClass}>
                  {t('shopBasket')}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-base font-bold text-stone-900">{t('shopContact')}</h2>
            <ul className="mt-3 space-y-2 text-sm text-[#666666]">
              {addressLine ? <li>{addressLine}</li> : null}
              {info.email ? (
                <li>
                  <a href={`mailto:${info.email}`} className={linkClass}>
                    {info.email}
                  </a>
                </li>
              ) : null}
              {phoneDisplay ? (
                <li>
                  <a href={`tel:${phoneTel}`} className={linkClass}>
                    {phoneDisplay}
                  </a>
                </li>
              ) : null}
            </ul>
          </div>
        </div>

        <div className="pt-6 text-center text-xs text-stone-500 sm:text-sm">
          <p>
            {t('shopFooterCopyright', { year: String(year), shopName: info.name })}{' '}
            <Link to={`${basePath}/pages/privacy-policy`} className="underline-offset-2 hover:underline">
              {t('shopFooterPrivacyPolicy')}
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
