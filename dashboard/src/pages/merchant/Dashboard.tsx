import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Overview from './Overview';
import Orders from './Orders';
import Products from './Products';
import Categories from './Categories';
import Modifiers from './Modifiers';
import Customers from './Customers';
import Loyalty from './Loyalty';
import Offers from './Offers';
import Terminals from './Terminals';
import Settings from './Settings';
import Billing from './Billing';
import Staff from './Staff';
import OnlineShop from './OnlineShop';
import FloorPlan from './FloorPlan';
import Reservations from './Reservations';
import Newsletter from './Newsletter';
import WebPos from './WebPos';
import Reports from './Reports';
import api from '@/lib/api';
import { I18nProvider, useI18n, type Locale } from '@/lib/i18n';
import { APP_PANEL_TITLE } from '@/lib/brand';
import { useAuthStore } from '@/store/auth';
import {
  canAccessRoute,
  canShowWebPosQuickAction,
  getEffectivePanelAccess,
  loadWebPosStaffSession,
  type Permission,
  type WebPosStaffSession,
} from '@/lib/permissions';
import type { EditionFeatureKey } from '@/lib/edition-features';

const WebsiteCms = lazy(() => import('./WebsiteCms'));

function PanelRouteGuard({
  path,
  allow,
  children,
}: {
  path: string;
  allow: (path: string) => boolean;
  children: React.ReactNode;
}) {
  if (!allow(path)) {
    return <Navigate to="/merchant/pos" replace />;
  }
  return <>{children}</>;
}

function MerchantShell() {
  const { t, locale, setLocale } = useI18n();
  const user = useAuthStore((s) => s.user);
  const jwtIsOwner = user?.role === 'merchant' && user?.isOwner !== false;
  const location = useLocation();
  const navigate = useNavigate();
  const isPosRoute = /^\/merchant\/pos\/?$/.test(location.pathname);
  const isPosEmbed =
    typeof window !== 'undefined' &&
    (new URLSearchParams(location.search).get('embed') === '1' ||
      sessionStorage.getItem('manupos_pos_embed') === '1');
  const [sidebarOpen, setSidebarOpen] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );
  /** When true on /merchant/pos, hide sidebar + header so WebPOS feels like its own app. */
  const [posAppMode, setPosAppMode] = useState(true);
  const [editionFeatures, setEditionFeatures] = useState<EditionFeatureKey[] | null>(null);
  const [pinSession, setPinSession] = useState<WebPosStaffSession | null>(() =>
    loadWebPosStaffSession()
  );
  const hideChrome = (isPosRoute && posAppMode) || isPosEmbed;

  // Keep PIN session in sync when WebPOS switches users
  useEffect(() => {
    const syncPin = () => setPinSession(loadWebPosStaffSession());
    syncPin();
    window.addEventListener('storage', syncPin);
    window.addEventListener('webpos:staff-session', syncPin);
    return () => {
      window.removeEventListener('storage', syncPin);
      window.removeEventListener('webpos:staff-session', syncPin);
    };
  }, [location.pathname, posAppMode]);

  const effective = useMemo(
    () =>
      getEffectivePanelAccess({
        jwtPermissions: user?.permissions as Permission[] | undefined,
        isOwner: jwtIsOwner,
        // Active PIN session means floor staff perms override owner JWT for panel access.
        staffConfigured: !!pinSession || user?.role === 'staff',
        pinSession,
      }),
    [user?.permissions, user?.role, jwtIsOwner, pinSession]
  );

  useEffect(() => {
    api
      .get('/merchant/settings')
      .then((r) => {
        const feats = r.data?.settings?.editionFeatures;
        setEditionFeatures(Array.isArray(feats) ? feats : null);
      })
      .catch(() => setEditionFeatures(null));
  }, []);

  useEffect(() => {
    if (isPosRoute) setPosAppMode(true);
  }, [isPosRoute]);

  useEffect(() => {
    document.title = APP_PANEL_TITLE;
  }, []);

  const refreshSession = useAuthStore((s) => s.refreshSession);
  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    const showPanel = () => {
      const access = getEffectivePanelAccess({
        jwtPermissions: user?.permissions as Permission[] | undefined,
        isOwner: jwtIsOwner,
        staffConfigured: !!loadWebPosStaffSession() || user?.role === 'staff',
        pinSession: loadWebPosStaffSession(),
      });
      if (!access.canOpenPanel) {
        toast.error(t('webPosPanelDenied'));
        setPosAppMode(true);
        return;
      }
      setPosAppMode(false);
    };
    const enterApp = () => setPosAppMode(true);
    window.addEventListener('webpos:show-panel', showPanel);
    window.addEventListener('webpos:enter-app', enterApp);
    return () => {
      window.removeEventListener('webpos:show-panel', showPanel);
      window.removeEventListener('webpos:enter-app', enterApp);
    };
  }, [user?.permissions, user?.role, jwtIsOwner, t]);

  // If a restricted PIN session is active, never leave POS chrome / panel routes.
  useEffect(() => {
    if (!effective.pinActive || effective.canOpenPanel) return;
    if (!posAppMode) setPosAppMode(true);
    if (!isPosRoute) {
      navigate('/merchant/pos', { replace: true });
    }
  }, [effective.pinActive, effective.canOpenPanel, posAppMode, isPosRoute, navigate]);

  const changeLanguage = useCallback(
    async (lang: Locale) => {
      setLocale(lang);
      try {
        await api.put('/merchant/settings', { panelLanguage: lang });
      } catch (error: any) {
        toast.error(error.response?.data?.error || 'Failed to save language');
      }
    },
    [setLocale]
  );

  const allow = useCallback(
    (path: string) =>
      canAccessRoute(path, effective.permissions, effective.isOwner, editionFeatures),
    [effective.permissions, effective.isOwner, editionFeatures]
  );

  const showWebPosQuickAction = useMemo(
    () => canShowWebPosQuickAction(jwtIsOwner, user?.permissions as Permission[] | undefined),
    [jwtIsOwner, user?.permissions]
  );

  const menuItems = [
    { label: t('overview'), path: '/merchant', icon: '📊' },
    {
      id: 'sales',
      label: t('navSales'),
      icon: '📦',
      children: [
        { label: t('orders'), path: '/merchant/orders', icon: '📦' },
        { label: t('webPos'), path: '/merchant/pos', icon: '🖥️' },
        { label: t('reports'), path: '/merchant/reports', icon: '📈' },
      ].filter((item) => allow(item.path)),
    },
    {
      id: 'catalog',
      label: t('navCatalog'),
      icon: '🛍️',
      children: [
        { label: t('products'), path: '/merchant/products', icon: '🛍️' },
        { label: t('categories'), path: '/merchant/categories', icon: '🏷️' },
        { label: t('modifiers'), path: '/merchant/modifiers', icon: '🧩' },
      ].filter((item) => allow(item.path)),
    },
    {
      id: 'customers',
      label: t('navCustomers'),
      icon: '👥',
      children: [
        { label: t('customers'), path: '/merchant/customers', icon: '👥' },
        { label: t('loyalty'), path: '/merchant/loyalty', icon: '🎁' },
        { label: t('offers'), path: '/merchant/offers', icon: '🏷️' },
        { label: t('newsletter'), path: '/merchant/newsletter', icon: '✉️' },
      ].filter((item) => allow(item.path)),
    },
    {
      id: 'online',
      label: t('navOnline'),
      icon: '🌐',
      children: [
        { label: t('shop'), path: '/merchant/online-shop', icon: '🌐' },
        { label: t('cmsWebsite'), path: '/merchant/website', icon: '✏️' },
        { label: t('reservations'), path: '/merchant/reservations', icon: '📅' },
      ].filter((item) => allow(item.path)),
    },
    ...(allow('/merchant/floor-plan')
      ? [{ label: t('floorPlan'), path: '/merchant/floor-plan', icon: '🪑' }]
      : []),
    ...(allow('/merchant/users')
      ? [{ label: t('staffPageTitle'), path: '/merchant/users', icon: '👤' }]
      : []),
    {
      id: 'account',
      label: t('navAccount'),
      icon: '⚙️',
      children: [
        { label: t('billing'), path: '/merchant/billing', icon: '💼' },
        { label: t('settings'), path: '/merchant/settings', icon: '⚙️' },
      ].filter((item) => allow(item.path)),
    },
  ]
    .filter((entry) => {
      if ('children' in entry && Array.isArray(entry.children)) {
        return entry.children.length > 0;
      }
      if (entry.path) return allow(entry.path);
      return false;
    });

  return (
    <div className={`flex h-full max-h-full panel-shell${hideChrome ? ' webpos-app-mode' : ''}`}>
      {!hideChrome && (
        <Sidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          menuItems={menuItems}
          panelKey="merchant"
          quickAction={
            showWebPosQuickAction
              ? { label: t('webPos'), path: '/merchant/pos' }
              : null
          }
        />
      )}

      <div className="flex-1 flex flex-col overflow-hidden min-w-0 min-h-0">
        {!hideChrome && (
          <Header
            title={t('merchantDashboard')}
            onMenuClick={() => setSidebarOpen(!sidebarOpen)}
            language={locale}
            onLanguageChange={changeLanguage}
            showAcceptingMenu
          />
        )}

        <main
          className={
            isPosRoute && posAppMode
              ? 'flex-1 overflow-hidden p-0 min-h-0'
              : 'panel-main flex-1 p-3 sm:p-4'
          }
        >
          <Routes>
            <Route
              index
              element={
                <PanelRouteGuard path="/merchant" allow={allow}>
                  <Overview />
                </PanelRouteGuard>
              }
            />
            <Route
              path="orders"
              element={
                <PanelRouteGuard path="/merchant/orders" allow={allow}>
                  <Orders />
                </PanelRouteGuard>
              }
            />
            <Route path="pos" element={<WebPos appMode={hideChrome} />} />
            <Route
              path="reports"
              element={
                <PanelRouteGuard path="/merchant/reports" allow={allow}>
                  <Reports />
                </PanelRouteGuard>
              }
            />
            <Route
              path="products"
              element={
                <PanelRouteGuard path="/merchant/products" allow={allow}>
                  <Products />
                </PanelRouteGuard>
              }
            />
            <Route
              path="modifiers"
              element={
                <PanelRouteGuard path="/merchant/modifiers" allow={allow}>
                  <Modifiers />
                </PanelRouteGuard>
              }
            />
            <Route
              path="categories"
              element={
                <PanelRouteGuard path="/merchant/categories" allow={allow}>
                  <Categories />
                </PanelRouteGuard>
              }
            />
            <Route
              path="customers"
              element={
                <PanelRouteGuard path="/merchant/customers" allow={allow}>
                  <Customers />
                </PanelRouteGuard>
              }
            />
            <Route
              path="loyalty"
              element={
                <PanelRouteGuard path="/merchant/loyalty" allow={allow}>
                  <Loyalty />
                </PanelRouteGuard>
              }
            />
            <Route
              path="offers"
              element={
                <PanelRouteGuard path="/merchant/offers" allow={allow}>
                  <Offers />
                </PanelRouteGuard>
              }
            />
            <Route
              path="newsletter"
              element={
                <PanelRouteGuard path="/merchant/newsletter" allow={allow}>
                  <Newsletter />
                </PanelRouteGuard>
              }
            />
            <Route
              path="online-shop"
              element={
                <PanelRouteGuard path="/merchant/online-shop" allow={allow}>
                  <OnlineShop />
                </PanelRouteGuard>
              }
            />
            <Route
              path="website"
              element={
                <PanelRouteGuard path="/merchant/website" allow={allow}>
                  <Suspense fallback={<div className="p-4 text-sm muted">{t('loading')}</div>}>
                    <WebsiteCms />
                  </Suspense>
                </PanelRouteGuard>
              }
            />
            <Route path="terminals" element={<Terminals />} />
            <Route
              path="floor-plan"
              element={
                <PanelRouteGuard path="/merchant/floor-plan" allow={allow}>
                  <FloorPlan />
                </PanelRouteGuard>
              }
            />
            <Route
              path="reservations"
              element={
                <PanelRouteGuard path="/merchant/reservations" allow={allow}>
                  <Reservations />
                </PanelRouteGuard>
              }
            />
            <Route
              path="billing"
              element={
                <PanelRouteGuard path="/merchant/billing" allow={allow}>
                  <Billing />
                </PanelRouteGuard>
              }
            />
            <Route
              path="users"
              element={
                <PanelRouteGuard path="/merchant/users" allow={allow}>
                  <Staff />
                </PanelRouteGuard>
              }
            />
            <Route
              path="settings"
              element={
                <PanelRouteGuard path="/merchant/settings" allow={allow}>
                  <Settings />
                </PanelRouteGuard>
              }
            />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function MerchantDashboard() {
  return (
    <I18nProvider>
      <MerchantShell />
    </I18nProvider>
  );
}
