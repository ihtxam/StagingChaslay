/** Simple in-memory rate limit for anonymous shop order POSTs. */
export declare function checkShopOrderRateLimit(key: string): {
    ok: boolean;
    retryAfterSec?: number;
};
//# sourceMappingURL=shop-rate-limit.d.ts.map