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
import { InventoryReportPage, ConsumptionReportPage, DeadStockReportPage } from './inventory/report-pages';
import InventoryTransfersPage from './inventory/InventoryTransfersPage';
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
import OnlineShop from './OnlineShop';
import Reservations from './Reservations';
import Newsletter from './Newsletter';
import WebPos from './WebPos';
import WebPosErrorBoundary from '@/components/WebPosErrorBoundary';
import WaiterApp from './WaiterApp';
import DeliveryDriverPage from './DeliveryDriver';
import StorekeeperApp from './StorekeeperApp';
import MerchantOrderAlerts from '@/components/merchant/MerchantOrderAlerts';
import { useTillPrintHub } from '@/hooks/useTillPrintHub';
import InventoryExpiryAlerts from '@/components/merchant/InventoryExpiryAlerts';
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
  jwtHasPanelAccess,
  getEffectiveRegisterDisplay,
  isCatalogPanelPath,
  isDeliveryDriverOnlyStaff,
  isStorekeeperOnlyStaff,
  isStorekeeperRestrictedStaff,
  isStorekeeperPanelPath,
  isKioskOnlyStaff,
  isKioskRestrictedStaff,
  isKioskPanelPath,
  kioskHomePath,
  isWaiterRestrictedStaff,
  isWaiterPanelPath,
  waiterRestrictedHomePath,
  isFloorWaiterStaff,
  storekeeperHomePath,
  isOrdersPanelPath,
  isReportsPanelPath,
  isStaffJwt,
  hasPermission,
  loadWebPosStaffSession,
  notifyWebPosStaffSessionChanged,
  resolveWebPosStaffSession,
  WEBPOS_STAFF_SESSION_EVENT,
  type Permission,
  type StaffRosterRow,
  type WebPosStaffSession,
} from '@/lib/permissions';
import type { EditionFeatureKey } from '@/lib/edition-features';
import type { BusinessModule } from '@/lib/business-module';
import { isRestaurantModule, normalizeBusinessModule } from '@/lib/business-module';
import { normalizeStaffLoginHome } from '@/lib/staff-login-home';
import { isInventoryLicensed } from '@/lib/inventory-addon';
import { isSignageLicensed } from '@/lib/signage-addon';
import { isStorekeeperLicensed } from '@/lib/storekeeper-addon';
import { isMultiLocationLicensed } from '@/lib/locations-addon';
import { isKioskLicensed } from '@/lib/kiosk-addon';
import SignagePage from './SignagePage';
import KioskSettingsPage from './KioskSettingsPage';
import HqDashboardPage from './HqDashboard';
import HqMenusPage from './HqMenusPage';
import BulkPricingPage from './BulkPricingPage';
import OrderCenterApp from './OrderCenterApp';
import { useLocationStore } from '@/store/location';

const WebsiteCms = lazy(() => import('./WebsiteCms'));
const ChaslayPageBuilderList = lazy(() => import('./ChaslayPageBuilderList'));
const ChaslayPageBuilderEditor = lazy(() => import('./ChaslayPageBuilderEditor'));

function LegacyReservationsRedirect() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  if (params.get('tab') === 'settings') {
    return <Navigate to="/merchant/settings?tab=reservations" replace />;
  }
  return <Navigate to="/merchant/sales/reservations" replace />;
}

function LegacyUsersRedirect() {
  return <Navigate to="/merchant/settings?tab=users" replace />;
}

function LegacyDeliveryMapRedirect() {
  return <Navigate to="/merchant/settings?tab=delivery-map" replace />;
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
  const isOrderCenterRoute = /^\/merchant\/order-(center|hub)\/?$/.test(location.pathname);
  const isDriverRoute = /^\/merchant\/delivery\/driver\/?$/.test(location.pathname);
  const isStorekeeperRoute = /^\/merchant\/storekeeper\/?$/.test(location.pathname);
  const isKioskRoute = /^\/merchant\/kiosk\/?$/.test(location.pathname);
  const isPosLikeRoute = isPosRoute || isWaiterRoute || isStorekeeperRoute || isKioskRoute;
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
  const [storekeeperLicensed, setStorekeeperLicensed] = useState(() => isStorekeeperLicensed(user));
  const [signageLicensed, setSignageLicensed] = useState(() => isSignageLicensed(user));
  const [kioskLicensed, setKioskLicensed] = useState(false);
  const [hqLicensed, setHqLicensed] = useState(() =>
    isMultiLocationLicensed({ maxLocations: user?.maxLocations })
  );
  const [businessModule, setBusinessModule] = useState<BusinessModule | null>(null);
  const [pinSession, setPinSession] = useState<WebPosStaffSession | null>(() =>
    loadWebPosStaffSession()
  );
  const [hasStaffPins, setHasStaffPins] = useState(false);
  const managerPanelAccess = useMemo(
    () => jwtHasPanelAccess(user?.permissions as Permission[] | undefined, jwtIsOwner, user?.role),
    [user?.permissions, user?.role, jwtIsOwner]
  );

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
        pathname: location.pathname,
      }),
    [user?.permissions, user?.role, jwtIsOwner, hasStaffPins, pinSession, location.pathname]
  );

  const storekeeperRestricted = useMemo(
    () => !jwtIsOwner && isStorekeeperRestrictedStaff(effective.permissions, false),
    [jwtIsOwner, effective.permissions]
  );
  const kioskRestricted = useMemo(
    () => !jwtIsOwner && isKioskRestrictedStaff(effective.permissions, false),
    [jwtIsOwner, effective.permissions]
  );
  const waiterRestricted = useMemo(
    () => !jwtIsOwner && isWaiterRestrictedStaff(effective.permissions, false),
    [jwtIsOwner, effective.permissions]
  );
  const hideChrome =
    (((isPosRoute || isWaiterRoute || isOrderCenterRoute) && posAppMode) ||
      (isStorekeeperRoute && posAppMode && (!managerPanelAccess || storekeeperRestricted)) ||
      (isKioskRoute && (!managerPanelAccess || kioskRestricted))) ||
    isPosEmbed;

  /** PIN-restricted staff home route — delivery drivers use driver app, not register POS. */
  const isAllowedPinAppRoute = useMemo(() => {
    if (isDeliveryDriverOnlyStaff(effective.permissions, false)) return isDriverRoute;
    if (isStorekeeperOnlyStaff(effective.permissions, false)) return isStorekeeperRoute;
    if (isKioskOnlyStaff(effective.permissions, false)) return isKioskRoute;
    return isPosLikeRoute;
  }, [effective.permissions, isDriverRoute, isStorekeeperRoute, isKioskRoute, isPosLikeRoute]);

  const pinRestrictedHomePath = useMemo(() => {
    if (isDeliveryDriverOnlyStaff(effective.permissions, false)) return deliveryDriverHomePath();
    if (isStorekeeperOnlyStaff(effective.permissions, false)) return storekeeperHomePath();
    if (isKioskOnlyStaff(effective.permissions, false)) return kioskHomePath();
    if (hasPermission(effective.permissions, 'MANAGE_TABLES', false)) return '/merchant/waiter';
    return '/merchant/pos';
  }, [effective.permissions]);

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
      businessCategory?: string | null;
      inventoryAddonEnabled?: boolean;
      inventoryEnabled?: boolean;
      storekeeperAddonEnabled?: boolean;
      signageAddonEnabled?: boolean;
      signageEnabled?: boolean;
      kioskAddonEnabled?: boolean;
      kioskEnabled?: boolean;
      maxLocations?: number | null;
    } | null) => {
      const feats = settings?.editionFeatures;
      setEditionFeatures(Array.isArray(feats) ? feats : null);
      setBusinessModule(normalizeBusinessModule(settings?.businessCategory));
      setInventoryLicensed(isInventoryLicensed(settings) || isInventoryLicensed(user));
      setStorekeeperLicensed(isStorekeeperLicensed(settings) || isStorekeeperLicensed(user));
      setSignageLicensed(isSignageLicensed(settings) || isSignageLicensed(user));
      setKioskLicensed(isKioskLicensed(settings) || isKioskLicensed(user));
      setHqLicensed(isMultiLocationLicensed(settings) || isMultiLocationLicensed(user));
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
          setStorekeeperLicensed(isStorekeeperLicensed(user));
          setSignageLicensed(isSignageLicensed(user));
          setKioskLicensed(isKioskLicensed(user));
          setHqLicensed(isMultiLocationLicensed(user));
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
        pathname: location.pathname,
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
      const path = location.pathname.replace(/\/$/, '') || '/merchant';
      if (path === '/merchant/pos' || path === '/merchant/waiter') {
        navigate('/merchant');
      }
    };
    const enterApp = () => setPosAppMode(true);
    window.addEventListener('webpos:show-panel', showPanel);
    window.addEventListener('webpos:enter-app', enterApp);
    return () => {
      window.removeEventListener('webpos:show-panel', showPanel);
      window.removeEventListener('webpos:enter-app', enterApp);
    };
  }, [user?.permissions, user?.role, jwtIsOwner, hasStaffPins, t, navigate, location.pathname]);

  // Restricted PIN: stay on role app (POS, driver, storekeeper) unless they may open panel pages.
  useEffect(() => {
    if (!effective.pinActive || effective.canOpenPanel) return;
    if (effective.canOpenCatalog && isCatalogPanelPath(location.pathname)) return;
    if (effective.canOpenOrders && isOrdersPanelPath(location.pathname)) return;
    if (effective.canOpenReports && isReportsPanelPath(location.pathname)) return;
    if (!posAppMode) setPosAppMode(true);
    const path = location.pathname.replace(/\/$/, '') || '/merchant';
    const home = pinRestrictedHomePath.replace(/\/$/, '');
    if (path !== home && !isAllowedPinAppRoute) {
      navigate(pinRestrictedHomePath, { replace: true });
    }
  }, [
    effective.pinActive,
    effective.canOpenPanel,
    effective.canOpenCatalog,
    effective.canOpenOrders,
    effective.canOpenReports,
    posAppMode,
    isAllowedPinAppRoute,
    pinRestrictedHomePath,
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
      canAccessRoute(path, effective.permissions, effective.isOwner, editionFeatures, businessModule),
    [effective.permissions, effective.isOwner, editionFeatures, businessModule]
  );

  /** Inventory is a paid merchant addon — never gate it on edition feature lists. */
  const allowInventory = useCallback(
    (path: string) =>
      inventoryLicensed &&
      canAccessRoute(path, effective.permissions, effective.isOwner, null, businessModule),
    [inventoryLicensed, effective.permissions, effective.isOwner, businessModule]
  );

  const allowStorekeeper = useCallback(
    (path: string) =>
      storekeeperLicensed &&
      canAccessRoute(path, effective.permissions, effective.isOwner, null),
    [storekeeperLicensed, effective.permissions, effective.isOwner]
  );

  const allowSignage = useCallback(
    (path: string) =>
      signageLicensed &&
      canAccessRoute(path, effective.permissions, effective.isOwner, null, businessModule),
    [signageLicensed, effective.permissions, effective.isOwner, businessModule]
  );

  const allowKiosk = useCallback(
    (path: string) =>
      kioskLicensed &&
      canAccessRoute(path, effective.permissions, effective.isOwner, null, businessModule),
    [kioskLicensed, effective.permissions, effective.isOwner, businessModule]
  );

  const { locations } = useLocationStore();
  const showHq = hqLicensed || locations.length > 1;
  const allowHq = useCallback(
    (path: string) =>
      showHq &&
      canAccessRoute(path, effective.permissions, effective.isOwner, null, businessModule),
    [showHq, effective.permissions, effective.isOwner, businessModule]
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

  // Storekeeper staff without full panel access — mobile intake (+ optional inventory) only.
  useEffect(() => {
    if (jwtIsOwner || user?.role !== 'staff') return;
    const perms = effective.permissions;
    if (!isStorekeeperRestrictedStaff(perms, false)) return;
    if (isStorekeeperPanelPath(location.pathname, perms)) return;
    navigate(storekeeperHomePath(), { replace: true });
  }, [jwtIsOwner, user?.role, effective.permissions, location.pathname, navigate]);

  // Storekeeper-only staff use the mobile intake app, not the full panel.
  useEffect(() => {
    if (jwtIsOwner) return;
    if (!isStorekeeperOnlyStaff(effective.permissions, false)) return;
    const path = location.pathname.replace(/\/$/, '') || '/merchant';
    if (path === storekeeperHomePath()) return;
    navigate(storekeeperHomePath(), { replace: true });
  }, [jwtIsOwner, effective.permissions, location.pathname, navigate]);

  // Kiosk addon not licensed — hide setup route.
  useEffect(() => {
    if (kioskLicensed) return;
    const path = location.pathname.replace(/\/$/, '') || '/merchant';
    if (!isKioskPanelPath(path)) return;
    navigate(backOfficeHomePath(effective.permissions, effective.isOwner), { replace: true });
  }, [kioskLicensed, location.pathname, effective.permissions, effective.isOwner, navigate]);

  // Kiosk operator staff — setup panel only, not full merchant back office.
  useEffect(() => {
    if (jwtIsOwner || user?.role !== 'staff') return;
    const perms = effective.permissions;
    if (!isKioskRestrictedStaff(perms, false)) return;
    if (isKioskPanelPath(location.pathname)) return;
    navigate(kioskHomePath(), { replace: true });
  }, [jwtIsOwner, user?.role, effective.permissions, location.pathname, navigate]);

  useEffect(() => {
    if (jwtIsOwner) return;
    if (!isKioskOnlyStaff(effective.permissions, false)) return;
    const path = location.pathname.replace(/\/$/, '') || '/merchant';
    if (path === kioskHomePath()) return;
    navigate(kioskHomePath(), { replace: true });
  }, [jwtIsOwner, effective.permissions, location.pathname, navigate]);

  // PIN-scoped staff without back-office access cannot browse the manager panel.
  useEffect(() => {
    if (!effective.pinActive || effective.canOpenBackOffice) return;
    const path = location.pathname.replace(/\/$/, '') || '/merchant';
    if (isStorekeeperOnlyStaff(effective.permissions, false)) {
      if (path !== storekeeperHomePath()) navigate(storekeeperHomePath(), { replace: true });
      return;
    }
    if (isKioskOnlyStaff(effective.permissions, false)) {
      if (path !== kioskHomePath()) navigate(kioskHomePath(), { replace: true });
      return;
    }
    if (isDeliveryDriverOnlyStaff(effective.permissions, false)) {
      if (path !== deliveryDriverHomePath()) navigate(deliveryDriverHomePath(), { replace: true });
      return;
    }
    if (!isPosLikeRoute && path !== '/merchant/pos') {
      navigate('/merchant/pos', { replace: true });
    }
  }, [
    effective.pinActive,
    effective.canOpenBackOffice,
    effective.permissions,
    isPosLikeRoute,
    location.pathname,
    navigate,
  ]);

  // Waiter staff without full panel access — waiter app and optional menu/orders only.
  useEffect(() => {
    if (jwtIsOwner || user?.role !== 'staff') return;
    const perms = effective.permissions;
    if (!isWaiterRestrictedStaff(perms, false)) return;
    if (isWaiterPanelPath(location.pathname, perms)) return;
    navigate(waiterRestrictedHomePath(perms), { replace: true });
  }, [jwtIsOwner, user?.role, effective.permissions, location.pathname, navigate]);

  // Floor waiters (and POS-destination staff) cannot browse the manager panel.
  useEffect(() => {
    if (jwtIsOwner || user?.role !== 'staff') return;
    const perms = user?.permissions as Permission[] | undefined;
    const floorOnly = isFloorWaiterStaff(perms, false);
    const posDest = normalizeStaffLoginHome(user?.loginHome) === 'pos';
    if (!floorOnly && !posDest) return;
    if (isPosLikeRoute) return;
    const path = location.pathname.replace(/\/$/, '') || '/merchant';
    const dest = hasPermission(perms, 'MANAGE_TABLES', false) ? '/merchant/waiter' : '/merchant/pos';
    if (path !== dest) navigate(dest, { replace: true });
  }, [jwtIsOwner, user?.role, user?.loginHome, user?.permissions, isPosLikeRoute, location.pathname, navigate]);

  const showWebPosQuickAction = useMemo(
    () => canShowWebPosQuickAction(jwtIsOwner, user?.permissions as Permission[] | undefined),
    [jwtIsOwner, user?.permissions]
  );

  const orderAlertsEnabled = !isPosLikeRoute && allow('/merchant/orders');
  useTillPrintHub({ enabled: !isPosLikeRoute });
  const loadLocations = useLocationStore((s) => s.load);

  useEffect(() => {
    void loadLocations();
  }, [loadLocations]);

  const fullMenuItems = [
    { label: t('overview'), path: '/merchant', icon: '📊' },
    {
      id: 'sales',
      label: t('navSales'),
      icon: '📈',
      children: [
        { label: t('orders'), path: '/merchant/orders', icon: '📦' },
        { label: t('orderCenterTitle'), path: '/merchant/order-center', icon: '📲' },
        { label: t('reservations'), path: '/merchant/sales/reservations', icon: '📅' },
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
      id: 'hq',
      label: t('navHq'),
      icon: '🏢',
      children: showHq
        ? [
            { label: t('hqDashboardTitle'), path: '/merchant/hq', icon: '🏢' },
            { label: t('hqMenusTitle'), path: '/merchant/hq/menus', icon: '🕐' },
            { label: t('bulkPricingTitle'), path: '/merchant/hq/bulk-pricing', icon: '📈' },
          ].filter((item) => allowHq(item.path))
        : [],
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
            ...(allowStorekeeper('/merchant/storekeeper')
              ? [{ label: t('storekeeperTitle'), path: '/merchant/storekeeper', icon: '📱' }]
              : []),
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
            { label: t('invNavDeadStock'), path: '/merchant/inventory/dead-stock', icon: '💀' },
            { label: t('invNavConsumption'), path: '/merchant/inventory/consumption', icon: '🍽️' },
          ]
            .filter((item) => {
              if ('heading' in item && item.heading) return true;
              const path = 'path' in item ? item.path : '';
              if (
                path === '/merchant/inventory/cookbook' ||
                path === '/merchant/inventory/consumption'
              ) {
                return isRestaurantModule(businessModule);
              }
              return true;
            })
        : [],
    },
    ...(allowStorekeeper('/merchant/storekeeper') && !allowInventory('/merchant/inventory')
      ? [{ label: t('storekeeperTitle'), path: '/merchant/storekeeper', icon: '📱' }]
      : []),
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
      id: 'cms',
      label: t('navCms'),
      icon: '🌐',
      children: [
        { label: t('shop'), path: '/merchant/online-shop', icon: '🛒' },
        { label: t('cmsWebsite'), path: '/merchant/website', icon: '✏️' },
        { label: 'Chaslay Page Builder (beta)', path: '/merchant/chaslay-page-builder', icon: '🧩' },
      ].filter((item) => allow(item.path)),
    },
    ...(allowSignage('/merchant/signage')
      ? [{ label: t('signageNav'), path: '/merchant/signage', icon: '📺' }]
      : []),
    ...(allowKiosk('/merchant/kiosk') ? [{ label: t('kioskNav'), path: '/merchant/kiosk', icon: '🖥️' }] : []),
  ]
    .filter((entry) => {
      if ('children' in entry && Array.isArray(entry.children)) {
        return entry.children.length > 0;
      }
      if (entry.path) return allow(entry.path);
      return false;
    });

  const waiterMenuItems = [
    ...(hasPermission(effective.permissions, 'MANAGE_TABLES', false)
      ? [{ label: t('waiterAppTitle'), path: '/merchant/waiter', icon: '🍽️' }]
      : []),
    ...(allow('/merchant/orders')
      ? [{ label: t('orders'), path: '/merchant/orders', icon: '📦' }]
      : []),
    ...(allow('/merchant/products')
      ? [
          {
            id: 'catalog',
            label: t('navCatalog'),
            icon: '🛍️',
            children: fullMenuItems
              .find((entry) => 'id' in entry && entry.id === 'catalog')
              ?.children?.filter((item) => {
                const path = 'path' in item ? item.path : '';
                return path && allow(path);
              }),
          },
        ].filter((entry) => (entry.children?.length ?? 0) > 0)
      : []),
  ].filter((entry) => {
    if ('children' in entry && Array.isArray(entry.children)) {
      return entry.children.length > 0;
    }
    if (entry.path) return allow(entry.path);
    return false;
  });

  const menuItems = kioskRestricted
    ? [
        ...(allowKiosk('/merchant/kiosk')
          ? [{ label: t('kioskNav'), path: '/merchant/kiosk', icon: '🖥️' }]
          : []),
      ].filter((entry) => {
        if ('children' in entry && Array.isArray(entry.children)) {
          return entry.children.length > 0;
        }
        if (entry.path) return allow(entry.path);
        return false;
      })
    : storekeeperRestricted
    ? [
        ...(allowStorekeeper('/merchant/storekeeper')
          ? [{ label: t('storekeeperTitle'), path: '/merchant/storekeeper', icon: '📱' }]
          : []),
        ...(allowInventory('/merchant/inventory')
          ? [
              {
                id: 'inventory',
                label: t('invTitle'),
                icon: '📦',
                children: fullMenuItems
                  .find((entry) => 'id' in entry && entry.id === 'inventory')
                  ?.children?.filter((item) => {
                    if ('heading' in item && item.heading) return true;
                    const path = 'path' in item ? item.path : '';
                    return path && allowInventory(path);
                  }),
              },
            ].filter((entry) => (entry.children?.length ?? 0) > 0)
          : []),
      ].filter((entry) => {
        if ('children' in entry && Array.isArray(entry.children)) {
          return entry.children.length > 0;
        }
        if (entry.path) return allow(entry.path);
        return false;
      })
    : waiterRestricted
      ? waiterMenuItems
      : fullMenuItems;

  const panelChromeRestricted = kioskRestricted || storekeeperRestricted || waiterRestricted;

  return (
    <div className={`flex h-full max-h-full panel-shell${hideChrome ? ' webpos-app-mode' : ''}`}>
      {!hideChrome && (
        <Sidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          menuItems={menuItems}
          panelKey="merchant"
          registerDisplay={registerDisplay}
          showStaffSwitch={hasStaffPins}
          quickAction={
            !storekeeperRestricted && !kioskRestricted && showWebPosQuickAction
              ? { label: t('sidebarPos'), path: '/merchant/pos' }
              : null
          }
          language={locale}
          onLanguageChange={changeLanguage}
          profileMenu={{
            settingsPath:
              !panelChromeRestricted && allow('/merchant/settings')
                ? '/merchant/settings'
                : undefined,
            billingPath:
              !panelChromeRestricted && allow('/merchant/billing') ? '/merchant/billing' : undefined,
            supportPath:
              !panelChromeRestricted && allow('/merchant/support') ? '/merchant/support' : undefined,
          }}
          shopName={merchantShopName}
          shopPath={
            !panelChromeRestricted && allow('/merchant/platform-shop')
              ? '/merchant/platform-shop'
              : null
          }
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
        {!hideChrome && allowInventory('/merchant/inventory') ? <InventoryExpiryAlerts /> : null}

        <main
          className={
            (isPosLikeRoute || isOrderCenterRoute) && posAppMode
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
              path="order-center"
              element={
                <PanelRouteGuard path="/merchant/order-center" allow={allow}>
                  <OrderCenterApp />
                </PanelRouteGuard>
              }
            />
            <Route path="order-hub" element={<Navigate to="/merchant/order-center" replace />} />
            <Route
              path="orders"
              element={
                <PanelRouteGuard path="/merchant/orders" allow={allow}>
                  <Orders />
                </PanelRouteGuard>
              }
            />
            <Route path="delivery" element={<LegacyDeliveryMapRedirect />} />
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
              element={<Navigate to="/merchant/orders?type=invoice" replace />}
            />
            <Route
              path="pos"
              element={
                <WebPosErrorBoundary>
                  <WebPos appMode={hideChrome} />
                </WebPosErrorBoundary>
              }
            />
            <Route
              path="waiter"
              element={
                <PanelRouteGuard path="/merchant/waiter" allow={allow}>
                  <WaiterApp appMode={hideChrome} />
                </PanelRouteGuard>
              }
            />
            <Route
              path="storekeeper"
              element={
                <PanelRouteGuard path="/merchant/storekeeper" allow={allowStorekeeper}>
                  <StorekeeperApp />
                </PanelRouteGuard>
              }
            />
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
              <Route path="transfers" element={<InventoryTransfersPage />} />
              <Route path="outbound" element={<OutboundStockPage />} />
              <Route path="counting" element={<StockCountingPage />} />
              <Route path="history" element={<StockHistoryPage />} />
              <Route path="items" element={<StockItemsPage />} />
              <Route path="categories" element={<StockCategoriesPage />} />
              <Route path="cookbook" element={<CookbookPage />} />
              <Route path="suppliers" element={<SuppliersPage />} />
              <Route path="units" element={<UnitsPage />} />
              <Route path="report" element={<InventoryReportPage />} />
              <Route path="dead-stock" element={<DeadStockReportPage />} />
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
              path="chaslay-page-builder"
              element={
                <PanelRouteGuard path="/merchant/chaslay-page-builder" allow={allow}>
                  <Suspense fallback={<div className="p-4 text-sm muted">{t('loading')}</div>}>
                    <ChaslayPageBuilderList />
                  </Suspense>
                </PanelRouteGuard>
              }
            />
            <Route
              path="chaslay-page-builder/edit"
              element={
                <PanelRouteGuard path="/merchant/chaslay-page-builder" allow={allow}>
                  <Suspense fallback={<div className="p-4 text-sm muted">{t('loading')}</div>}>
                    <ChaslayPageBuilderEditor />
                  </Suspense>
                </PanelRouteGuard>
              }
            />
            <Route
              path="hq"
              element={
                <PanelRouteGuard path="/merchant/hq" allow={allowHq}>
                  <HqDashboardPage />
                </PanelRouteGuard>
              }
            />
            <Route
              path="hq/menus"
              element={
                <PanelRouteGuard path="/merchant/hq/menus" allow={allowHq}>
                  <HqMenusPage />
                </PanelRouteGuard>
              }
            />
            <Route
              path="hq/bulk-pricing"
              element={
                <PanelRouteGuard path="/merchant/hq/bulk-pricing" allow={allowHq}>
                  <BulkPricingPage />
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
              path="kiosk"
              element={
                <PanelRouteGuard path="/merchant/kiosk" allow={allowKiosk}>
                  <KioskSettingsPage />
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
            <Route path="users" element={<LegacyUsersRedirect />} />
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
