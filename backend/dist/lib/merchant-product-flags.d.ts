/**
 * Merchant product surface flags — keep in sync with dashboard/src/lib/merchant-product-flags.ts
 */
import { type EditionFeatureKey } from "@/lib/edition-features";
export declare const POS_EDITION_FEATURES: EditionFeatureKey[];
export type MerchantProductFlagsInput = {
    shopEnabled?: boolean | null;
    editionFeatures?: EditionFeatureKey[] | null;
    maxPosPosts?: number | null;
    orderCenterEnabled?: boolean | null;
};
export declare function merchantHasPos(input: MerchantProductFlagsInput): boolean;
export declare function showOrderCenterForMerchant(input: MerchantProductFlagsInput): boolean;
export declare function showDeliveryHubForMerchant(input: {
    editionFeatures?: EditionFeatureKey[] | null;
    deliveryEnabled?: boolean | null;
}): boolean;
export declare function resolveMerchantProductFlags(input: MerchantProductFlagsInput & {
    deliveryEnabled?: boolean | null;
}): {
    hasPos: boolean;
    showOrderCenter: boolean;
    showDeliveryHub: boolean;
};
//# sourceMappingURL=merchant-product-flags.d.ts.map