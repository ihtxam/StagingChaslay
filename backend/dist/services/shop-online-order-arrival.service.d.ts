import { schema } from "@/db";
type Merchant = typeof schema.merchants.$inferSelect;
type Order = typeof schema.orders.$inferSelect;
/** Status after card payment is confirmed for an online shop order. */
export declare function resolvePaidOnlineShopOrderStatus(merchant: Merchant, order: Order): string;
/**
 * POS notification, kitchen ingress, guest emails — run when a paid online shop order
 * should appear in the merchant workflow (on create for cash, or after card confirm).
 */
export declare function runOnlineShopOrderArrivalSideEffects(merchant: Merchant, order: Order, opts?: {
    guestLocale?: string | null;
    /** Guest receipt on card confirm (pickup); create-time cash flow keeps this false. */
    printGuestReceipt?: boolean;
}): Promise<void>;
/**
 * After Adyen card payment: move order out of awaiting_payment and notify merchant workflow.
 * Idempotent when status is no longer awaiting_payment.
 */
export declare function finalizePaidOnlineShopCardOrder(merchant: Merchant, order: Order, opts?: {
    guestLocale?: string | null;
    pspReference?: string | null;
    /** Adyen method type from Drop-in / webhook (twint, scheme, …). Not CardOnFile. */
    adyenPaymentMethod?: unknown;
}): Promise<Order>;
export {};
//# sourceMappingURL=shop-online-order-arrival.service.d.ts.map