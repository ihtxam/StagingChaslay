import { type AccountingExportOpts } from "./accounting-export.service";
import type { ReportPreset } from "./pos-reports.service";
export declare function parseAccountingReportPreset(raw: unknown): ReportPreset;
export declare class AccountingSyncService {
    static testBexioConnection(merchantId: string): Promise<{
        ok: true;
    }>;
    static testOdooConnection(merchantId: string): Promise<{
        ok: true;
    }>;
    static pushPeriodToBexio(merchantId: string, opts: AccountingExportOpts): Promise<{
        ok: true;
        skipped: boolean;
        reference: string;
        lineCount: number;
        pushed?: undefined;
    } | {
        ok: true;
        reference: string;
        pushed: boolean;
        lineCount: number;
        skipped?: undefined;
    }>;
    static pushPeriodToOdoo(merchantId: string, opts: AccountingExportOpts): Promise<{
        ok: true;
        skipped: boolean;
        reference: string;
        lineCount: number;
        pushed?: undefined;
    } | {
        ok: true;
        reference: string;
        pushed: boolean;
        lineCount: number;
        skipped?: undefined;
    }>;
    static recordPushError(merchantId: string, platform: "bexio" | "odoo", message: string): Promise<void>;
}
//# sourceMappingURL=accounting-sync.service.d.ts.map