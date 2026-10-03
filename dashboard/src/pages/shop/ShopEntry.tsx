import { useEffect, useMemo, useState } from 'react';
import { useParams, useLocation, Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { resolveShopKey, resolveShopLocationSlug, shopBasePath } from '@/lib/shop-cart';
import OrderingPage from './OrderingPage';
import ChaslayShopHomePage from './ChaslayShopHomePage';
import { useI18n } from '@/lib/i18n';
import ShopThemeShell from '@/components/shop/ShopThemeShell';
import ShopLocationHubWizard from '@/components/shop/ShopLocationHubWizard';
import { normalizeShopSiteSettings, type ShopSiteSettings } from '@/lib/shop-site-settings';
import {
  isShopLocationSessionReady,
  type ShopPublicLocation,
} from '@/lib/shop-location-session';

/**
 * Shop root: CMS homepage, location hub wizard (multi-store), or ordering menu.
 */
export default function ShopEntry() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { merchantSlug, locationSlug } = useParams<{ merchantSlug?: string; locationSlug?: string }>();
  const location = useLocation();
  const shopKey = useMemo(() => resolveShopKey(merchantSlug), [merchantSlug]);
  const locSlug = resolveShopLocationSlug({ locationSlug });
  const [mode, setMode] = useState<'loading' | 'chaslay' | 'menu'>('loading');
  const [site, setSite] = useState<ShopSiteSettings | null>(null);
  const [locations, setLocations] = useState<ShopPublicLocation[]>([]);
  const [hasCatering, setHasCatering] = useState(false);
  const [hubReady, setHubReady] = useState(false);

  const aboutRedirect = useMemo(() => {
    const path = location.pathname.replace(/\/+$/, '') || '/';
    if (path === '/about' || path.endsWith('/about')) {
      return `${location.pathname.split('/about')[0] || ''}/#opening-hours`.replace(/\/+#/, '/#') || '/#opening-hours';
    }
    return null;
  }, [location.pathname]);

  useEffect(() => {
    if (!shopKey) {
      setMode('menu');
      setHubReady(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [shopRes, locRes] = await Promise.all([
          axios.get(`/api/shop/${shopKey}`),
          axios.get(`/api/shop/${shopKey}/locations`).catch(() => ({ data: { locations: [] } })),
        ]);
        const data = shopRes.data.data;
        if (cancelled) return;
        setSite(normalizeShopSiteSettings(data?.site));
        const list = (locRes.data?.locations || []) as ShopPublicLocation[];
        setLocations(list);
        setHasCatering(!!locRes.data?.hasCatering);
        const sessionOk = isShopLocationSessionReady(shopKey, locSlug);
        setHubReady(sessionOk || list.length === 0);

        if (data?.cmsHomepageEnabled) {
          try {
            const homeRes = await axios.get(`/api/shop/${shopKey}/pages/home`);
            if (!cancelled && homeRes.data?.data?.engine === 'chaslay') {
              setMode('chaslay');
              return;
            }
          } catch {
            /* fall through */
          }
        }
        if (!cancelled) setMode('menu');
      } catch {
        if (!cancelled) {
          setMode('menu');
          setHubReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shopKey, locSlug]);

  if (aboutRedirect && aboutRedirect !== `${location.pathname}${location.hash || ''}`) {
    return <Navigate to={aboutRedirect} replace />;
  }

  const showHubWizard =
    mode === 'menu' &&
    shopKey &&
    locations.length > 0 &&
    !hubReady;

  if (mode === 'loading') {
    return (
      <ShopThemeShell site={site}>
        <div className="min-h-screen flex items-center justify-center bg-stone-50 text-stone-600">
          {t('loading')}
        </div>
      </ShopThemeShell>
    );
  }
  if (mode === 'chaslay') return <ChaslayShopHomePage />;

  return (
    <ShopThemeShell site={site}>
      {showHubWizard ? (
        <ShopLocationHubWizard
          shopKey={shopKey}
          locations={locations}
          fixedLocationSlug={locSlug}
          merchantHasCatering={hasCatering}
          onComplete={(loc) => {
            setHubReady(true);
            const target = `${shopBasePath(shopKey, loc.slug)}/menu`;
            if (location.pathname.includes('/menu')) {
              window.location.assign(target);
            } else {
              navigate(target, { replace: true });
            }
          }}
        />
      ) : null}
      {!showHubWizard ? <OrderingPage /> : null}
    </ShopThemeShell>
  );
}
