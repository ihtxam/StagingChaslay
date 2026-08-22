export type TableQrCodeType = "static" | "temporary";
export type TableQrCodeRow = {
    id: string;
    tableId: string;
    codeType: TableQrCodeType;
    code: string;
    expiresAt: Date | null;
    createdAt: Date;
};
export declare class TableQrService {
    static listForMerchant(merchantId: string): Promise<TableQrCodeRow[]>;
    static listForTable(merchantId: string, tableId: string): Promise<TableQrCodeRow[]>;
    /** Prefer static override; fall back to first active temporary. */
    static resolvePayload(merchantId: string, tableId: string, defaultPayload: string): Promise<string>;
    static upsertStatic(merchantId: string, tableId: string, code: string): Promise<{
        id: string;
        createdAt: Date;
        merchantId: string;
        expiresAt: Date | null;
        tableId: string;
        codeType: string;
        code: string;
    }>;
    static createTemporary(merchantId: string, tableId: string, code: string, expiresInHours?: number): Promise<{
        id: string;
        createdAt: Date;
        merchantId: string;
        expiresAt: Date | null;
        tableId: string;
        codeType: string;
        code: string;
    }>;
    static generateTemporaryToken(): string;
    static deleteCode(merchantId: string, codeId: string): Promise<{
        success: boolean;
    }>;
}
//# sourceMappingURL=table-qr.service.d.ts.map