/** True when a stored/sent product name can be shown (rejects null/"null"/empty). */
export declare function isUsableProductName(value: unknown): boolean;
/**
 * Pick the first usable display name from snapshot / aliases / linked product.
 * Falls back to "Item" when nothing valid is available.
 */
export declare function resolveOrderItemName(...candidates: unknown[]): string;
//# sourceMappingURL=order-item-name.d.ts.map