import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Overview from './Overview';
import Orders from './Orders';
import Products from './Products';
import Inventory from './Inventory';
import InventoryLayout from './inventory/InventoryLayout';
import {
  InventoryListPage,
  InboundStockPage,
  OutboundStockPage,
  StockCountingPage,
  StockHistoryPage,
} from './inventory/ops-pages';
import {
  StockItemsPage,
  StockCategoriesPage,
  CookbookPage,
  SuppliersPage,
  UnitsPage,
} from './inventory/settings-pages';
import { InventoryReportPage, ConsumptionReportPage } from './inventory/report-pages';
import { InventoryHomePage } from './inventory/home-page';
import Categories from './Categories';
import Modifiers from './Modifiers';
import Customers from './Customers';
import Members from './Members';
import Loyalty from './Loyalty';
import Offers from './Offers';
import Vouchers from './Vouchers';
import Terminals from './Terminals';
import Settings from './Settings';
import PlatformShop from './PlatformShop';
import Support from './Support';
import Billing from './Billing';
import Staff from './Staff';
import OnlineShop from './OnlineShop';
import Reservations from './Reservations';
import Newsletter from './Newsletter';
import WebPos from './WebPos';
import WaiterApp from './WaiterApp';
import DeliveryTrackingPage from './DeliveryTracking';
import DeliveryDriverPage from './DeliveryDriver';
import MerchantOrderAlerts from '@/components/merchant/MerchantOrderAlerts';
import Reports from './Reports';
import api from '@/lib/api';
import { I18nProvider, useI18n, type Locale } from '@/lib/i18n';
import { APP_PANEL_TITLE } from '@/lib/brand';
import PlatformMessagesProvider, {
  PlatformStatusBannerSlot,
} from '@/components/platform/PlatformMessagesProvider';
import { useAuthStore } from '@/store/auth';
import { homePathForUser } from '@/lib/auth-home';
import {
  canAccessRoute,
  canShowWebPosQuickAction,
  backOfficeHomePath,
  deliveryDriverHomePath,
  getEffectivePanelAccess,
  getEffectiveRegisterDisplay,
  isCatalogPanelPath,
  isDeliveryDriverOnlyStaff,
  isOrdersPanelPath,
  isStaffJwt,
  loadWebPosStaffSession,
  notifyWebPosStaffSessionChanged,
  resolveWebPosStaffSession,
  WEBPOS_STAFF_SESSION_EVENT,
  type Permission,
  type StaffRosterRow,
  type WebPosStaffSession,
} from '@/lib/permissions';
import type { EditionFeatureKey } from '@/lib/edition-features';
import { isInventoryLicensed } from '@/lib/inventory-addon';
import { isSignageLicensed } from '@/lib/signage-addon';
import SignagePage from './SignagePage';

const WebsiteCms = lazy(() => import('./WebsiteCms'));

function LegacyReservationsRedirect() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  if (params.get('tab') === 'settings') {
    return <Navigate to="/merchant/settings?tab=reservations" replace />;
  }
  return <Navigate to="/merchant/sales/reservations" replace />;
}

function LegacyTablesRedirect({ section }: { section?: 'settings' | 'layout' | 'qr' }) {
  const dest = section
    ? `/merchant/settings?tab=tables&section=${section}`
    : '/merchant/settings?tab=tables';
  return <Navigate to={dest} replace />;
}

function PanelRouteGuard({
  path,
  allow,
  children,
}: {
  path: string;
  allow: (path: string) => boolean;
  children: React.ReactNode;
}) {
  const user = useAuthStore((s) => s.user);
  if (!allow(path)) {
    const dest = user ? homePathForUser(user) : '/merchant/pos';
    const fallback = dest === path || dest === '/merchant' ? '/merchant/pos' : dest;
    return <Navigate to={fallback} replace />;
  }
  return <>{children}</>;
}

function MerchantShell() {
  const { t, locale, setLocale } = useI18n();
  const user = useAuthStore((s) => s.user);
  const jwtIsOwner = user?.role === 'merchant' && user?.isOwner !== false;
  const staffJwt = isStaffJwt(user);
  const location = useLocation();
  const navigate = useNavigate();
  const isPosRoute = /^\/merchant\/pos\/?$/.test(location.pathname);
  const isWaiterRoute = /^\/merchant\/waiter\/?$/.test(location.pathname);
  const isDriverRoute = /^\/merchant\/delivery\/driver\/?$/.test(location.pathname);
  const isPosLikeRoute = isPosRoute || isWaiterRoute || isDriverRoute;
  const isPosEmbed =
    typeof window !== 'undefined' &&
    (new URLSearchParams(location.search).get('embed') === '1' ||
      sessionStorage.getItem('manupos_pos_embed') === '1');
  const [sidebarOpen, setSidebarOpen] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );
  /** When true on /merchant/pos, hide sidebar + header so WebPOS feels like its own app. */
  const [posAppMode, setPosAppMode] = useState(true);
  const [merchantShopName, setMerchantShopName] = useState<string | null>(null);
  const [editionFeatures, setEditionFeatures] = useState<EditionFeatureKey[] | null>(null);
  const [inventoryLicensed, setInventoryLicensed] = useState(() => isInventoryLicensed(user));
  const [signageLicensed, setSignageLicensed] = useState(() => isSignageLicensed(user));
  const [pinSession, setPinSession] = useState<WebPosStaffSession | null>(() =>
    loadWebPosStaffSession()
  );
  const [hasStaffPins, setHasStaffPins] = useState(false);
  const hideChrome = (isPosLikeRoute && posAppMode) || isPosEmbed;

  // Reconcile PIN session with JWT + staff roster on load (drop stale localStorage persist).
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      try {
        const staffRes = await api.get('/merchant/staff');
        if (cancelled) return;
        const staffList = (staffRes.data.staff || []) as StaffRosterRow[];
        const pins = staffList.some(
          (s) => !!(s as { pinSet?: boolean }).pinSet && s.isActive !== false
        );
        setHasStaffPins(pins);
        const session = resolveWebPosStaffSession({
          staffList,
          authStaffId: user.staffId,
          authRole: user.role,
          authPermissions: user.permissions as Permission[] | undefined,
        });
        setPinSession(session);
        notifyWebPosStaffSessionChanged();
      } catch {
        /* roster fetch is best-effort for panel gating */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.role, user?.staffId, user?.permissions]);

  // Keep PIN session in sync when WebPOS switches users
  useEffect(() => {
    const syncPin = () => setPinSession(loadWebPosStaffSession());
    syncPin();
    window.addEventListener('storage', syncPin);
    window.addEventListener(WEBPOS_STAFF_SESSION_EVENT, syncPin);
    return () => {
      window.removeEventListener('storage', syncPin);
      window.removeEventListener(WEBPOS_STAFF_SESSION_EVENT, syncPin);
    };
  }, [location.pathname, posAppMode]);

  const effective = useMemo(
    () =>
      getEffectivePanelAccess({
        jwtPermissions: user?.permissions as Permission[] | undefined,
        isOwner: jwtIsOwner,
        authRole: user?.role,
        hasStaffPins,
        pinSession,
      }),
    [user?.permissions, user?.role, jwtIsOwner, hasStaffPins, pinSession]
  );

  const registerDisplay = useMemo(
    () =>
      getEffectiveRegisterDisplay({
        jwtUser: user,
        pinSession,
        pinActive: effective.pinActive,
        t,
      }),
    [user, pinSession, effective.pinActive, t]
  );

  useEffect(() => {
    let cancelled = false;
    const applySettings = (settings: {
      name?: string | null;
      editionFeatures?: EditionFeatureKey[] | null;
      inventoryAddonEnabled?: boolean;
      inventoryEnabled?: boolean;
      signageAddonEnabled?: boolean;
      signageEnabled?: boolean;
    } | null) => {
      const feats = settings?.editionFeatures;
      setEditionFeatures(Array.isArray(feats) ? feats : null);
      setInventoryLicensed(isInventoryLicensed(settings) || isInventoryLicensed(user));
      setSignageLicensed(isSignageLicensed(settings) || isSignageLicensed(user));
      setMerchantShopName(settings?.name?.trim() || null);
    };
    const load = () => {
      api
        .get('/merchant/settings')
        .then((r) => {
          if (cancelled) return;
          applySettings(r.data?.settings ?? null);
        })
        .catch(() => {
          if (cancelled) return;
          setEditionFeatures(null);
          setInventoryLicensed(isInventoryLicensed(user));
          setSignageLicensed(isSignageLicensed(user));
        });
    };
    load();
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
    };
  }, [user]);

  useEffect(() => {
    if (isPosLikeRoute) setPosAppMode(true);
  }, [isPosLikeRoute]);

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
        authRole: user?.role,
        hasStaffPins,
        pinSession: loadWebPosStaffSession(),
      });
      if (!access.canOpenBackOffice) {
        toast.error(t('webPosPanelDenied'));
        setPosAppMode(true);
        return;
      }
      if (!access.canOpenPanel) {
        setPosAppMode(false);
        navigate(backOfficeHomePath(access.permissions, false));
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
  }, [user?.permissions, user?.role, jwtIsOwner, hasStaffPins, t, navigate]);

  // Restricted PIN: stay in POS unless they may open menu / orders pages.
  useEffect(() => {
    if (!effective.pinActive || effective.canOpenPanel) return;
    if (effective.canOpenCatalog && isCatalogPanelPath(location.pathname)) return;
    if (effective.canOpenOrders && isOrdersPanelPath(location.pathname)) return;
    if (!posAppMode) setPosAppMode(true);
    if (!isPosLikeRoute) {
      navigate('/merchant/pos', { replace: true });
    }
  }, [
    effective.pinActive,
    effective.canOpenPanel,
    effective.canOpenCatalog,
    effective.canOpenOrders,
    posAppMode,
    isPosLikeRoute,
    location.pathname,
    navigate,
  ]);

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

  /** Inventory is a paid merchant addon — never gate it on edition feature lists. */
  const allowInventory = useCallback(
    (path: string) =>
      inventoryLicensed &&
      canAccessRoute(path, effective.permissions, effective.isOwner, null),
    [inventoryLicensed, effective.permissions, effective.isOwner]
  );

  const allowSignage = useCallback(
    (path: string) =>
      signageLicensed &&
      canAccessRoute(path, effective.permissions, effective.isOwner, null),
    [signageLicensed, effective.permissions, effective.isOwner]
  );

  // Block direct URL access to panel pages the role may not open.
  useEffect(() => {
    if (effective.isOwner || isPosLikeRoute) return;
    const path = location.pathname.replace(/\/$/, '') || '/merchant';
    if (allow(path)) return;
    const dest = backOfficeHomePath(effective.permissions, false);
    if (dest !== path) navigate(dest, { replace: true });
  }, [effective.isOwner, effective.permissions, isPosLikeRoute, location.pathname, allow, navigate]);

  // Delivery-only staff must use the driver app, not register POS.
  useEffect(() => {
    if (effective.isOwner) return;
    if (!isDeliveryDriverOnlyStaff(effective.permissions, false)) return;
    const path = location.pathname.replace(/\/$/, '') || '/merchant';
    if (path === deliveryDriverHomePath()) return;
    if (path === '/merchant/pos' || path === '/merchant/waiter' || path.startsWith('/merchant/pos/')) {
      navigate(deliveryDriverHomePath(), { replace: true });
    }
  }, [effective.isOwner, effective.permissions, location.pathname, navigate]);

  const showWebPosQuickAction = useMemo(
    () => canShowWebPosQuickAction(jwtIsOwner, user?.permissions as Permission[] | undefined),
    [jwtIsOwner, user?.permissions]
  );

  const orderAlertsEnabled = !isPosLikeRoute && allow('/merchant/orders');

  const menuItems = [
    { label: t('overview'), path: '/merchant', icon: '📊' },
    { label: t('orders'), path: '/merchant/orders', icon: '📦' },
    ...(allow('/merchant/delivery')
      ? [{ label: t('deliveryMapNav'), path: '/merchant/delivery', icon: '🛵' }]
      : []),
    ...(allow('/merchant/delivery/driver')
      ? [{ label: t('deliveryDriverTitle'), path: '/merchant/delivery/driver', icon: '📍' }]
      : []),
    {
      id: 'sales',
      label: t('navSales'),
      icon: '📈',
      children: [
        { label: t('invoicesNav'), path: '/merchant/invoices', icon: '🧾' },
        { label: t('reports'), path: '/merchant/reports', icon: '📈' },
        { label: t('reservations'), path: '/merchant/sales/reservations', icon: '📅' },
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
      id: 'inventory',
      label: t('invTitle'),
      icon: '📦',
      children: allowInventory('/merchant/inventory')
        ? [
            { heading: true, label: t('invNavGroupOps') },
            { label: t('invNavList'), path: '/merchant/inventory', icon: '📋' },
            { label: t('invNavStockTable'), path: '/merchant/inventory/list', icon: '📊' },
            { label: t('invNavInbound'), path: '/merchant/inventory/inbound', icon: '⬇️' },
            { label: t('invNavOutbound'), path: '/merchant/inventory/outbound', icon: '⬆️' },
            { label: t('invNavCounting'), path: '/merchant/inventory/counting', icon: '🧮' },
            { label: t('invNavHistory'), path: '/merchant/inventory/history', icon: '🕓' },
            { heading: true, label: t('invNavGroupSettings') },
            { label: t('invNavItems'), path: '/merchant/inventory/items', icon: '📦' },
            { label: t('invNavCategories'), path: '/merchant/inventory/categories', icon: '🗂️' },
            { label: t('invNavCookbook'), path: '/merchant/inventory/cookbook', icon: '📖' },
            { label: t('invNavSuppliers'), path: '/merchant/inventory/suppliers', icon: '🚚' },
            { label: t('invNavUnits'), path: '/merchant/inventory/units', icon: '⚖️' },
            { heading: true, label: t('invNavGroupReports') },
            { label: t('invNavReport'), path: '/merchant/inventory/report', icon: '📑' },
            { label: t('invNavConsumption'), path: '/merchant/inventory/consumption', icon: '🍽️' },
          ]
        : [],
    },
    {
      id: 'customers',
      label: t('navCustomers'),
      icon: '👥',
      children: [
        { label: t('customers'), path: '/merchant/customers', icon: '👥' },
        { label: t('membersNav'), path: '/merchant/members', icon: '💳' },
        { label: t('loyalty'), path: '/merchant/loyalty', icon: '🎁' },
        { label: t('offers'), path: '/merchant/offers', icon: '🏷️' },
        { label: t('vouchers'), path: '/merchant/vouchers', icon: '🎟️' },
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
      ].filter((item) => allow(item.path)),
    },
    ...(allowSignage('/merchant/signage')
      ? [{ label: t('signageNav'), path: '/merchant/signage', icon: '📺' }]
      : []),
    ...(allow('/merchant/users')
      ? [{ label: t('staffPageTitle'), path: '/merchant/users', icon: '👤' }]
      : []),
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
          registerDisplay={registerDisplay}
          quickAction={
            showWebPosQuickAction
              ? { label: t('sidebarPos'), path: '/merchant/pos' }
              : null
          }
          language={locale}
          onLanguageChange={changeLanguage}
          profileMenu={{
            settingsPath: '/merchant/settings',
            billingPath: '/merchant/billing',
            supportPath: '/merchant/support',
          }}
          shopName={merchantShopName}
          shopPath={allow('/merchant/platform-shop') ? '/merchant/platform-shop' : null}
        />
      )}

      <div className="flex-1 flex flex-col overflow-hidden min-w-0 min-h-0">
        {!hideChrome && (
          <Header
            title={t('merchantDashboard')}
            onMenuClick={() => setSidebarOpen(!sidebarOpen)}
            compact
            registerDisplay={registerDisplay}
          />
        )}

        {!hideChrome ? <PlatformStatusBannerSlot /> : null}

        <main
          className={
            isPosLikeRoute && posAppMode
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
            <Route
              path="delivery"
              element={
                <PanelRouteGuard path="/merchant/delivery" allow={allow}>
                  <DeliveryTrackingPage />
                </PanelRouteGuard>
              }
            />
            <Route
              path="delivery/driver"
              element={
                <PanelRouteGuard path="/merchant/delivery/driver" allow={allow}>
                  <DeliveryDriverPage />
                </PanelRouteGuard>
              }
            />
            <Route
              path="invoices"
              element={
                <PanelRouteGuard path="/merchant/invoices" allow={allow}>
                  <Orders invoiceLedger />
                </PanelRouteGuard>
              }
            />
            <Route path="pos" element={<WebPos appMode={hideChrome} />} />
            <Route path="waiter" element={<WaiterApp appMode={hideChrome} />} />
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
              path="inventory"
              element={
                <PanelRouteGuard path="/merchant/inventory" allow={allowInventory}>
                  <InventoryLayout />
                </PanelRouteGuard>
              }
            >
              <Route index element={<InventoryHomePage />} />
              <Route path="home" element={<InventoryHomePage />} />
              <Route path="list" element={<InventoryListPage />} />
              <Route path="inbound" element={<InboundStockPage />} />
              <Route path="outbound" element={<OutboundStockPage />} />
              <Route path="counting" element={<StockCountingPage />} />
              <Route path="history" element={<StockHistoryPage />} />
              <Route path="items" element={<StockItemsPage />} />
              <Route path="categories" element={<StockCategoriesPage />} />
              <Route path="cookbook" element={<CookbookPage />} />
              <Route path="suppliers" element={<SuppliersPage />} />
              <Route path="units" element={<UnitsPage />} />
              <Route path="report" element={<InventoryReportPage />} />
              <Route path="consumption" element={<ConsumptionReportPage />} />
            </Route>
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
              path="members"
              element={
                <PanelRouteGuard path="/merchant/members" allow={allow}>
                  <Members />
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
              path="vouchers"
              element={
                <PanelRouteGuard path="/merchant/vouchers" allow={allow}>
                  <Vouchers />
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
            <Route
              path="signage"
              element={
                <PanelRouteGuard path="/merchant/signage" allow={allowSignage}>
                  <SignagePage />
                </PanelRouteGuard>
              }
            />
            <Route
              path="terminals"
              element={
                <PanelRouteGuard path="/merchant/terminals" allow={allow}>
                  <Terminals />
                </PanelRouteGuard>
              }
            />
            <Route
              path="floor-plan"
              element={<LegacyTablesRedirect section="layout" />}
            />
            <Route path="tables" element={<LegacyTablesRedirect />} />
            <Route path="tables/settings" element={<LegacyTablesRedirect section="settings" />} />
            <Route path="tables/layout" element={<LegacyTablesRedirect section="layout" />} />
            <Route path="tables/qr" element={<LegacyTablesRedirect section="qr" />} />
            <Route
              path="sales/reservations"
              element={
                <PanelRouteGuard path="/merchant/sales/reservations" allow={allow}>
                  <Reservations />
                </PanelRouteGuard>
              }
            />
            <Route
              path="reservations"
              element={
                <LegacyReservationsRedirect />
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
              path="platform-shop"
              element={
                <PanelRouteGuard path="/merchant/platform-shop" allow={allow}>
                  <PlatformShop />
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
              path="support"
              element={
                <PanelRouteGuard path="/merchant/support" allow={allow}>
                  <Support />
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
        <MerchantOrderAlerts enabled={orderAlertsEnabled} />
      </div>
    </div>
  );
}

export default function MerchantDashboard() {
  return (
    <I18nProvider>
      <PlatformMessagesProvider>
        <MerchantShell />
      </PlatformMessagesProvider>
    </I18nProvider>
  );
}
