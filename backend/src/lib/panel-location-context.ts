import type { Request } from "express";
import { canSwitchPanelLocation } from "@/lib/panel-location-switch";
import { hasPermission, type Permission } from "@/lib/permissions";
import { AuthService, type JWTPayload } from "@/services/auth.service";

export type PinStaffContext = {
  staffId: string;
  roleName: string;
  permissions: Permission[];
};

export function readPinStaffContext(req: Request, merchantId: string): PinStaffContext | null {
  const pinHeader = req.headers["x-webpos-staff-access"];
  const pinTok = Array.isArray(pinHeader) ? pinHeader[0] : pinHeader;
  if (!pinTok || typeof pinTok !== "string" || !pinTok.trim()) return null;
  try {
    const payload = AuthService.verifyToken(pinTok.trim()) as JWTPayload;
    if (
      payload.role !== "staff" ||
      !payload.merchantId ||
      payload.merchantId !== merchantId
    ) {
      return null;
    }
    const staffId = String(payload.staffId || payload.id || "").trim();
    if (!staffId) return null;
    return {
      staffId,
      roleName: String(payload.roleName || "Staff"),
      permissions: (payload.permissions || []) as Permission[],
    };
  } catch {
    return null;
  }
}

/**
 * Panel location switcher: JWT may allow HQ, but an active restricted floor PIN must lock scope.
 * Mirrors dashboard getEffectivePanelAccess + effectiveCanSwitchPanelLocation.
 */
export function resolvePanelLocationSwitch(req: Request, ctx: {
  merchantId: string;
  authRole?: string | null;
  roleName?: string | null;
  isOwner?: boolean;
  jwtPermissions?: Permission[];
}): { canSwitchPanelLocation: boolean; boundStaffId: string | null } {
  const jwtCan = canSwitchPanelLocation({
    authRole: ctx.authRole,
    roleName: ctx.roleName,
    isOwner: ctx.isOwner,
  });

  const pin = readPinStaffContext(req, ctx.merchantId);
  if (!pin) {
    const staffId = String(req.user?.staffId || req.user?.id || "").trim();
    return {
      canSwitchPanelLocation: jwtCan,
      boundStaffId: jwtCan ? null : staffId || null,
    };
  }

  const pinCanSwitchRole = canSwitchPanelLocation({
    authRole: "staff",
    roleName: pin.roleName,
    isOwner: false,
  });
  const pinHasPanel = hasPermission(pin.permissions, "ACCESS_PANEL", false);
  const jwtManager =
    !!ctx.isOwner ||
    (ctx.authRole === "merchant" && ctx.isOwner !== false) ||
    hasPermission(ctx.jwtPermissions || [], "ACCESS_PANEL", false);

  if (jwtCan && jwtManager && pinHasPanel && pinCanSwitchRole) {
    return { canSwitchPanelLocation: true, boundStaffId: null };
  }

  if (!jwtCan) {
    return { canSwitchPanelLocation: false, boundStaffId: pin.staffId };
  }

  return {
    canSwitchPanelLocation: pinCanSwitchRole && pinHasPanel,
    boundStaffId: pinCanSwitchRole && pinHasPanel ? null : pin.staffId,
  };
}
