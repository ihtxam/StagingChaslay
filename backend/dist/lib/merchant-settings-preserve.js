"use strict";
/**
 * Settings PATCH/PUT helpers: empty/undefined secrets and tax fields must not
 * clobber existing merchant values (password change, unrelated store push, etc.).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMaskedSecret = isMaskedSecret;
exports.shouldWriteCredential = shouldWriteCredential;
exports.incomingTaxRateOrPreserve = incomingTaxRateOrPreserve;
function isMaskedSecret(value) {
    return String(value || "").includes("••••");
}
/** True when the incoming value is a real secret the caller intends to write. */
function shouldWriteCredential(value) {
    if (value == null)
        return false;
    const s = String(value).trim();
    if (!s)
        return false;
    if (isMaskedSecret(s))
        return false;
    return true;
}
/**
 * Incoming tax rate for a PATCH. Returns undefined to preserve the existing DB
 * value (empty / omitted). Throws on out-of-range numbers.
 */
function incomingTaxRateOrPreserve(value, field) {
    if (value === undefined || value === null || value === "")
        return undefined;
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
        throw new Error(`${field} must be between 0 and 100`);
    }
    return n.toFixed(2);
}
//# sourceMappingURL=merchant-settings-preserve.js.map