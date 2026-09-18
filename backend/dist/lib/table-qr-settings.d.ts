/** Table QR stand download defaults (merchant dashboard). */
export type TableQrLayoutTemplate = "vertical" | "horizontal" | "curved";
export type TableQrSettings = {
    headerText?: string;
    subtitleText?: string;
    layoutTemplate?: TableQrLayoutTemplate;
    /** Auto-accept QR table orders (skip pending_approval). */
    qrAutoApprove?: boolean;
    /** Allow pay-at-table from customer phone. */
    qrPayAtTableEnabled?: boolean;
};
export declare const DEFAULT_TABLE_QR_SETTINGS: Required<TableQrSettings>;
export declare function normalizeTableQrSettings(raw: unknown): TableQrSettings;
//# sourceMappingURL=table-qr-settings.d.ts.map