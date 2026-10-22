/** Roles that may change panel location scope (HQ ↔ branches). */

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
