"use strict";
/**
 * Adyen Checkout /sessions options for online shop (e-commerce), not POS.
 * When multiple stores share one Adyen company, omitting `store` can surface
 * duplicate TWINT entries routed to different store accounts.
 * Adyen support: shopperInteraction Ecommerce + blockedPaymentMethods twint_pos.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TWINT_POS_PAYMENT_METHOD = void 0;
exports.isAdyenStoredCardType = isAdyenStoredCardType;
exports.filterStoredShopCards = filterStoredShopCards;
exports.normalizeAdyenEcommerceTender = normalizeAdyenEcommerceTender;
exports.shopAdyenShopperReference = shopAdyenShopperReference;
exports.applyWebCheckoutSessionOptions = applyWebCheckoutSessionOptions;
exports.applyStoredPaymentOptions = applyStoredPaymentOptions;
exports.buildShopCheckoutSessionAttempts = buildShopCheckoutSessionAttempts;
exports.TWINT_POS_PAYMENT_METHOD = "twint_pos";
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
function adyenMethodType(raw) {
    if (raw == null)
        return "";
    if (typeof raw === "string")
        return raw.trim().toLowerCase();
    if (typeof raw === "object") {
        const o = raw;
        return String(o.type || o.brand || o.paymentMethod || "").trim().toLowerCase();
    }
    return String(raw).trim().toLowerCase();
}
/** True when Adyen can store this method as a shop CardOnFile (scheme), not TWINT/wallets. */
function isAdyenStoredCardType(raw) {
    const type = adyenMethodType(raw);
    if (!type || NON_STORABLE_ADYEN_TYPES.has(type) || type.includes("twint"))
        return false;
    return STORED_CARD_TYPES.has(type) || type.startsWith("scheme");
}
function filterStoredShopCards(methods) {
    return (methods || []).filter((m) => isAdyenStoredCardType(m));
}
/** Map an Adyen result/webhook method to a shop tender label key (twint, card, …). */
function normalizeAdyenEcommerceTender(raw) {
    const type = adyenMethodType(raw);
    if (!type)
        return "card";
    if (type.includes("twint"))
        return "twint";
    if (type.includes("paypal"))
        return "paypal";
    if (type.includes("klarna"))
        return "klarna";
    if (isAdyenStoredCardType(type))
        return "card";
    return type.replace(/[^a-z0-9_]+/g, "_") || "card";
}
/** Stable, non-PII Adyen shopperReference scoped to merchant + customer. */
function shopAdyenShopperReference(merchantId, customerId) {
    const merchant = String(merchantId || "").trim();
    const customer = String(customerId || "").trim();
    return `shop_${merchant}_${customer}`.slice(0, 256);
}
function applyWebCheckoutSessionOptions(payload, merchant) {
    payload.shopperInteraction = "Ecommerce";
    const blocked = Array.isArray(payload.blockedPaymentMethods)
        ? payload.blockedPaymentMethods.map((v) => String(v))
        : [];
    if (!blocked.includes(exports.TWINT_POS_PAYMENT_METHOD)) {
        blocked.push(exports.TWINT_POS_PAYMENT_METHOD);
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
function applyStoredPaymentOptions(payload, shopper, mode = "askForConsent") {
    const reference = String(shopper?.shopperReference || "").trim();
    if (reference.length < 3)
        return payload;
    payload.shopperReference = reference;
    // Ask to save the card. Do not send recurringProcessingModel / storePaymentMethodMode=enabled
    // on /sessions — Swisspayout accounts without Recurring make Drop-in paymentMethods fail.
    if (mode === "askForConsent") {
        payload.storePaymentMethodMode = "askForConsent";
    }
    const email = String(shopper?.shopperEmail || "").trim().toLowerCase();
    if (email.includes("@"))
        payload.shopperEmail = email;
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
/**
 * /sessions attempts for logged-in shoppers.
 * Keep shopperReference until every stored variant fails — falling back to a guest
 * session first hides Adyen's "store card" checkbox and never tokenizes the card.
 */
function buildShopCheckoutSessionAttempts(basePayload, shopper) {
    const attempts = [];
    const seen = new Set();
    const push = (payload, stored) => {
        const key = JSON.stringify(payload);
        if (seen.has(key))
            return;
        seen.add(key);
        attempts.push({ payload, stored });
    };
    const variants = (base) => {
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
//# sourceMappingURL=shop-adyen-session.js.map