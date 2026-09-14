export type DeliveryMode = "zones" | "zipcode";
export type DeliveryMatch = {
    id: string;
    name: string;
    minOrderAmount: string | number | null;
    deliveryFee: string | number | null;
    freeDeliveryMinOrder?: string | number | null;
    estimatedMinutes: number | null;
};
export declare function normalizeDeliveryMode(value: unknown): DeliveryMode;
export declare function normalizeZipCode(value: unknown): string;
/** Apply free-delivery threshold when subtotal is high enough. */
export declare function computeEffectiveDeliveryFee(rule: Pick<DeliveryMatch, "deliveryFee" | "freeDeliveryMinOrder">, subtotal: number): number;
export declare function findMatchingDeliveryRule(merchantId: string, modeInput: unknown, lng?: number, lat?: number, zip?: string): Promise<DeliveryMatch | null>;
//# sourceMappingURL=delivery-match.d.ts.map