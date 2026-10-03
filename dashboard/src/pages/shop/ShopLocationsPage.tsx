import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { resolveShopKey, shopBasePath } from '@/lib/shop-cart';
import { useI18n } from '@/lib/i18n';
import ShopThemeShell from '@/components/shop/ShopThemeShell';
import ShopLocationHubWizard from '@/components/shop/ShopLocationHubWizard';
import type { ShopPublicLocation } from '@/lib/shop-location-session';
import { useShopCmsTheme } from '@/hooks/useShopCmsTheme';

/** Combined multi-location entry: pickup/delivery → store → menu vs catering (wizard, no full page menu). */
export default function ShopLocationsPage() {
  const { t } = useI18n();
  const { merchantSlug } = useParams<{ merchantSlug?: string }>();
  const shopKey = useMemo(() => resolveShopKey(merchantSlug), [merchantSlug]);
  const navigate = useNavigate();
  const { site } = useShopCmsTheme(shopKey);
  const [locations, setLocations] = useState<ShopPublicLocation[]>([]);
  const [hasCatering, setHasCatering] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shopKey) {
      setLoading(false);
      setError(t('shopNotFound'));
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`/api/shop/${shopKey}/locations`);
        if (cancelled) return;
        const list = (res.data.locations || []) as ShopPublicLocation[];
        setLocations(list);
        setHasCatering(!!res.data.hasCatering);
        if (list.length === 1) {
          /* still show wizard for fulfillment + order type */
        }
      } catch (e: any) {
        if (!cancelled) setError(e.response?.data?.error || t('shopFailedLoad'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shopKey, t]);

  if (loading) {
    return (
      <ShopThemeShell site={site}>
        <div className="flex min-h-screen items-center justify-center text-stone-600">{t('loading')}</div>
      </ShopThemeShell>
    );
  }

  if (error || !shopKey) {
    return (
      <ShopThemeShell site={site}>
        <div className="flex min-h-screen items-center justify-center px-4 text-center text-red-700">
          {error || t('shopNotFound')}
        </div>
      </ShopThemeShell>
    );
  }

  return (
    <ShopThemeShell site={site}>
      <div className="min-h-screen bg-stone-50">
        <ShopLocationHubWizard
          shopKey={shopKey}
          locations={locations}
          merchantHasCatering={hasCatering}
          onComplete={(loc) => {
            navigate(`${shopBasePath(shopKey, loc.slug)}/menu`, { replace: true });
          }}
        />
      </div>
    </ShopThemeShell>
  );
}
