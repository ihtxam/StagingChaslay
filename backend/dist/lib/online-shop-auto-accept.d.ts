/** True when online shop auto-accept is enabled and the order falls within store hours. */
export declare function shouldAutoAcceptOnlineShopOrder(merchant: {
    storeHours?: unknown;
    deliveryPlatformSettings?: unknown;
}, order: {
    fulfillmentChannel?: string | null;
    scheduledFor?: Date | string | null;
}): boolean;
//# sourceMappingURL=online-shop-auto-accept.d.ts.map