import type { User } from '@/store/auth';
import {
  backOfficeHomePath,
  deliveryDriverHomePath,
  hasFullPanelAccess,
  hasPermission,
  isDeliveryDriverOnlyStaff,
  isStorekeeperOnlyStaff,
  isWaiterRestrictedStaff,
  storekeeperHomePath,
  waiterRestrictedHomePath,
  type Permission,
} from '@/lib/permissions';
import { normalizeStaffLoginHome, type StaffLoginHome } from '@/lib/staff-login-home';

/** Home path after email/password login. Does not affect PIN WebPOS / waiter PIN. */
export function homePathForUser(
  user: Pick<User, 'role' | 'permissions' | 'isOwner' | 'loginHome'>
): string {
  if (user.role === 'superadmin') return '/superadmin';
  if (user.role === 'reseller') return '/reseller';
  if (user.role === 'merchant' && user.isOwner !== false) return '/merchant';

  const perms = user.permissions as Permission[] | undefined;
  const loginHome = normalizeStaffLoginHome(user.loginHome);

  if (loginHome === 'panel') {
    if (isDeliveryDriverOnlyStaff(perms, user.isOwner === true)) return deliveryDriverHomePath();
    if (isStorekeeperOnlyStaff(perms, user.isOwner === true)) return storekeeperHomePath();
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
    if (hasPermission(perms, 'USE_WEBPOS', false)) return '/merchant/pos';
    if (hasPermission(perms, 'MANAGE_TABLES', false)) return '/merchant/waiter';
    return '/merchant/pos';
  }

  if (isDeliveryDriverOnlyStaff(perms, user.isOwner === true)) return deliveryDriverHomePath();
  if (isStorekeeperOnlyStaff(perms, user.isOwner === true)) return storekeeperHomePath();
  if (isWaiterRestrictedStaff(perms, user.isOwner === true)) {
    return waiterRestrictedHomePath(perms);
  }
  if (hasFullPanelAccess(perms, user.isOwner === true)) return '/merchant';
  if (hasPermission(perms, 'USE_WEBPOS', false)) return '/merchant/pos';
  if (hasPermission(perms, 'MANAGE_TABLES', false)) return '/merchant/waiter';
  if (hasPermission(perms, 'MANAGE_PRODUCTS', false)) return '/merchant/products';
  if (hasPermission(perms, 'DELIVERY_ORDERS', false)) return deliveryDriverHomePath();
  return '/merchant/pos';
}
