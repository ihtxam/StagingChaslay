/**
 * Adyen Checkout /sessions options for online shop (e-commerce), not POS.
 * When multiple stores share one Adyen company, omitting `store` can surface
 * duplicate TWINT entries routed to different store accounts.
 * Adyen support: shopperInteraction Ecommerce + blockedPaymentMethods twint_pos.
 */
export declare const TWINT_POS_PAYMENT_METHOD = "twint_pos";
/** True when Adyen can store this method as a shop CardOnFile (scheme), not TWINT/wallets. */
export declare function isAdyenStoredCardType(raw: unknown): boolean;
export declare function filterStoredShopCards<T extends {
    type?: string | null;
    brand?: string | null;
}>(methods: T[] | null | undefined): T[];
/** Map an Adyen result/webhook method to a shop tender label key (twint, card, …). */
export declare function normalizeAdyenEcommerceTender(raw: unknown): string;
export type ShopAdyenSessionMerchant = {
    adyenStoreReference?: string | null;
};
/** Logged-in shop customer fields for tokenized / one-click payments. */
export type ShopAdyenShopper = {
    shopperReference: string;
    shopperEmail?: string | null;
    shopperName?: {
        firstName?: string | null;
        lastName?: string | null;
    } | null;
};
/** Stable, non-PII Adyen shopperReference scoped to merchant + customer. */
export declare function shopAdyenShopperReference(merchantId: string, customerId: string): string;
export declare function applyWebCheckoutSessionOptions(payload: Record<string, unknown>, merchant?: ShopAdyenSessionMerchant | null): Record<string, unknown>;
/**
 * Tokenize cards for a logged-in shop account. Guests must not get this —
 * Adyen stores the method against shopperReference for later Ecommerce checkouts.
 * TWINT typically cannot be stored like cards; blocking twint_pos is separate.
 */
export type StoredPaymentMode = "askForConsent" | "shopperOnly";
export declare function applyStoredPaymentOptions(payload: Record<string, unknown>, shopper?: ShopAdyenShopper | null, mode?: StoredPaymentMode): Record<string, unknown>;
export type ShopCheckoutSessionAttempt = {
    payload: Record<string, unknown>;
    stored: boolean;
};
/**
 * /sessions attempts for logged-in shoppers.
 * Keep shopperReference until every stored variant fails — falling back to a guest
 * session first hides Adyen's "store card" checkbox and never tokenizes the card.
 */
export declare function buildShopCheckoutSessionAttempts(basePayload: Record<string, unknown>, shopper?: ShopAdyenShopper | null): ShopCheckoutSessionAttempt[];
//# sourceMappingURL=shop-adyen-session.d.ts.map