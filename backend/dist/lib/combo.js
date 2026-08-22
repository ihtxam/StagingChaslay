"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSlotShaped = isSlotShaped;
exports.normalizeComboSlots = normalizeComboSlots;
exports.sanitizeComboSlotsInput = sanitizeComboSlotsInput;
const uuid_1 = require("uuid");
function isSlotShaped(row) {
    return Array.isArray(row?.options) || (!!row?.name && !row?.productId);
}
/** Normalize legacy fixed items and new slots into a single slot list. */
function normalizeComboSlots(raw) {
    if (!Array.isArray(raw) || !raw.length)
        return [];
    return raw
        .map((row, idx) => {
        if (!row || typeof row !== "object")
            return null;
        // New slot shape
        if (Array.isArray(row.options)) {
            const options = row.options
                .filter((o) => o?.productId)
                .map((o) => ({
                productId: String(o.productId),
                extraPrice: Math.max(0, Number(o.extraPrice) || 0),
            }));
            if (!options.length)
                return null;
            const minPick = Math.max(0, Number(row.minPick) || 1);
            const maxPick = Math.max(minPick, Number(row.maxPick) || 1);
            return {
                id: String(row.id || `slot-${idx + 1}`),
                name: String(row.name || `Choice ${idx + 1}`).trim() || `Choice ${idx + 1}`,
                minPick,
                maxPick,
                options,
            };
        }
        // Legacy: fixed product component → single-option required slot
        if (row.productId) {
            const qty = Math.max(1, Number(row.quantity) || 1);
            const options = Array.from({ length: qty }, () => ({
                productId: String(row.productId),
                extraPrice: 0,
            }));
            // Represent as one pick of that product (qty>1 rare); keep one option
            return {
                id: String(row.id || `legacy-${row.productId}-${idx}`),
                name: String(row.name || `Item ${idx + 1}`).trim() || `Item ${idx + 1}`,
                minPick: 1,
                maxPick: 1,
                options: [{ productId: String(row.productId), extraPrice: 0 }],
            };
        }
        return null;
    })
        .filter(Boolean);
}
/** Sanitize combo slots from merchant API before save. */
function sanitizeComboSlotsInput(raw) {
    const slots = normalizeComboSlots(raw);
    return slots.map((s) => ({
        id: s.id || (0, uuid_1.v4)(),
        name: s.name,
        minPick: s.minPick,
        maxPick: s.maxPick,
        options: s.options.map((o) => ({
            productId: o.productId,
            extraPrice: o.extraPrice,
        })),
    }));
}
//# sourceMappingURL=combo.js.map