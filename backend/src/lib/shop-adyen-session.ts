/**
 * Adyen Checkout /sessions options for online shop (e-commerce), not POS.
 * When multiple stores share one Adyen company, omitting `store` can surface
 * duplicate TWINT entries routed to different store accounts.
 */

export type ShopAdyenSessionMerchant = {
  adyenStoreReference?: string | null;
};

export function applyWebCheckoutSessionOptions(
  payload: Record<string, unknown>,
  merchant?: ShopAdyenSessionMerchant | null
): Record<string, unknown> {
  payload.shopperInteraction = "Ecommerce";

  const store = String(merchant?.adyenStoreReference || "").trim();
  if (store) {
    payload.store = store;
    payload.storeFiltrationMode = "exclusive";
  }

  return payload;
}
