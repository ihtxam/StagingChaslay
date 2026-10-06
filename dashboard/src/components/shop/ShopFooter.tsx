import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { MapPin, Phone } from 'lucide-react';
import { resolveShopKey } from '@/lib/shop-cart';
import { formatShopPhoneDisplay } from '@/lib/shop-phone-format';
import { SHOP_HOST } from '@/lib/brand';
import ShopPlatformFooterBand from '@/components/shop/ShopPlatformFooterBand';

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
  const { merchantSlug } = useParams<{ merchantSlug?: string; locationSlug?: string }>();
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

  if (!resolvedKey || !info?.name) return null;

  const addressLine = formatAddressLine(info);
  const phoneDisplay = formatShopPhoneDisplay(info.phone);
  const phoneTel = String(info.phone || '').replace(/\s+/g, '');

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

      <ShopPlatformFooterBand siteHost={siteHost} />
    </footer>
  );
}
