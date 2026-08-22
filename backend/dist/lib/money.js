"use strict";
/**
 * Swiss cash rounding to 0.05 (5 Rappen / 5 centimes).
 * Intermediate amounts use 0.01; payable totals use 0.05.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.roundMoney2 = roundMoney2;
exports.roundTo005 = roundTo005;
exports.roundingAdjustment = roundingAdjustment;
exports.splitEqual005 = splitEqual005;
function roundMoney2(amount) {
    if (!Number.isFinite(amount))
        return 0;
    return Math.round((amount + Number.EPSILON) * 100) / 100;
}
/** Round to nearest 0.05 CHF. */
function roundTo005(amount) {
    if (!Number.isFinite(amount))
        return 0;
    return Math.round((amount + Number.EPSILON) * 20) / 20;
}
/** Difference applied to reach 0.05 total (can be negative). */
function roundingAdjustment(rawTotal) {
    return roundMoney2(roundTo005(rawTotal) - rawTotal);
}
/** Split a 0.05-rounded total into N parts that each land on 0.05. */
function splitEqual005(total, parts) {
    const n = Math.max(1, Math.floor(parts));
    const units = Math.round(roundTo005(total) * 20);
    const base = Math.floor(units / n);
    const rem = units - base * n;
    return Array.from({ length: n }, (_, i) => (base + (i < rem ? 1 : 0)) / 20);
}
//# sourceMappingURL=money.js.map