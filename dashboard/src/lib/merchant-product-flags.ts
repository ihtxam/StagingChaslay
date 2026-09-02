import {
  ALL_EDITION_FEATURES,
  type EditionFeatureKey,
  hasEditionFeature,
} from './edition-features';

/** Edition keys that imply a full POS (till / WebPOS) subscription. */
export const POS_EDITION_FEATURES: EditionFeatureKey[] = ALL_EDITION_FEATURES.filter((k) =>
  k.startsWith('pos_')
);

export type MerchantProductFlagsInput = {
  shopEnabled?: boolean | null;
  editionFeatures?: EditionFeatureKey[] | null;
  /** Merchant or plan POS station limit; >0 implies POS entitlement. */
  maxPosPosts?: number | null;
  /** Optional merchant toggle; defaults true for shop-only merchants. */
  orderCenterEnabled?: boolean | null;
};

/**
 * True when the merchant has POS capabilities (edition pos_* features or POS station limit).
 * Legacy merchants (editionFeatures null) are treated as full POS.
 */
export function merchantHasPos(input: MerchantProductFlagsInput): boolean {
  const maxPos = Math.max(0, Number(input.maxPosPosts) || 0);
  if (maxPos > 0) return true;

  const features = input.editionFeatures;
  if (features == null) return true;

  return POS_EDITION_FEATURES.some((key) => hasEditionFeature(features, key));
}

/**
 * Order Center is for shop-only merchants (online / kiosk / QR orders without a till).
 * Full POS customers use WebPOS + /merchant/orders instead.
 */
export function showOrderCenterForMerchant(input: MerchantProductFlagsInput): boolean {
  if (!input.shopEnabled) return false;
  if (merchantHasPos(input)) return false;
  if (input.orderCenterEnabled === false) return false;
  return true;
}

/**
 * Delivery hub (dispatch screen) is normally used by POS merchants with delivery edition.
 * Shop-only merchants may also use it on a big screen (TV/monitor) or a small Sunmi PDA
 * with built-in printer — we do not hide it from POS users.
 */
export function showDeliveryHubForMerchant(input: {
  editionFeatures?: EditionFeatureKey[] | null;
  deliveryEnabled?: boolean | null;
}): boolean {
  if (input.deliveryEnabled === false) return false;
  return hasEditionFeature(input.editionFeatures ?? null, 'channel_delivery');
}
