import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { resolveShopKey, resolveShopLocationSlug, shopBasePath } from '@/lib/shop-cart';
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

  const linkClass =
    'text-sm text-stone-600 hover:text-stone-900 transition-colors underline-offset-2 hover:underline';

  return (
    <footer className="mt-auto border-t border-stone-200 bg-stone-50 text-stone-700">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <h2 className="text-base font-bold text-stone-900">{info.name}</h2>
            <p className="mt-3 text-sm leading-relaxed text-stone-600">{description}</p>
          </div>

          <div>
            <h2 className="text-base font-bold text-stone-900">{t('shopFooterQuickLinks')}</h2>
            <ul className="mt-3 space-y-2">
              <li>
                <Link to={basePath || '/'} className={linkClass}>
                  {t('shopFooterWelcome')}
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
            <ul className="mt-3 space-y-2 text-sm text-stone-600">
              {addressLine ? <li>{addressLine}</li> : null}
              {info.email ? (
                <li>
                  <a href={`mailto:${info.email}`} className={linkClass}>
                    {info.email}
                  </a>
                </li>
              ) : null}
              {info.phone ? (
                <li>
                  <a href={`tel:${info.phone.replace(/\s+/g, '')}`} className={linkClass}>
                    {info.phone}
                  </a>
                </li>
              ) : null}
            </ul>
          </div>

          <div>
            <h2 className="text-base font-bold text-stone-900">{t('shopFooterLegalNotice')}</h2>
            <ul className="mt-3 space-y-2">
              <li>
                <Link to={`${basePath}/pages/privacy-policy`} className={linkClass}>
                  {t('shopFooterPrivacyPolicy')}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-stone-200 pt-6 text-center text-xs text-stone-500 sm:text-sm">
          <p>
            {t('shopFooterCopyright', { year: String(year), shopName: info.name })}{' '}
            <a
              href="https://rebornsense.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-stone-600 hover:text-stone-900 underline-offset-2 hover:underline"
            >
              {t('shopFooterPoweredBy')}
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
