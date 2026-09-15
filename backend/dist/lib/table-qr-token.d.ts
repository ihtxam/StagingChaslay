/** Signed table access token: base64url(payload).base64url(hmac) */
export declare function signTableAccess(merchantId: string, tableId: string, ttlSec?: number): string;
export declare function verifyTableAccess(merchantId: string, tableId: string, token: string | null | undefined): boolean;
//# sourceMappingURL=table-qr-token.d.ts.map