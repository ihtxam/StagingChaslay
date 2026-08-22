"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveReportActor = resolveReportActor;
exports.canViewAllSales = canViewAllSales;
exports.salesScopeForActor = salesScopeForActor;
const auth_service_1 = require("@/services/auth.service");
const permissions_1 = require("@/lib/permissions");
/**
 * Resolve who is viewing reports.
 * Prefer X-WebPos-Staff-Access (PIN session JWT) over merchant-owner JWT so floor
 * staff cannot load company totals while the till stays logged in as owner.
 */
function resolveReportActor(req) {
    const merchantId = req.merchantId || req.user?.merchantId;
    const pinHeader = req.headers["x-webpos-staff-access"];
    const pinTok = Array.isArray(pinHeader) ? pinHeader[0] : pinHeader;
    if (pinTok && typeof pinTok === "string" && pinTok.trim()) {
        try {
            const payload = auth_service_1.AuthService.verifyToken(pinTok.trim());
            if (payload.role === "staff" &&
                payload.merchantId &&
                merchantId &&
                payload.merchantId === merchantId) {
                return {
                    kind: "pin",
                    staffId: payload.staffId || payload.id || null,
                    staffName: payload.name || null,
                    permissions: (payload.permissions || []),
                };
            }
        }
        catch {
            /* ignore invalid pin token */
        }
    }
    if (req.user?.role === "staff") {
        return {
            kind: "staff",
            staffId: req.user.staffId || req.user.id || null,
            staffName: req.user.name || null,
            permissions: (req.user.permissions || []),
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
function canViewAllSales(actor) {
    if (actor.kind === "owner")
        return true;
    return (0, permissions_1.hasPermission)(actor.permissions, "VIEW_ALL_SALES");
}
/** Scope filters for PosReportsService (null = company-wide). */
function salesScopeForActor(actor) {
    if (canViewAllSales(actor)) {
        return { viewAll: true, staffId: null, staffName: null };
    }
    return {
        viewAll: false,
        staffId: actor.staffId,
        staffName: actor.staffName,
    };
}
//# sourceMappingURL=report-sales-scope.js.map