/**
 * Adyen Checkout /sessions options for online shop (e-commerce), not POS.
 * When multiple stores share one Adyen company, omitting `store` can surface
 * duplicate TWINT entries routed to different store accounts.
 * Adyen support: shopperInteraction Ecommerce + blockedPaymentMethods twint_pos.
 */

export const TWINT_POS_PAYMENT_METHOD = "twint_pos";

/** Wallet / APM types that Adyen will not tokenize like CardOnFile scheme cards. */
const NON_STORABLE_ADYEN_TYPES = new Set([
  "twint",
  "twint_pos",
  "paypal",
  "klarna",
  "klarna_paynow",
  "klarna_account",
  "alipay",
  "wechatpay",
]);

const STORED_CARD_TYPES = new Set([
  "scheme",
  "card",
  "bcmc",
  "visa",
  "mc",
  "amex",
  "maestro",
  "diners",
  "discover",
  "jcb",
]);

function adyenMethodType(raw: unknown): string {
  if (raw == null) return "";
  if (typeof raw === "string") return raw.trim().toLowerCase();
  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    return String(o.type || o.brand || o.paymentMethod || "").trim().toLowerCase();
  }
  return String(raw).trim().toLowerCase();
}

/** True when Adyen can store this method as a shop CardOnFile (scheme), not TWINT/wallets. */
export function isAdyenStoredCardType(raw: unknown): boolean {
  const type = adyenMethodType(raw);
  if (!type || NON_STORABLE_ADYEN_TYPES.has(type) || type.includes("twint")) return false;
  return STORED_CARD_TYPES.has(type) || type.startsWith("scheme");
}

export function filterStoredShopCards<T extends { type?: string | null; brand?: string | null }>(
  methods: T[] | null | undefined
): T[] {
  return (methods || []).filter((m) => isAdyenStoredCardType(m));
}

/** Map an Adyen result/webhook method to a shop tender label key (twint, card, …). */
export function normalizeAdyenEcommerceTender(raw: unknown): string {
  const type = adyenMethodType(raw);
  if (!type) return "card";
  if (type.includes("twint")) return "twint";
  if (type.includes("paypal")) return "paypal";
  if (type.includes("klarna")) return "klarna";
  if (isAdyenStoredCardType(type)) return "card";
  return type.replace(/[^a-z0-9_]+/g, "_") || "card";
}

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
    // Inclusive keeps account-level cards/TWINT if the store has no e-com methods.
    // Exclusive with a missing/wrong store returns an empty method list and Drop-in fails.
    payload.storeFiltrationMode = "inclusive";
  }

  return payload;
}

/**
 * Tokenize cards for a logged-in shop account. Guests must not get this —
 * Adyen stores the method against shopperReference for later Ecommerce checkouts.
 * TWINT typically cannot be stored like cards; blocking twint_pos is separate.
 */
export type StoredPaymentMode = "askForConsent" | "shopperOnly";

export function applyStoredPaymentOptions(
  payload: Record<string, unknown>,
  shopper?: ShopAdyenShopper | null,
  mode: StoredPaymentMode = "askForConsent"
): Record<string, unknown> {
  const reference = String(shopper?.shopperReference || "").trim();
  if (reference.length < 3) return payload;

  payload.shopperReference = reference;
  // Ask to save the card. Do not send recurringProcessingModel / storePaymentMethodMode=enabled
  // on /sessions — Swisspayout accounts without Recurring make Drop-in paymentMethods fail.
  if (mode === "askForConsent") {
    payload.storePaymentMethodMode = "askForConsent";
  }

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

export type ShopCheckoutSessionAttempt = {
  payload: Record<string, unknown>;
  stored: boolean;
};

/**
 * /sessions attempts for logged-in shoppers.
 * Keep shopperReference until every stored variant fails — falling back to a guest
 * session first hides Adyen's "store card" checkbox and never tokenizes the card.
 */
export function buildShopCheckoutSessionAttempts(
  basePayload: Record<string, unknown>,
  shopper?: ShopAdyenShopper | null
): ShopCheckoutSessionAttempt[] {
  const attempts: ShopCheckoutSessionAttempt[] = [];
  const seen = new Set<string>();
  const push = (payload: Record<string, unknown>, stored: boolean) => {
    const key = JSON.stringify(payload);
    if (seen.has(key)) return;
    seen.add(key);
    attempts.push({ payload, stored });
  };

  const variants = (base: Record<string, unknown>) => {
    if (shopper?.shopperReference) {
      push(applyStoredPaymentOptions({ ...base }, shopper, "askForConsent"), true);
      push(applyStoredPaymentOptions({ ...base }, shopper, "shopperOnly"), true);
    }
    push({ ...base }, false);
  };

  variants(basePayload);
  if (basePayload.store) {
    const noStore = { ...basePayload };
    delete noStore.store;
    delete noStore.storeFiltrationMode;
    variants(noStore);
  }
  return attempts;
}
