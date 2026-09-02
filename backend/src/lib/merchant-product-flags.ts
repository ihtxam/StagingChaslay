/**
 * Merchant product surface flags — keep in sync with dashboard/src/lib/merchant-product-flags.ts
 */
import {
  ALL_EDITION_FEATURES,
  type EditionFeatureKey,
  hasEditionFeature,
} from "@/lib/edition-features";

export const POS_EDITION_FEATURES: EditionFeatureKey[] = ALL_EDITION_FEATURES.filter((k) =>
  k.startsWith("pos_")
);

export type MerchantProductFlagsInput = {
  shopEnabled?: boolean | null;
  editionFeatures?: EditionFeatureKey[] | null;
  maxPosPosts?: number | null;
  orderCenterEnabled?: boolean | null;
};

export function merchantHasPos(input: MerchantProductFlagsInput): boolean {
  const maxPos = Math.max(0, Number(input.maxPosPosts) || 0);
  if (maxPos > 0) return true;

  const features = input.editionFeatures;
  if (features == null) return true;

  return POS_EDITION_FEATURES.some((key) => hasEditionFeature(features, key));
}

export function showOrderCenterForMerchant(input: MerchantProductFlagsInput): boolean {
  if (!input.shopEnabled) return false;
  if (merchantHasPos(input)) return false;
  if (input.orderCenterEnabled === false) return false;
  return true;
}

export function showDeliveryHubForMerchant(input: {
  editionFeatures?: EditionFeatureKey[] | null;
  deliveryEnabled?: boolean | null;
}): boolean {
  if (input.deliveryEnabled === false) return false;
  return hasEditionFeature(input.editionFeatures ?? null, "channel_delivery");
}

export function resolveMerchantProductFlags(input: MerchantProductFlagsInput & {
  deliveryEnabled?: boolean | null;
}) {
  const hasPos = merchantHasPos(input);
  return {
    hasPos,
    showOrderCenter: showOrderCenterForMerchant(input),
    showDeliveryHub: showDeliveryHubForMerchant(input),
  };
}
