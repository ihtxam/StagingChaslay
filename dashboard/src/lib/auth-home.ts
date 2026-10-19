import type { User } from '@/store/auth';
import {
  backOfficeHomePath,
  deliveryDriverHomePath,
  hasFullPanelAccess,
  hasPermission,
  isDeliveryDriverOnlyStaff,
  isPosFloorPath,
  isRegisterFirstStaff,
  isStorekeeperOnlyStaff,
  isKioskOnlyStaff,
  isOrderCenterOnlyStaff,
  isWaiterRestrictedStaff,
  kioskHomePath,
  orderCenterHomePath,
  storekeeperHomePath,
  waiterRestrictedHomePath,
  type Permission,
} from '@/lib/permissions';
import { normalizeStaffLoginHome, type StaffLoginHome } from '@/lib/staff-login-home';

function normalizePath(path: string): string {
  return path.split('?')[0].replace(/\/$/, '') || '/merchant';
}

/** Home path after email/password login. Does not affect PIN WebPOS / waiter PIN. */
export function homePathForUser(
  user: Pick<User, 'role' | 'permissions' | 'isOwner' | 'loginHome'>
): string {
  if (user.role === 'superadmin') return '/superadmin';
  if (user.role === 'reseller') return '/reseller';
  if (user.role === 'merchant' && user.isOwner !== false) return '/merchant';

  const perms = user.permissions as Permission[] | undefined;
  const loginHome = normalizeStaffLoginHome(user.loginHome);

  if (user.role === 'staff' && isRegisterFirstStaff(perms, user.isOwner === true)) {
    return hasPermission(perms, 'MANAGE_TABLES', false) ? '/merchant/waiter' : '/merchant/pos';
  }

  if (loginHome === 'panel') {
    if (isDeliveryDriverOnlyStaff(perms, user.isOwner === true)) return deliveryDriverHomePath();
    if (isStorekeeperOnlyStaff(perms, user.isOwner === true)) return storekeeperHomePath();
    if (isKioskOnlyStaff(perms, user.isOwner === true)) return kioskHomePath();
    if (isOrderCenterOnlyStaff(perms, user.isOwner === true)) return orderCenterHomePath();
    if (isWaiterRestrictedStaff(perms, user.isOwner === true)) {
      return waiterRestrictedHomePath(perms);
    }
    const hasCatalogOrOrders =
      hasPermission(perms, 'MANAGE_PRODUCTS', false) ||
      hasPermission(perms, 'VIEW_ORDER_HISTORY', false);
    const hasFullPanel =
      hasPermission(perms, 'ACCESS_PANEL', false) ||
      hasPermission(perms, 'MANAGE_INVENTORY', false) ||
      hasFullPanelAccess(perms, user.isOwner === true);
    if (!hasCatalogOrOrders && !hasFullPanel && hasPermission(perms, 'MANAGE_TABLES', false)) {
      return '/merchant/waiter';
    }
    return backOfficeHomePath(perms, user.isOwner === true);
  }

  if (loginHome === 'pos') {
    if (isOrderCenterOnlyStaff(perms, user.isOwner === true)) return orderCenterHomePath();
    if (hasPermission(perms, 'USE_WEBPOS', false)) return '/merchant/pos';
    if (hasPermission(perms, 'MANAGE_TABLES', false)) return '/merchant/waiter';
    if (isStorekeeperOnlyStaff(perms, user.isOwner === true)) return storekeeperHomePath();
    if (isDeliveryDriverOnlyStaff(perms, user.isOwner === true)) return deliveryDriverHomePath();
    if (isKioskOnlyStaff(perms, user.isOwner === true)) return kioskHomePath();
    return '/merchant/pos';
  }

  if (isDeliveryDriverOnlyStaff(perms, user.isOwner === true)) return deliveryDriverHomePath();
  if (isStorekeeperOnlyStaff(perms, user.isOwner === true)) return storekeeperHomePath();
  if (isKioskOnlyStaff(perms, user.isOwner === true)) return kioskHomePath();
  if (isOrderCenterOnlyStaff(perms, user.isOwner === true)) return orderCenterHomePath();
  if (isWaiterRestrictedStaff(perms, user.isOwner === true)) {
    return waiterRestrictedHomePath(perms);
  }
  if (hasFullPanelAccess(perms, user.isOwner === true)) return '/merchant';
  if (hasPermission(perms, 'USE_WEBPOS', false)) return '/merchant/pos';
  if (hasPermission(perms, 'MANAGE_TABLES', false)) return '/merchant/waiter';
  if (hasPermission(perms, 'MANAGE_PRODUCTS', false)) return '/merchant/products';
  if (hasPermission(perms, 'DELIVERY_ORDERS', false)) return deliveryDriverHomePath();
  if (hasPermission(perms, 'VIEW_ORDER_HISTORY', false)) return orderCenterHomePath();
  return '/merchant/pos';
}

/** Where to land after a staff PIN verify (clock-in / switch user). Honors per-user loginHome. */
export function homePathAfterStaffPin(
  profile: Pick<User, 'permissions' | 'loginHome'>
): string {
  return homePathForUser({
    role: 'staff',
    permissions: profile.permissions,
    isOwner: false,
    loginHome: profile.loginHome,
  });
}

/**
 * After PIN success, navigate when the clocked-in user's home differs from the current route.
 * On the POS floor gate, two POS destinations (pos vs waiter) count as the same shell.
 */
export function navigateTargetAfterStaffPin(
  profile: Pick<User, 'permissions' | 'loginHome'>,
  currentPath: string,
  mode: 'gate' | 'switch'
): string | null {
  const dest = homePathAfterStaffPin(profile);
  const normDest = normalizePath(dest);
  const normCurrent = normalizePath(currentPath);
  if (normDest === normCurrent) return null;
  if (isPosFloorPath(normCurrent) && isPosFloorPath(normDest)) return null;

  if (mode === 'switch') return dest;

  // Panel PIN gate: send floor staff to their register app when loginHome is POS.
  if (!isPosFloorPath(normCurrent) && isPosFloorPath(normDest)) return dest;

  return null;
}
