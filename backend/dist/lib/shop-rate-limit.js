"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkShopOrderRateLimit = checkShopOrderRateLimit;
const buckets = new Map();
const WINDOW_MS = 60000;
const MAX_PER_WINDOW = 30;
/** Simple in-memory rate limit for anonymous shop order POSTs. */
function checkShopOrderRateLimit(key) {
    const now = Date.now();
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
        return { ok: true };
    }
    if (bucket.count >= MAX_PER_WINDOW) {
        return { ok: false, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) };
    }
    bucket.count += 1;
    return { ok: true };
}
//# sourceMappingURL=shop-rate-limit.js.map