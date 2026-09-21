import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { resolveShopKey, shopBasePath } from '@/lib/shop-cart';
import { useI18n } from '@/lib/i18n';
import ShopMinimalHeader from '@/components/shop/ShopMinimalHeader';
import ShopInfoSheet from '@/components/shop/ShopInfoSheet';
import ShopVacationPopup from '@/components/shop/ShopVacationPopup';
import ShopThemeShell from '@/components/shop/ShopThemeShell';
import InlineReservationsWidget from '@/components/shop/InlineReservationsWidget';
import { useShopCmsTheme } from '@/hooks/useShopCmsTheme';

export default function ReservationsPage() {
  const { t } = useI18n();
  const { merchantSlug } = useParams<{ merchantSlug?: string }>();
  const shopKey = useMemo(() => resolveShopKey(merchantSlug), [merchantSlug]);
  const base = shopBasePath(shopKey);
  const { theme: cmsTheme, site: shopSite } = useShopCmsTheme(shopKey);
  const [vacation, setVacation] = useState<any>(null);
  const [merchant, setMerchant] = useState<any>(null);
  const [infoOpen, setInfoOpen] = useState(false);

  useEffect(() => {
    if (!shopKey) return;
    let cancelled = false;
    Promise.all([
      axios.get(`/api/shop/${shopKey}/reservations/config`),
      axios.get(`/api/shop/${shopKey}`),
    ]).then(
      ([configRes, shopRes]) => {
        if (cancelled) return;
        setVacation(configRes.data.config?.vacation);
        setMerchant(shopRes.data?.data ?? null);
      },
      () => {}
    );
    return () => {
      cancelled = true;
    };
  }, [shopKey]);

  return (
    <ShopThemeShell
      theme={cmsTheme}
      site={shopSite}
      className="min-h-screen"
      style={{ background: 'var(--shop-bg-muted, #f6f5f2)', color: 'var(--shop-text)' }}
    >
      <div className="min-h-screen overflow-x-hidden bg-[#f6f5f2] text-stone-900">
        <ShopVacationPopup vacation={vacation} shopKey={shopKey} />
        <ShopMinimalHeader
          basePath={base}
          merchantName={merchant?.name}
          logoUrl={merchant?.shopLogoUrl}
          shopKey={shopKey}
          showReservations
          onStoreInfo={() => setInfoOpen(true)}
        />
        <main className="shop-page-content max-w-3xl py-8 min-w-0 overflow-x-hidden">
          <InlineReservationsWidget shopKey={shopKey} base={base} />
        </main>
        <ShopInfoSheet open={infoOpen} onClose={() => setInfoOpen(false)} merchant={merchant} zones={[]} />
      </div>
    </ShopThemeShell>
  );
}
