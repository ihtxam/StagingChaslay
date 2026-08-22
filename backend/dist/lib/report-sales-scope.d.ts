import type { Request } from "express";
import { type Permission } from "@/lib/permissions";
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
export declare function resolveReportActor(req: Request): ReportActor;
export declare function canViewAllSales(actor: ReportActor): boolean;
/** Scope filters for PosReportsService (null = company-wide). */
export declare function salesScopeForActor(actor: ReportActor): {
    staffId?: string | null;
    staffName?: string | null;
    viewAll: boolean;
};
//# sourceMappingURL=report-sales-scope.d.ts.map