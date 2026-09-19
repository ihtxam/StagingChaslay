/**
 * Adyen Checkout /sessions options for online shop (e-commerce), not POS.
 * When multiple stores share one Adyen company, omitting `store` can surface
 * duplicate TWINT entries routed to different store accounts.
 * Adyen support: shopperInteraction Ecommerce + blockedPaymentMethods twint_pos.
 */

export const TWINT_POS_PAYMENT_METHOD = "twint_pos";

export type ShopAdyenSessionMerchant = {
  adyenStoreReference?: string | null;
};

/** Logged-in shop customer fields for tokenized / one-click payments. */
export type ShopAdyenShopper = {
  shopperReference: string;
  shopperEmail?: string | null;
  shopperName?: {
    firstName?: string | null;
    lastName?: string | null;
  } | null;
};

/** Stable, non-PII Adyen shopperReference scoped to merchant + customer. */
export function shopAdyenShopperReference(merchantId: string, customerId: string): string {
  const merchant = String(merchantId || "").trim();
  const customer = String(customerId || "").trim();
  return `shop_${merchant}_${customer}`.slice(0, 256);
}

export function applyWebCheckoutSessionOptions(
  payload: Record<string, unknown>,
  merchant?: ShopAdyenSessionMerchant | null
): Record<string, unknown> {
  payload.shopperInteraction = "Ecommerce";

  const blocked = Array.isArray(payload.blockedPaymentMethods)
    ? (payload.blockedPaymentMethods as unknown[]).map((v) => String(v))
    : [];
  if (!blocked.includes(TWINT_POS_PAYMENT_METHOD)) {
    blocked.push(TWINT_POS_PAYMENT_METHOD);
  }
  payload.blockedPaymentMethods = blocked;

  const store = String(merchant?.adyenStoreReference || "").trim();
  if (store) {
    payload.store = store;
    payload.storeFiltrationMode = "exclusive";
  }

  return payload;
}

/**
 * Tokenize cards for a logged-in shop account. Guests must not get this —
 * Adyen stores the method against shopperReference for later Ecommerce checkouts.
 * TWINT typically cannot be stored like cards; blocking twint_pos is separate.
 */
export function applyStoredPaymentOptions(
  payload: Record<string, unknown>,
  shopper?: ShopAdyenShopper | null
): Record<string, unknown> {
  const reference = String(shopper?.shopperReference || "").trim();
  if (reference.length < 3) return payload;

  payload.shopperReference = reference;
  payload.storePaymentMethod = true;
  payload.storePaymentMethodMode = "enabled";
  payload.recurringProcessingModel = "CardOnFile";

  const email = String(shopper?.shopperEmail || "").trim().toLowerCase();
  if (email.includes("@")) payload.shopperEmail = email;

  const firstName = String(shopper?.shopperName?.firstName || "").trim();
  const lastName = String(shopper?.shopperName?.lastName || "").trim();
  if (firstName || lastName) {
    payload.shopperName = {
      ...(firstName ? { firstName } : {}),
      ...(lastName ? { lastName } : {}),
    };
  }

  return payload;
}
