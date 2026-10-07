import type { FulfillmentChannel } from "@/services/merchant-settings.service";
export type MerchantChannelFlags = {
    pickupEnabled?: boolean | null;
    deliveryEnabled?: boolean | null;
    dineInEnabled?: boolean | null;
};
/** Merchant-level order channel toggles (pickup = takeaway / à emporter). */
export declare function isMerchantFulfillmentChannelEnabled(merchant: MerchantChannelFlags, channel: FulfillmentChannel): boolean;
//# sourceMappingURL=merchant-channels.d.ts.map