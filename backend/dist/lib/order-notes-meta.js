"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripPosCheckoutMetaFromNotes = stripPosCheckoutMetaFromNotes;
/**
 * POS checkout metadata stored in order.notes (tendered/change/tip, etc.).
 * Stripped when order totals are adjusted so detail views stay consistent.
 */
function stripPosCheckoutMetaFromNotes(notes) {
    const text = String(notes || "")
        .replace(/\bTendered\s+CHF\s+[\d.]+\b/gi, "")
        .replace(/\bChange\s+CHF\s+[\d.]+\b/gi, "")
        .replace(/\bRounding\s+[+-]?[\d.]+\b/gi, "")
        .replace(/\bTip\s+CHF\s+[\d.]+\b/gi, "")
        .replace(/\bPoints\s+[−\-]CHF\s+[\d.]+\s*\([^)]*\)/gi, "")
        .replace(/\bPickup\/delivery:\s*[^\n·]+/gi, "")
        .replace(/\s{2,}/g, " ")
        .replace(/^[·\s]+|[·\s]+$/g, "")
        .trim();
    return text || null;
}
//# sourceMappingURL=order-notes-meta.js.map