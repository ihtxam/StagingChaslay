import type { Request } from "express";
import { AuthService, type JWTPayload } from "@/services/auth.service";
import { hasPermission, type Permission } from "@/lib/permissions";

export type ReportActor = {
  kind: "owner" | "staff" | "pin";
  staffId: string | null;
  staffName: string | null;
  permissions: Permission[];
};

/**
 * Resolve who is viewing reports.
 * Prefer X-WebPos-Staff-Access (PIN session JWT) over merchant-owner JWT so floor
 * staff cannot load company totals while the till stays logged in as owner.
 */
export function resolveReportActor(req: Request): ReportActor {
  const merchantId = req.merchantId || req.user?.merchantId;
  const pinHeader = req.headers["x-webpos-staff-access"];
  const pinTok = Array.isArray(pinHeader) ? pinHeader[0] : pinHeader;
  if (pinTok && typeof pinTok === "string" && pinTok.trim()) {
    try {
      const payload = AuthService.verifyToken(pinTok.trim()) as JWTPayload;
      if (
        payload.role === "staff" &&
        payload.merchantId &&
        merchantId &&
        payload.merchantId === merchantId
      ) {
        return {
          kind: "pin",
          staffId: payload.staffId || payload.id || null,
          staffName: payload.name || null,
          permissions: (payload.permissions || []) as Permission[],
        };
      }
    } catch {
      /* ignore invalid pin token */
    }
  }

  if (req.user?.role === "staff") {
    return {
      kind: "staff",
      staffId: req.user.staffId || req.user.id || null,
      staffName: req.user.name || null,
      permissions: (req.user.permissions || []) as Permission[],
    };
  }

  // Merchant owner (or no PIN): full company access.
  return {
    kind: "owner",
    staffId: null,
    staffName: null,
    permissions: [],
  };
}

export function canViewAllSales(actor: ReportActor): boolean {
  if (actor.kind === "owner") return true;
  return hasPermission(actor.permissions, "VIEW_ALL_SALES");
}

/** Scope filters for PosReportsService (null = company-wide). */
export function salesScopeForActor(actor: ReportActor): {
  staffId?: string | null;
  staffName?: string | null;
  viewAll: boolean;
} {
  if (canViewAllSales(actor)) {
    return { viewAll: true, staffId: null, staffName: null };
  }
  return {
    viewAll: false,
    staffId: actor.staffId,
    staffName: actor.staffName,
  };
}
