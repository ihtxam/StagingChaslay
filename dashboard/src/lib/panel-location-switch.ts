/** Roles that may change panel location scope (HQ ↔ branches). */

import type { Permission } from '@/lib/permissions';
import { hasPermission } from '@/lib/permissions';

export function normalizeStaffRoleKey(roleName: string | null | undefined): string {
  return String(roleName || "")
    .trim()
    .toLowerCase();
}

export function canSwitchPanelLocationFromUser(user: {
  role?: string;
  roleName?: string | null;
  isOwner?: boolean;
} | null | undefined): boolean {
  if (!user) return false;
  return canSwitchPanelLocation({
    authRole: user.role,
    roleName: user.roleName,
    isOwner: user.isOwner,
  });
}

export function canSwitchPanelLocation(input: {
  authRole?: string | null;
  roleName?: string | null;
  isOwner?: boolean;
}): boolean {
  if (input.isOwner) return true;
  const authRole = String(input.authRole || "").trim().toLowerCase();
  if (authRole === "merchant" || authRole === "superadmin" || authRole === "reseller") {
    return true;
  }
  const key = normalizeStaffRoleKey(input.roleName);
  return key === "manager" || key === "admin" || key === "hq";
}

/** JWT + active PIN session — owner JWT cannot unlock HQ while a waiter PIN is clocked in. */
export function effectiveCanSwitchPanelLocation(opts: {
  jwtUser: {
    role?: string;
    roleName?: string | null;
    isOwner?: boolean;
    permissions?: Permission[];
  } | null | undefined;
  pinRoleName?: string | null;
  pinPermissions?: Permission[] | null;
  pinActive: boolean;
}): boolean {
  const jwtCan = canSwitchPanelLocationFromUser(opts.jwtUser);
  if (!jwtCan) return false;
  if (!opts.pinActive || !opts.pinRoleName) return true;

  const pinCanSwitchRole = canSwitchPanelLocation({
    authRole: 'staff',
    roleName: opts.pinRoleName,
    isOwner: false,
  });
  const pinHasPanel = hasPermission(opts.pinPermissions || [], 'ACCESS_PANEL', false);
  const jwtManager =
    !!opts.jwtUser?.isOwner ||
    opts.jwtUser?.role === 'merchant' ||
    hasPermission(opts.jwtUser?.permissions, 'ACCESS_PANEL', false);

  if (jwtManager && pinHasPanel && pinCanSwitchRole) return true;
  return pinCanSwitchRole && pinHasPanel;
}
