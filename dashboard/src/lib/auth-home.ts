import type { Permission } from '@/lib/permissions';
import { hasPermission } from '@/lib/permissions';
import type { User } from '@/store/auth';

const PANEL_HINTS: Permission[] = [
  'ACCESS_PANEL',
  'VIEW_REPORTS',
  'MANAGE_SETTINGS',
  'MANAGE_PRODUCTS',
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

function hasPanelAccess(permissions: Permission[] | undefined, isOwner: boolean): boolean {
  if (isOwner) return true;
  return PANEL_HINTS.some((p) => hasPermission(permissions, p, false));
}

/** Home path after email/password login. Does not affect PIN WebPOS / waiter PIN. */
export function homePathForUser(user: Pick<User, 'role' | 'permissions' | 'isOwner'>): string {
  if (user.role === 'superadmin') return '/superadmin';
  if (user.role === 'reseller') return '/reseller';
  if (user.role === 'merchant' && user.isOwner !== false) return '/merchant';

  const perms = user.permissions;
  if (hasPanelAccess(perms, user.isOwner === true)) return '/merchant';
  if (hasPermission(perms, 'USE_WEBPOS', false) && hasPermission(perms, 'MANAGE_TABLES', false)) {
    return '/merchant/waiter';
  }
  if (hasPermission(perms, 'USE_WEBPOS', false)) return '/merchant/pos';
  return '/merchant';
}
