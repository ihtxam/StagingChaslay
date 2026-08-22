"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isUsableProductName = isUsableProductName;
exports.resolveOrderItemName = resolveOrderItemName;
/** True when a stored/sent product name can be shown (rejects null/"null"/empty). */
function isUsableProductName(value) {
    if (value == null)
        return false;
    const s = String(value).trim();
    if (!s)
        return false;
    const lower = s.toLowerCase();
    return lower !== "null" && lower !== "undefined";
}
/**
 * Pick the first usable display name from snapshot / aliases / linked product.
 * Falls back to "Item" when nothing valid is available.
 */
function resolveOrderItemName(...candidates) {
    for (const value of candidates) {
        if (!isUsableProductName(value))
            continue;
        return String(value).trim().slice(0, 255);
    }
    return "Item";
}
//# sourceMappingURL=order-item-name.js.map