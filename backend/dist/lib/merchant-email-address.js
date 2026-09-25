"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.merchantSenderDisplayName = merchantSenderDisplayName;
exports.resolveMerchantContactEmail = resolveMerchantContactEmail;
exports.formatMailAddress = formatMailAddress;
/** Display name shown in From / Reply-To for merchant-facing mail. */
function merchantSenderDisplayName(merchantName) {
    const name = String(merchantName || "").trim();
    return name || "Shop";
}
/** Merchant inbox for customer replies — settings email first, then configured SMTP/Brevo from. */
function resolveMerchantContactEmail(input) {
    const primary = String(input.email || "").trim();
    if (primary)
        return primary;
    const smtpFrom = String(input.smtpSettings?.fromEmail || "").trim();
    if (smtpFrom)
        return smtpFrom;
    const brevoFrom = String(input.brevoSettings?.fromEmail || "").trim();
    if (brevoFrom)
        return brevoFrom;
    return null;
}
/** RFC-style mailbox for Reply-To / SMTP headers: `"Shop Name" <shop@example.com>`. */
function formatMailAddress(email, name) {
    const addr = String(email || "").trim();
    if (!addr)
        return "";
    const label = String(name || "").trim();
    if (!label)
        return addr;
    const escaped = label.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `"${escaped}" <${addr}>`;
}
//# sourceMappingURL=merchant-email-address.js.map