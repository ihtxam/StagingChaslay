export declare function bexioOAuthConfigured(): boolean;
export declare function bexioOAuthRedirectUri(): string;
export declare function merchantDashboardAccountingUrl(query?: Record<string, string>): string;
export declare function signBexioOAuthState(payload: {
    merchantId: string;
    exp: number;
    nonce: string;
}): string;
export declare function verifyBexioOAuthState(state: string): {
    merchantId: string;
} | null;
export declare function buildBexioAuthorizeUrl(merchantId: string): string;
export declare function exchangeBexioOAuthCode(code: string): Promise<Record<string, unknown>>;
export declare function refreshBexioOAuthToken(refreshToken: string): Promise<Record<string, unknown>>;
export declare function storeBexioOAuthTokens(merchantId: string, tokenData: Record<string, unknown>): Promise<void>;
export declare function clearBexioOAuthTokens(merchantId: string): Promise<void>;
/** PAT takes precedence when set; otherwise OAuth access token with refresh. */
export declare function getBexioAccessToken(merchantId: string): Promise<string>;
//# sourceMappingURL=bexio-oauth.d.ts.map