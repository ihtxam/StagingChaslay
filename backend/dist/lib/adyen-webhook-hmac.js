"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdyenNotificationDataToSign = getAdyenNotificationDataToSign;
exports.calculateAdyenNotificationHmac = calculateAdyenNotificationHmac;
exports.adyenNotificationHasHmacSignature = adyenNotificationHasHmacSignature;
exports.verifyAdyenNotificationHmac = verifyAdyenNotificationHmac;
const crypto_1 = require("crypto");
const HMAC_SIGNATURE_KEY = "hmacSignature";
function secureCompare(expected, received) {
    if (!received)
        return false;
    const expectedBuffer = Buffer.from(expected, "base64");
    const receivedBuffer = Buffer.from(received, "base64");
    return (expectedBuffer.length === receivedBuffer.length &&
        (0, crypto_1.timingSafeEqual)(expectedBuffer, receivedBuffer));
}
/** Build the colon-separated payload Adyen signs for payment notifications. */
function getAdyenNotificationDataToSign(item) {
    return [
        item.pspReference ?? "",
        item.originalReference ?? "",
        item.merchantAccountCode ?? "",
        item.merchantReference ?? "",
        item.amount?.value ?? "",
        item.amount?.currency ?? "",
        item.eventCode ?? "",
        String(item.success ?? ""),
    ].join(":");
}
/** Compute expected HMAC (base64) for a Standard notification item. Key is hex from Customer Area. */
function calculateAdyenNotificationHmac(item, hmacKeyHex) {
    const data = getAdyenNotificationDataToSign(item);
    return (0, crypto_1.createHmac)("sha256", Buffer.from(hmacKeyHex, "hex"))
        .update(data, "utf8")
        .digest("base64");
}
function isValidHmacKeyHex(hmacKeyHex) {
    const key = hmacKeyHex.trim();
    return key.length > 0 && key.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(key);
}
/** Whether Adyen sent an HMAC signature on this notification item. */
function adyenNotificationHasHmacSignature(item) {
    return Boolean(item.additionalData?.[HMAC_SIGNATURE_KEY]);
}
/**
 * Verify HMAC when configured. Matches swisspayoutpartner behaviour:
 * - unsigned + no merchant key → accept
 * - signed + no merchant key → reject
 * - invalid hex key → reject
 */
function verifyAdyenNotificationHmac(item, hmacKeyHex) {
    const received = item.additionalData?.[HMAC_SIGNATURE_KEY];
    const key = (hmacKeyHex || "").trim();
    if (!key || key === "your-hmac-key-here") {
        return !received;
    }
    if (!received)
        return false;
    if (!isValidHmacKeyHex(key))
        return false;
    const expected = calculateAdyenNotificationHmac(item, key);
    return secureCompare(expected, received);
}
//# sourceMappingURL=adyen-webhook-hmac.js.map