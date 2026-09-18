import type { merchants } from "@/db/schema";
import { isValidAdyenClientKey, shopAdyenCardReady } from "@/lib/adyen-checkout-env";
export type MerchantShopUrl = Pick<typeof merchants.$inferSelect, "slug" | "subdomain" | "customDomain">;
/** Public shop base URL (custom domain → subdomain → shop hub /{slug}). */
export declare function shopPublicBaseUrl(merchant: MerchantShopUrl): string;
export declare function shopPublicOrigin(merchant: MerchantShopUrl): string;
export declare function parseOriginCandidate(raw: string | null | undefined): string | null;
export declare function isAllowedShopOrigin(origin: string, merchant: MerchantShopUrl): boolean;
export declare function resolveShopCheckoutOrigin(merchant: MerchantShopUrl, ...candidates: Array<string | null | undefined>): string;
/** Client-provided shopBasePath (`''`, `/{slug}`, `/shop/{slug}`, plus optional `/l/{loc}`). */
export declare function sanitizeShopPathPrefix(raw: string | null | undefined, merchant: MerchantShopUrl): string | null;
export declare function shopPathPrefixForOrigin(merchant: MerchantShopUrl, origin: string): string;
export declare function buildShopPaymentReturnUrl(opts: {
    merchant: MerchantShopUrl;
    suffix: string;
    origin?: string | null;
    shopPath?: string | null;
    extraCandidates?: Array<string | null | undefined>;
}): string;
export declare function shopOrderPaymentReturnUrl(merchant: MerchantShopUrl, orderId: string, opts?: {
    origin?: string | null;
    shopPath?: string | null;
    extraCandidates?: Array<string | null | undefined>;
    query?: Record<string, string>;
}): string;
export declare function shopGiftCardPaymentReturnUrl(merchant: MerchantShopUrl, purchaseId: string, opts?: {
    origin?: string | null;
    shopPath?: string | null;
    extraCandidates?: Array<string | null | undefined>;
}): string;
export declare function shopTablePaymentReturnUrl(merchant: MerchantShopUrl, tableId: string, opts?: {
    origin?: string | null;
    shopPath?: string | null;
    sessionToken?: string | null;
    extraCandidates?: Array<string | null | undefined>;
}): string;
export { isValidAdyenClientKey, shopAdyenCardReady };
//# sourceMappingURL=shop-public-url.d.ts.map