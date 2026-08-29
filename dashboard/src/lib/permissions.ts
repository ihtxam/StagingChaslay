import {
  canAccessEditionRoute,
  type EditionFeatureKey,
} from './edition-features';
import { canAccessBusinessModuleRoute, type BusinessModule } from './business-module';
import { isStandalonePwa } from './pwa';
import { normalizeStaffLoginHome, type StaffLoginHome } from './staff-login-home';

export type Permission =
  | 'USE_POS'
  | 'USE_WEBPOS'
  | 'PROCESS_PAYMENTS'
  | 'APPLY_DISCOUNTS'
  | 'OPEN_CASH_DRAWER'
  | 'SEND_KITCHEN'
  | 'MANAGE_TABLES'
  | 'TAKEAWAY_ORDERS'
  | 'DELIVERY_ORDERS'
  | 'VIEW_DELIVERY_TRACKING'
  | 'VIEW_ORDER_HISTORY'
  | 'CANCEL_ORDERS'
  | 'REFUND_ORDERS'
  | 'VIEW_REPORTS'
  | 'VIEW_ALL_SALES'
  | 'MANAGE_PRODUCTS'
  | 'MANAGE_CUSTOMERS'
  | 'MANAGE_OFFERS'
  | 'MANAGE_ONLINE_SHOP'
  | 'MANAGE_SETTINGS'
  | 'ACCESS_PANEL'
  | 'MANAGE_STAFF'
  | 'MANAGE_ROLES'
  | 'MANAGE_BILLING'
  | 'END_OF_DAY'
  | 'MANAGE_INVENTORY'
  | 'STOREKEEPER_INTAKE'
  | 'MANAGE_KIOSK';

export const ALL_PERMISSIONS: Permission[] = [
  'USE_POS',
  'USE_WEBPOS',
  'PROCESS_PAYMENTS',
  'APPLY_DISCOUNTS',
  'OPEN_CASH_DRAWER',
  'SEND_KITCHEN',
  'MANAGE_TABLES',
  'TAKEAWAY_ORDERS',
  'DELIVERY_ORDERS',
  'VIEW_DELIVERY_TRACKING',
  'VIEW_ORDER_HISTORY',
  'CANCEL_ORDERS',
  'REFUND_ORDERS',
  'VIEW_REPORTS',
  'VIEW_ALL_SALES',
  'MANAGE_PRODUCTS',
  'MANAGE_CUSTOMERS',
  'MANAGE_OFFERS',
  'MANAGE_ONLINE_SHOP',
  'MANAGE_SETTINGS',
  'ACCESS_PANEL',
  'MANAGE_STAFF',
  'MANAGE_ROLES',
  'MANAGE_BILLING',
  'END_OF_DAY',
  'MANAGE_INVENTORY',
  'STOREKEEPER_INTAKE',
  'MANAGE_KIOSK',
];

export const PANEL_ROUTE_PERMISSIONS: Record<string, Permission[]> = {
  '/merchant': ['VIEW_REPORTS', 'ACCESS_PANEL'],
  '/merchant/orders': ['VIEW_ORDER_HISTORY'],
  '/merchant/order-hub': ['VIEW_ORDER_HISTORY'],
  '/merchant/order-center': ['VIEW_ORDER_HISTORY'],
  '/merchant/delivery': ['VIEW_DELIVERY_TRACKING'],
  '/merchant/delivery/driver': ['DELIVERY_ORDERS'],
  '/merchant/invoices': ['VIEW_REPORTS', 'VIEW_ALL_SALES', 'ACCESS_PANEL'],
  '/merchant/pos': ['USE_WEBPOS'],
  '/merchant/waiter': ['USE_WEBPOS'],
  '/merchant/reports': ['VIEW_REPORTS', 'END_OF_DAY'],
  '/merchant/products': ['MANAGE_PRODUCTS'],
  '/merchant/modifiers': ['MANAGE_PRODUCTS'],
  '/merchant/categories': ['MANAGE_PRODUCTS'],
  '/merchant/customers': ['MANAGE_CUSTOMERS'],
  '/merchant/members': ['MANAGE_CUSTOMERS'],
  '/merchant/loyalty': ['MANAGE_CUSTOMERS'],
  '/merchant/offers': ['MANAGE_OFFERS'],
  '/merchant/vouchers': ['MANAGE_OFFERS'],
  '/merchant/terminals': ['MANAGE_SETTINGS'],
  '/merchant/newsletter': ['MANAGE_ONLINE_SHOP'],
  '/merchant/online-shop': ['MANAGE_ONLINE_SHOP'],
  '/merchant/website': ['MANAGE_ONLINE_SHOP'],
  '/merchant/floor-plan': ['MANAGE_TABLES'],
  '/merchant/tables': ['MANAGE_TABLES'],
  '/merchant/tables/settings': ['MANAGE_TABLES'],
  '/merchant/tables/layout': ['MANAGE_TABLES'],
  '/merchant/tables/qr': ['MANAGE_TABLES'],
  '/merchant/sales/reservations': ['MANAGE_ONLINE_SHOP', 'VIEW_REPORTS'],
  '/merchant/reservations': ['MANAGE_ONLINE_SHOP', 'VIEW_REPORTS'],
  '/merchant/billing': ['MANAGE_BILLING'],
  '/merchant/platform-shop': ['MANAGE_BILLING'],
  '/merchant/hq': ['ACCESS_PANEL', 'MANAGE_SETTINGS', 'MANAGE_PRODUCTS'],
  '/merchant/hq/menus': ['ACCESS_PANEL', 'MANAGE_SETTINGS', 'MANAGE_PRODUCTS'],
  '/merchant/hq/bulk-pricing': ['ACCESS_PANEL', 'MANAGE_SETTINGS', 'MANAGE_PRODUCTS'],
  '/merchant/settings': ['MANAGE_SETTINGS', 'MANAGE_STAFF', 'VIEW_DELIVERY_TRACKING'],
  '/merchant/support': ['ACCESS_PANEL'],
  '/merchant/users': ['MANAGE_STAFF'],
  '/merchant/inventory': ['MANAGE_INVENTORY'],
  '/merchant/inventory/home': ['MANAGE_INVENTORY'],
  '/merchant/inventory/list': ['MANAGE_INVENTORY'],
  '/merchant/inventory/inbound': ['MANAGE_INVENTORY'],
  '/merchant/inventory/outbound': ['MANAGE_INVENTORY'],
  '/merchant/inventory/counting': ['MANAGE_INVENTORY'],
  '/merchant/inventory/history': ['MANAGE_INVENTORY'],
  '/merchant/inventory/items': ['MANAGE_INVENTORY'],
  '/merchant/inventory/categories': ['MANAGE_INVENTORY'],
  '/merchant/inventory/cookbook': ['MANAGE_INVENTORY'],
  '/merchant/inventory/suppliers': ['MANAGE_INVENTORY'],
  '/merchant/inventory/units': ['MANAGE_INVENTORY'],
  '/merchant/inventory/report': ['MANAGE_INVENTORY'],
  '/merchant/inventory/consumption': ['MANAGE_INVENTORY'],
  '/merchant/storekeeper': ['STOREKEEPER_INTAKE', 'MANAGE_INVENTORY'],
  '/merchant/signage': ['MANAGE_SETTINGS', 'MANAGE_PRODUCTS', 'ACCESS_PANEL'],
  '/merchant/kiosk': ['MANAGE_KIOSK', 'MANAGE_SETTINGS'],
};

export const CATALOG_PANEL_PATHS = [
  '/merchant/products',
  '/merchant/categories',
  '/merchant/modifiers',
] as const;

export function isCatalogPanelPath(path: string): boolean {
  return CATALOG_PANEL_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

export function isOrdersPanelPath(path: string): boolean {
  return (
    path === '/merchant/orders' ||
    path.startsWith('/merchant/orders/') ||
    path === '/merchant/order-hub' ||
    path === '/merchant/order-center'
  );
}

export function isReportsPanelPath(path: string): boolean {
  return path === '/merchant/reports' || path.startsWith('/merchant/reports/');
}

export function canOpenReportsPanel(permissions: Permission[] | undefined, isOwner: boolean): boolean {
  if (isOwner) return true;
  return (
    hasPermission(permissions, 'VIEW_REPORTS', false) ||
    hasPermission(permissions, 'END_OF_DAY', false)
  );
}

function normalizePanelPath(path: string): string {
  return path.split('?')[0].replace(/\/$/, '') || '/merchant';
}

/** Resolve required permissions for a panel path; null = unknown merchant route (deny non-owners). */
export function resolvePanelRoutePermissions(path: string): Permission[] | null | undefined {
  const normalized = normalizePanelPath(path);
  if (Object.prototype.hasOwnProperty.call(PANEL_ROUTE_PERMISSIONS, normalized)) {
    return PANEL_ROUTE_PERMISSIONS[normalized];
  }
  if (normalized.startsWith('/merchant/inventory/')) {
    return PANEL_ROUTE_PERMISSIONS['/merchant/inventory'];
  }
  if (normalized.startsWith('/merchant/')) {
    return null;
  }
  return [];
}

/** Catalog, orders, and/or reports — limited back office without full ACCESS_PANEL. */
export function isLimitedBackOfficePath(path: string): boolean {
  return (
    isCatalogPanelPath(path) || isOrdersPanelPath(path) || isReportsPanelPath(path)
  );
}

/**
 * Where limited staff land when leaving POS.
 * Menu (catalogue) is preferred when both menu and orders are granted.
 */
export function backOfficeHomePath(
  permissions: Permission[] | undefined,
  isOwner: boolean
): string {
  if (isOwner || hasPermission(permissions, 'ACCESS_PANEL', false)) {
    return '/merchant';
  }
  if (hasPermission(permissions, 'MANAGE_PRODUCTS', false)) return '/merchant/products';
  if (hasPermission(permissions, 'STOREKEEPER_INTAKE', false)) return storekeeperHomePath();
  if (hasPermission(permissions, 'MANAGE_KIOSK', false)) return kioskHomePath();
  if (hasPermission(permissions, 'MANAGE_INVENTORY', false)) return '/merchant/inventory';
  if (hasPermission(permissions, 'VIEW_ORDER_HISTORY', false)) return '/merchant/orders';
  return '/merchant/pos';
}

/** Full merchant backend (not catalog-only). MANAGE_PRODUCTS is catalog, not dashboard. */
export const FULL_PANEL_PERMISSIONS: Permission[] = [
  'ACCESS_PANEL',
  'VIEW_REPORTS',
  'MANAGE_SETTINGS',
  'MANAGE_STAFF',
  'MANAGE_BILLING',
  'MANAGE_CUSTOMERS',
  'MANAGE_ONLINE_SHOP',
  'MANAGE_OFFERS',
  'MANAGE_INVENTORY',
  'MANAGE_ROLES',
  'VIEW_ALL_SALES',
  'END_OF_DAY',
];

export function hasFullPanelAccess(
  permissions: Permission[] | undefined,
  isOwner: boolean
): boolean {
  if (isOwner) return true;
  return FULL_PANEL_PERMISSIONS.some((p) => hasPermission(permissions, p, false));
}

export function staffRoleDisplayName(name: string, t: (key: string) => string): string {
  const n = name.trim().toLowerCase();
  if (n === 'waiter' || n === 'waiter (pos only)') return t('staffRoleWaiter');
  if (n.includes('menu editor') || n.includes('menu-editor')) return t('staffRoleWaiterMenu');
  if (n === 'storekeeper') return t('staffRoleStorekeeper');
  if (n === 'kiosk operator') return t('staffRoleKiosk');
  return name;
}

export function canAccessRoute(
  path: string,
  permissions: Permission[] | undefined,
  isOwner: boolean,
  editionFeatures?: EditionFeatureKey[] | null,
  businessModule?: BusinessModule | null
): boolean {
  if (!canAccessBusinessModuleRoute(path, businessModule)) return false;
  if (!canAccessEditionRoute(path, editionFeatures ?? null)) return false;
  if (isOwner) return true;
  const required = resolvePanelRoutePermissions(path);
  if (required === null) return false;
  if (!required.length) return true;
  if (!permissions?.length) return false;
  return required.some((p) => permissions.includes(p));
}

export function hasPermission(
  permissions: Permission[] | undefined,
  required: Permission,
  isOwner = false
): boolean {
  if (isOwner) return true;
  return !!permissions?.includes(required);
}

/** Delivery-only staff (livreur) — driver app, not register POS. */
export function isDeliveryDriverOnlyStaff(
  permissions: Permission[] | undefined,
  isOwner = false
): boolean {
  if (isOwner) return false;
  if (!hasPermission(permissions, 'DELIVERY_ORDERS', false)) return false;
  if (hasPermission(permissions, 'USE_WEBPOS', false)) return false;
  if (hasPermission(permissions, 'MANAGE_TABLES', false)) return false;
  if (hasPermission(permissions, 'ACCESS_PANEL', false)) return false;
  return true;
}

export function deliveryDriverHomePath(): string {
  return '/merchant/delivery/driver';
}

/** Storekeeper-only staff — mobile stock intake, not full panel. */
export function isStorekeeperOnlyStaff(
  permissions: Permission[] | undefined,
  isOwner = false
): boolean {
  if (isOwner) return false;
  if (!hasPermission(permissions, 'STOREKEEPER_INTAKE', false)) return false;
  if (hasPermission(permissions, 'ACCESS_PANEL', false)) return false;
  if (hasPermission(permissions, 'USE_WEBPOS', false)) return false;
  if (hasPermission(permissions, 'MANAGE_INVENTORY', false)) return false;
  return true;
}

/**
 * Storekeeper staff without full panel access — may use the mobile intake app
 * and (optionally) inventory pages, but not CMS, users, sales, etc.
 */
export function isStorekeeperRestrictedStaff(
  permissions: Permission[] | undefined,
  isOwner = false
): boolean {
  if (isOwner) return false;
  if (!hasPermission(permissions, 'STOREKEEPER_INTAKE', false)) return false;
  if (hasPermission(permissions, 'ACCESS_PANEL', false)) return false;
  return true;
}

/**
 * Floor waiters without full panel access — waiter/POS app and (optionally) menu or
 * orders only. Never CMS, inventory, clients, or settings.
 */
export function isWaiterRestrictedStaff(
  permissions: Permission[] | undefined,
  isOwner = false
): boolean {
  if (isOwner) return false;
  if (!hasPermission(permissions, 'MANAGE_TABLES', false)) return false;
  if (hasPermission(permissions, 'ACCESS_PANEL', false)) return false;
  return !hasFullPanelAccess(permissions, false);
}

export function isWaiterPanelPath(
  pathname: string,
  permissions: Permission[] | undefined
): boolean {
  const path = pathname.replace(/\/$/, '') || '/merchant';
  if (path === '/merchant/waiter' || path.startsWith('/merchant/waiter/')) return true;
  if (path === '/merchant/pos' || path.startsWith('/merchant/pos/')) return true;
  if (hasPermission(permissions, 'MANAGE_PRODUCTS', false) && isCatalogPanelPath(path)) {
    return true;
  }
  if (hasPermission(permissions, 'VIEW_ORDER_HISTORY', false) && isOrdersPanelPath(path)) {
    return true;
  }
  return false;
}

export function waiterRestrictedHomePath(permissions: Permission[] | undefined): string {
  if (hasPermission(permissions, 'MANAGE_PRODUCTS', false)) return '/merchant/products';
  if (hasPermission(permissions, 'VIEW_ORDER_HISTORY', false)) return '/merchant/orders';
  if (hasPermission(permissions, 'MANAGE_TABLES', false)) return '/merchant/waiter';
  return '/merchant/pos';
}

export function isStorekeeperPanelPath(
  pathname: string,
  permissions: Permission[] | undefined
): boolean {
  const path = pathname.replace(/\/$/, '') || '/merchant';
  if (path === '/merchant/storekeeper' || path.startsWith('/merchant/storekeeper/')) {
    return true;
  }
  if (hasPermission(permissions, 'MANAGE_INVENTORY', false)) {
    return path === '/merchant/inventory' || path.startsWith('/merchant/inventory/');
  }
  return false;
}

export function storekeeperHomePath(): string {
  return '/merchant/storekeeper';
}

/** Kiosk-only staff — setup sliders, payments, launch customer mode. No full panel. */
export function isKioskOnlyStaff(
  permissions: Permission[] | undefined,
  isOwner = false
): boolean {
  if (isOwner) return false;
  if (!hasPermission(permissions, 'MANAGE_KIOSK', false)) return false;
  if (hasPermission(permissions, 'ACCESS_PANEL', false)) return false;
  if (hasPermission(permissions, 'USE_WEBPOS', false)) return false;
  if (hasPermission(permissions, 'MANAGE_SETTINGS', false)) return false;
  return true;
}

export function isKioskRestrictedStaff(
  permissions: Permission[] | undefined,
  isOwner = false
): boolean {
  if (isOwner) return false;
  if (!hasPermission(permissions, 'MANAGE_KIOSK', false)) return false;
  if (hasPermission(permissions, 'ACCESS_PANEL', false)) return false;
  return true;
}

export function isKioskPanelPath(pathname: string): boolean {
  const path = pathname.replace(/\/$/, '') || '/merchant';
  return path === '/merchant/kiosk' || path.startsWith('/merchant/kiosk/');
}

export function kioskHomePath(): string {
  return '/merchant/kiosk';
}

/** Register POS / waiter — PIN session restricts panel access on these routes only. */
export function isPosFloorPath(pathname: string): boolean {
  const path = pathname.replace(/\/$/, '') || '/merchant';
  return path === '/merchant/pos' || path === '/merchant/waiter' || path.startsWith('/merchant/pos/');
}

/** JWT user may open the merchant back office (owner or panel staff). */
export function jwtHasPanelAccess(
  jwtPermissions: Permission[] | undefined,
  isOwner: boolean,
  authRole?: string | null
): boolean {
  const ownerEffective = isOwner && authRole !== 'staff';
  if (ownerEffective) return true;
  return (
    hasPermission(jwtPermissions, 'ACCESS_PANEL', false) ||
    hasPermission(jwtPermissions, 'MANAGE_INVENTORY', false) ||
    hasPermission(jwtPermissions, 'MANAGE_PRODUCTS', false) ||
    hasPermission(jwtPermissions, 'VIEW_ORDER_HISTORY', false) ||
    canOpenReportsPanel(jwtPermissions, false)
  );
}

/** Floor waiter — tables/POS only, no merchant back office (pos-only template). */
export function isFloorWaiterStaff(
  permissions: Permission[] | undefined,
  isOwner = false
): boolean {
  if (isOwner) return false;
  if (!isWaiterRestrictedStaff(permissions, false)) return false;
  return (
    !hasPermission(permissions, 'MANAGE_PRODUCTS', false) &&
    !hasPermission(permissions, 'VIEW_ORDER_HISTORY', false)
  );
}

/** Staff may open merchant back office only when login destination allows panel access. */
export function canStaffOpenBackOffice(
  permissions: Permission[] | undefined,
  loginHome?: StaffLoginHome | string | null,
  isOwner = false
): boolean {
  if (isOwner) return true;
  if (normalizeStaffLoginHome(loginHome) === 'pos') return false;
  if (isFloorWaiterStaff(permissions, false)) return false;
  if (isStorekeeperRestrictedStaff(permissions, false)) return false;
  if (isWaiterRestrictedStaff(permissions, false)) {
    return (
      hasPermission(permissions, 'MANAGE_PRODUCTS', false) ||
      hasPermission(permissions, 'VIEW_ORDER_HISTORY', false)
    );
  }
  return jwtHasPanelAccess(permissions, false, 'staff');
}

/**
 * Prominent sidebar WebPOS shortcut — uses JWT identity, not PIN-scoped panel access.
 * Merchant owners always see it; panel staff need USE_WEBPOS on their login role.
 */
export function canShowWebPosQuickAction(
  jwtIsOwner: boolean,
  jwtPermissions: Permission[] | undefined
): boolean {
  if (jwtIsOwner) return true;
  return hasPermission(jwtPermissions, 'USE_WEBPOS', false);
}

export type WebPosStaffSession = {
  id: string;
  name: string;
  roleId: string;
  roleName: string;
  permissions: Permission[];
  /** Short-lived staff JWT from PIN verify — used to scope EOD/reports server-side. */
  accessToken?: string;
};

const WEBPOS_STAFF_KEY = 'webpos_staff_session';
/** Survives PWA relaunch when sessionStorage is cleared (offline register). */
const WEBPOS_STAFF_PERSIST_KEY = 'webpos_staff_session_persist';
/** Set in sessionStorage when PIN verify / staff auto-bind succeeded in this tab. */
const WEBPOS_STAFF_VALIDATED_KEY = 'webpos_staff_session_validated';

/** Dispatched when the active register staff session changes (PIN switch, logout, reconcile). */
export const WEBPOS_STAFF_SESSION_EVENT = 'webpos:staff-session';

export function notifyWebPosStaffSessionChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(WEBPOS_STAFF_SESSION_EVENT));
}

function parseStaffSession(raw: string | null): WebPosStaffSession | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WebPosStaffSession;
  } catch {
    return null;
  }
}

/**
 * Load the active register PIN session.
 *
 * Persistence rules (single source of truth for "who is on the till"):
 * - `sessionStorage` + validated flag: active tab session (survives refresh in the same tab).
 * - `localStorage` persist: only restored in installed PWA when sessionStorage was cleared
 *   (offline relaunch). Never auto-restored in a normal browser tab — avoids stale waiter
 *   sessions overriding a merchant-owner JWT after login/refresh.
 * - Merchant JWT (`localStorage` token/user) is separate and never replaced by PIN state.
 */
export function loadWebPosStaffSession(): WebPosStaffSession | null {
  try {
    const validated = sessionStorage.getItem(WEBPOS_STAFF_VALIDATED_KEY) === '1';
    const fromSession = parseStaffSession(sessionStorage.getItem(WEBPOS_STAFF_KEY));
    if (fromSession && validated) return fromSession;

    if (isStandalonePwa()) {
      const fromPersist = parseStaffSession(localStorage.getItem(WEBPOS_STAFF_PERSIST_KEY));
      if (fromPersist) {
        sessionStorage.setItem(WEBPOS_STAFF_KEY, JSON.stringify(fromPersist));
        sessionStorage.setItem(WEBPOS_STAFF_VALIDATED_KEY, '1');
        return fromPersist;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function saveWebPosStaffSession(session: WebPosStaffSession | null) {
  if (!session) {
    clearWebPosStaffSession();
    return;
  }
  const raw = JSON.stringify(session);
  sessionStorage.setItem(WEBPOS_STAFF_KEY, raw);
  sessionStorage.setItem(WEBPOS_STAFF_VALIDATED_KEY, '1');
  try {
    localStorage.setItem(WEBPOS_STAFF_PERSIST_KEY, raw);
  } catch {
    /* quota — session tab still works */
  }
}

export function clearWebPosStaffSession() {
  sessionStorage.removeItem(WEBPOS_STAFF_KEY);
  sessionStorage.removeItem(WEBPOS_STAFF_VALIDATED_KEY);
  try {
    localStorage.removeItem(WEBPOS_STAFF_PERSIST_KEY);
  } catch {
    /* ignore */
  }
}

export type StaffRosterRow = {
  id: string;
  name: string;
  roleId: string;
  roleName: string;
  permissions?: Permission[];
  isActive?: boolean;
};

export function webPosSessionFromStaffProfile(profile: {
  id: string;
  name: string;
  roleId: string;
  roleName: string;
  permissions: Permission[];
  accessToken?: string;
}): WebPosStaffSession {
  return {
    id: profile.id,
    name: profile.name,
    roleId: profile.roleId,
    roleName: profile.roleName,
    permissions: profile.permissions,
    accessToken: profile.accessToken,
  };
}

/** True when a stored PIN session no longer matches the server staff roster. */
export function isStaleWebPosStaffSession(
  session: WebPosStaffSession,
  staffList: StaffRosterRow[]
): boolean {
  const row = staffList.find((s) => s.id === session.id);
  if (!row || row.isActive === false) return true;
  if (row.roleId !== session.roleId) return true;
  if (row.roleName !== session.roleName) return true;
  return false;
}

/**
 * Resolve WebPOS staff session after catalog load:
 * - drop stale PIN sessions (role changed in portal)
 * - auto-bind panel staff JWT users to their current server role (skip PIN gate)
 */
/** Merchant owner (or impersonated owner) already signed into the dashboard. */
export function isMerchantOwnerJwt(user?: {
  role?: string | null;
  isOwner?: boolean;
} | null): boolean {
  return user?.role === 'merchant' && user?.isOwner !== false;
}

/**
 * Hard PIN wall for WebPOS / waiter:
 * - skip when no staff PINs exist (first-run / new shop)
 * - skip when a staff PIN session is already active (incl. official staff login auto-bind)
 * - skip when offline cache unlock applies
 * Merchant owner JWT does not bypass — shared registers require clock-in once PINs exist.
 */
export function webPosPinGateRequired(opts: {
  hasStaffPins: boolean;
  pinSession: WebPosStaffSession | null;
  offlineUnlocked?: boolean;
}): boolean {
  if (opts.offlineUnlocked) return false;
  if (opts.pinSession) return false;
  if (!opts.hasStaffPins) return false;
  return true;
}

/** Notify open WebPOS / waiter tabs to reload staff roster (e.g. after PIN created in Users). */
export function notifyStaffRosterChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('webpos:staff-roster-changed'));
}

function sessionFromRosterRow(
  row: StaffRosterRow,
  accessToken?: string
): WebPosStaffSession {
  return webPosSessionFromStaffProfile({
    id: row.id,
    name: row.name,
    roleId: row.roleId,
    roleName: row.roleName,
    permissions: row.permissions || [],
    accessToken,
  });
}

function sessionsEqual(a: WebPosStaffSession, b: WebPosStaffSession): boolean {
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.roleId === b.roleId &&
    a.roleName === b.roleName &&
    JSON.stringify(a.permissions) === JSON.stringify(b.permissions)
  );
}

export function resolveWebPosStaffSession(opts: {
  staffList: StaffRosterRow[];
  authStaffId?: string | null;
  authRole?: string | null;
  authPermissions?: Permission[];
  existing?: WebPosStaffSession | null;
}): WebPosStaffSession | null {
  const staffList = opts.staffList.filter((s) => s.isActive !== false);
  let session = opts.existing ?? loadWebPosStaffSession();

  if (session && isStaleWebPosStaffSession(session, staffList)) {
    session = null;
    clearWebPosStaffSession();
  }

  if (session) {
    const row = staffList.find((s) => s.id === session!.id);
    if (row) {
      const fresh = sessionFromRosterRow(row, session.accessToken);
      if (!sessionsEqual(session, fresh)) {
        session = fresh;
        saveWebPosStaffSession(session);
      }
    }
  }

  if (opts.authRole === 'staff' && opts.authStaffId) {
    const row = staffList.find((s) => s.id === opts.authStaffId);
    if (row) {
      const fresh = webPosSessionFromStaffProfile({
        id: row.id,
        name: row.name,
        roleId: row.roleId,
        roleName: row.roleName,
        permissions: row.permissions?.length
          ? row.permissions
          : opts.authPermissions || [],
        accessToken: session?.id === row.id ? session.accessToken : undefined,
      });
      if (!session || !sessionsEqual(session, fresh)) {
        session = fresh;
        saveWebPosStaffSession(session);
      }
    }
  }

  return session;
}

/** Sidebar / header / POS chrome — one label for the active register user. */
export function getEffectiveRegisterDisplay(opts: {
  jwtUser?: {
    name?: string | null;
    roleName?: string | null;
    role?: string | null;
    isOwner?: boolean;
  } | null;
  pinSession: WebPosStaffSession | null;
  pinActive: boolean;
  impersonating?: boolean;
  t: (key: string) => string;
}): { name: string; roleLabel: string } {
  if (opts.impersonating) {
    return {
      name: opts.jwtUser?.name || '',
      roleLabel: 'Merchant (SA)',
    };
  }
  if (opts.pinActive && opts.pinSession) {
    return {
      name: opts.pinSession.name,
      roleLabel: staffRoleDisplayName(opts.pinSession.roleName, opts.t),
    };
  }
  const roleLabel = opts.jwtUser?.isOwner
    ? opts.t('staffOwnerTitle')
    : opts.jwtUser?.roleName || opts.jwtUser?.role || '';
  return {
    name: opts.jwtUser?.name || '',
    roleLabel,
  };
}

/**
 * Effective panel permissions while a WebPOS PIN session is active.
 * Owner JWT must not bypass a restricted floor staff PIN (waiter/cashier).
 */
export function isStaffJwt(user?: { role?: string | null } | null): boolean {
  return user?.role === 'staff';
}

export function getEffectivePanelAccess(opts: {
  jwtPermissions: Permission[] | undefined;
  isOwner: boolean;
  authRole?: string | null;
  /** Shop has at least one active staff PIN configured. */
  hasStaffPins: boolean;
  /** @deprecated use hasStaffPins */
  staffConfigured?: boolean;
  pinSession: WebPosStaffSession | null;
  /** Current route — managers keep panel access off the POS floor when a PIN is active. */
  pathname?: string;
}): {
  permissions: Permission[] | undefined;
  /** Treat as owner for route checks (false when a PIN session is active). */
  isOwner: boolean;
  canOpenPanel: boolean;
  /** Products / categories / modifiers only — not Sales, Settings, Users. */
  canOpenCatalog: boolean;
  /** Backend Orders list — not invoices or Sales overview. */
  canOpenOrders: boolean;
  /** Sales reports / EOD (VIEW_REPORTS or END_OF_DAY). */
  canOpenReports: boolean;
  /** At least one back-office page (panel, menu, orders, or reports). */
  canOpenBackOffice: boolean;
  pinActive: boolean;
} {
  const ownerEffective = opts.isOwner && opts.authRole !== 'staff';
  const hasStaffPins = opts.hasStaffPins ?? !!opts.staffConfigured;
  const pinActive = hasStaffPins && !!opts.pinSession;

  const jwtAccess = () => {
    const canOpenPanel =
      ownerEffective || hasPermission(opts.jwtPermissions, 'ACCESS_PANEL', false);
    const canOpenCatalog =
      ownerEffective || hasPermission(opts.jwtPermissions, 'MANAGE_PRODUCTS', false);
    const canOpenOrders =
      ownerEffective || hasPermission(opts.jwtPermissions, 'VIEW_ORDER_HISTORY', false);
    const canOpenReports = canOpenReportsPanel(opts.jwtPermissions, ownerEffective);
    return {
      permissions: opts.jwtPermissions,
      isOwner: ownerEffective,
      canOpenPanel,
      canOpenCatalog,
      canOpenOrders,
      canOpenReports,
      canOpenBackOffice:
        canOpenPanel || canOpenCatalog || canOpenOrders || canOpenReports,
      pinActive: false,
    };
  };

  if (pinActive && opts.pinSession) {
    const onPosFloor = opts.pathname ? isPosFloorPath(opts.pathname) : false;
    const managerJwt = jwtHasPanelAccess(opts.jwtPermissions, opts.isOwner, opts.authRole);
    // Managers visiting Storekeeper (etc.) keep panel access; PIN only restricts on POS/waiter floor.
    if (managerJwt && !onPosFloor) {
      return { ...jwtAccess(), pinActive: true };
    }

    const permissions = opts.pinSession.permissions || [];
    const canOpenPanel = hasPermission(permissions, 'ACCESS_PANEL', false);
    const canOpenCatalog = hasPermission(permissions, 'MANAGE_PRODUCTS', false);
    const canOpenOrders = hasPermission(permissions, 'VIEW_ORDER_HISTORY', false);
    const canOpenReports = canOpenReportsPanel(permissions, false);
    return {
      permissions,
      isOwner: false,
      canOpenPanel,
      canOpenCatalog,
      canOpenOrders,
      canOpenReports,
      canOpenBackOffice:
        canOpenPanel || canOpenCatalog || canOpenOrders || canOpenReports,
      pinActive: true,
    };
  }

  return jwtAccess();
}
