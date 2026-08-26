import type { merchants } from "@/db/schema";
type MerchantSlug = Pick<typeof merchants.$inferSelect, "slug" | "subdomain" | "customDomain">;
/** Guest tracking URL (no login) for shop order confirmation page. */
export declare function buildGuestOrderTrackingUrl(merchant: MerchantSlug, orderId: string, token: string): string;
export declare function generateDeliveryTrackingToken(): string;
/** QR on delivery slip — driver scans to claim the order. */
export declare function buildDriverClaimUrl(orderId: string, token: string): string;
export {};
//# sourceMappingURL=delivery-tracking-url.d.ts.map