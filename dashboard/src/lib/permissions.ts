import {
  canAccessEditionRoute,
  type EditionFeatureKey,
} from './edition-features';

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
  | 'END_OF_DAY';

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
];

export const PANEL_ROUTE_PERMISSIONS: Record<string, Permission[]> = {
  '/merchant': ['VIEW_REPORTS', 'ACCESS_PANEL'],
  '/merchant/orders': ['VIEW_ORDER_HISTORY'],
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
  '/merchant/newsletter': ['MANAGE_ONLINE_SHOP'],
  '/merchant/online-shop': ['MANAGE_ONLINE_SHOP'],
  '/merchant/website': ['MANAGE_ONLINE_SHOP'],
  '/merchant/floor-plan': ['MANAGE_TABLES'],
  '/merchant/tables': ['MANAGE_TABLES'],
  '/merchant/tables/settings': ['MANAGE_TABLES'],
  '/merchant/tables/layout': ['MANAGE_TABLES'],
  '/merchant/tables/qr': ['MANAGE_TABLES'],
  '/merchant/sales/reservations': ['VIEW_ORDER_HISTORY'],
  '/merchant/reservations': ['VIEW_ORDER_HISTORY'],
  '/merchant/billing': ['MANAGE_BILLING'],
  '/merchant/settings': ['MANAGE_SETTINGS'],
  '/merchant/users': ['MANAGE_STAFF'],
};

export function canAccessRoute(
  path: string,
  permissions: Permission[] | undefined,
  isOwner: boolean,
  editionFeatures?: EditionFeatureKey[] | null
): boolean {
  if (!canAccessEditionRoute(path, editionFeatures ?? null)) return false;
  if (isOwner) return true;
  const required = PANEL_ROUTE_PERMISSIONS[path];
  if (!required?.length) return true;
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

function parseStaffSession(raw: string | null): WebPosStaffSession | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WebPosStaffSession;
  } catch {
    return null;
  }
}

export function loadWebPosStaffSession(): WebPosStaffSession | null {
  try {
    const fromSession = parseStaffSession(sessionStorage.getItem(WEBPOS_STAFF_KEY));
    if (fromSession) return fromSession;
    const fromPersist = parseStaffSession(localStorage.getItem(WEBPOS_STAFF_PERSIST_KEY));
    if (fromPersist) {
      sessionStorage.setItem(WEBPOS_STAFF_KEY, JSON.stringify(fromPersist));
    }
    return fromPersist;
  } catch {
    return null;
  }
}

export function saveWebPosStaffSession(session: WebPosStaffSession | null) {
  if (!session) {
    sessionStorage.removeItem(WEBPOS_STAFF_KEY);
    localStorage.removeItem(WEBPOS_STAFF_PERSIST_KEY);
    return;
  }
  const raw = JSON.stringify(session);
  sessionStorage.setItem(WEBPOS_STAFF_KEY, raw);
  try {
    localStorage.setItem(WEBPOS_STAFF_PERSIST_KEY, raw);
  } catch {
    /* quota — session tab still works */
  }
}

export function clearWebPosStaffSession() {
  sessionStorage.removeItem(WEBPOS_STAFF_KEY);
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
      if (
        !session ||
        session.id !== fresh.id ||
        session.roleId !== fresh.roleId ||
        session.roleName !== fresh.roleName
      ) {
        session = fresh;
        saveWebPosStaffSession(session);
      }
    }
  }

  return session;
}

/**
 * Effective panel permissions while a WebPOS PIN session is active.
 * Owner JWT must not bypass a restricted floor staff PIN (waiter/cashier).
 */
export function getEffectivePanelAccess(opts: {
  jwtPermissions: Permission[] | undefined;
  isOwner: boolean;
  staffConfigured: boolean;
  pinSession: WebPosStaffSession | null;
}): {
  permissions: Permission[] | undefined;
  /** Treat as owner for route checks (false when a PIN session is active). */
  isOwner: boolean;
  canOpenPanel: boolean;
  pinActive: boolean;
} {
  const pinActive = opts.staffConfigured && !!opts.pinSession;
  if (pinActive && opts.pinSession) {
    const permissions = opts.pinSession.permissions || [];
    return {
      permissions,
      isOwner: false,
      canOpenPanel: hasPermission(permissions, 'ACCESS_PANEL', false),
      pinActive: true,
    };
  }
  return {
    permissions: opts.jwtPermissions,
    isOwner: opts.isOwner,
    canOpenPanel: opts.isOwner || hasPermission(opts.jwtPermissions, 'ACCESS_PANEL', false),
    pinActive: false,
  };
}
