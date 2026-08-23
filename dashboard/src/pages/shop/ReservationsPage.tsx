import { ShoppingBag } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { resolveShopKey, shopBasePath } from '@/lib/shop-cart';
import { useI18n } from '@/lib/i18n';
import ShopLangSwitcher from '@/components/shop/ShopLangSwitcher';
import ShopVacationPopup from '@/components/shop/ShopVacationPopup';
import ShopThemeShell from '@/components/shop/ShopThemeShell';
import InlineReservationsWidget from '@/components/shop/InlineReservationsWidget';
import { useShopCmsTheme } from '@/hooks/useShopCmsTheme';
import axios from 'axios';

export default function ReservationsPage() {
  const { t } = useI18n();
  const { merchantSlug } = useParams<{ merchantSlug?: string }>();
  const shopKey = useMemo(() => resolveShopKey(merchantSlug), [merchantSlug]);
  const base = shopBasePath(shopKey);
  const cmsTheme = useShopCmsTheme(shopKey);
  const [vacation, setVacation] = useState<any>(null);

  useEffect(() => {
    if (!shopKey) return;
    let cancelled = false;
    axios.get(`/api/shop/${shopKey}/reservations/config`).then(
      (res) => {
        if (!cancelled) setVacation(res.data.config?.vacation);
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
      className="min-h-screen"
      style={{ background: 'var(--shop-bg-muted, #f6f5f2)', color: 'var(--shop-text)' }}
    >
      <div className="min-h-screen overflow-x-hidden">
        <ShopVacationPopup vacation={vacation} shopKey={shopKey} />
        <header className="sticky top-0 z-30 bg-white border-b border-stone-200">
          <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
            <Link
              to={base || '/'}
              className="font-bold tracking-tight truncate min-w-0"
              aria-label="Home"
            >
              {t('shopReservations')}
            </Link>
            <div className="flex items-center gap-1 shrink-0">
              <ShopLangSwitcher />
              <Link
                to={`${base}/menu`}
                className="inline-flex h-9 w-9 items-center justify-center text-stone-700 hover:bg-stone-100"
                aria-label={t('shopOrder')}
                title={t('shopOrder')}
              >
                <ShoppingBag className="h-5 w-5" strokeWidth={1.75} />
              </Link>
            </div>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 py-8 min-w-0 overflow-x-hidden">
          <InlineReservationsWidget shopKey={shopKey} base={base} />
        </main>
      </div>
    </ShopThemeShell>
  );
}
