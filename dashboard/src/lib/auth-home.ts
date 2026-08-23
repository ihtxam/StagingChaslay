import type { Permission } from '@/lib/permissions';
import {
  deliveryDriverHomePath,
  hasFullPanelAccess,
  hasPermission,
  isDeliveryDriverOnlyStaff,
} from '@/lib/permissions';
import type { User } from '@/store/auth';

/** Home path after email/password login. Does not affect PIN WebPOS / waiter PIN. */
export function homePathForUser(user: Pick<User, 'role' | 'permissions' | 'isOwner'>): string {
  if (user.role === 'superadmin') return '/superadmin';
  if (user.role === 'reseller') return '/reseller';
  if (user.role === 'merchant' && user.isOwner !== false) return '/merchant';

  const perms = user.permissions as Permission[] | undefined;
  if (isDeliveryDriverOnlyStaff(perms, user.isOwner === true)) return deliveryDriverHomePath();
  if (hasFullPanelAccess(perms, user.isOwner === true)) return '/merchant';
  if (hasPermission(perms, 'USE_WEBPOS', false)) return '/merchant/pos';
  if (hasPermission(perms, 'MANAGE_TABLES', false)) return '/merchant/waiter';
  if (hasPermission(perms, 'MANAGE_PRODUCTS', false)) return '/merchant/products';
  if (hasPermission(perms, 'DELIVERY_ORDERS', false)) return deliveryDriverHomePath();
  return '/merchant/pos';
}
