"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeCdsLiveState = normalizeCdsLiveState;
exports.setCdsLiveState = setCdsLiveState;
exports.getCdsLiveState = getCdsLiveState;
exports.sweepExpiredCdsLiveState = sweepExpiredCdsLiveState;
const IDLE_TTL_MS = 10 * 60 * 1000;
const ACTIVE_TTL_MS = 15 * 60 * 1000;
const THANKYOU_TTL_MS = 3 * 60 * 1000;
const store = new Map();
function ttlForPhase(phase) {
    if (phase === "thankyou")
        return THANKYOU_TTL_MS;
    if (phase === "idle")
        return IDLE_TTL_MS;
    return ACTIVE_TTL_MS;
}
function isLivePhase(value) {
    return value === "idle" || value === "building" || value === "payment" || value === "thankyou";
}
function isLiveLocale(value) {
    return value === "en" || value === "fr" || value === "de";
}
function normalizeCdsLiveState(raw) {
    if (!raw || typeof raw !== "object")
        return null;
    const src = raw;
    const phase = isLivePhase(src.phase) ? src.phase : null;
    if (!phase)
        return null;
    const linesRaw = Array.isArray(src.lines) ? src.lines : [];
    const lines = [];
    for (const line of linesRaw) {
        if (!line || typeof line !== "object")
            continue;
        const row = line;
        const name = String(row.name || "").trim();
        const qty = Number(row.qty);
        const lineTotal = Number(row.lineTotal);
        if (!name || !Number.isFinite(qty) || !Number.isFinite(lineTotal))
            continue;
        const modifiers = String(row.modifiers || "").trim();
        lines.push({
            name,
            qty,
            lineTotal,
            modifiers: modifiers || undefined,
        });
    }
    const subtotal = Number(src.subtotal);
    const discount = Number(src.discount);
    const tax = Number(src.tax);
    const total = Number(src.total);
    const updatedAt = Number(src.updatedAt);
    const receiptUrl = String(src.receiptUrl || "").trim();
    const merchantName = String(src.merchantName || "").trim();
    const currency = String(src.currency || "CHF").trim() || "CHF";
    const locale = isLiveLocale(src.locale) ? src.locale : undefined;
    return {
        merchantName: merchantName || undefined,
        currency,
        lines,
        subtotal: Number.isFinite(subtotal) ? subtotal : 0,
        discount: Number.isFinite(discount) ? discount : 0,
        tax: Number.isFinite(tax) ? tax : 0,
        total: Number.isFinite(total) ? total : 0,
        phase,
        receiptUrl: receiptUrl || undefined,
        locale,
        updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now(),
    };
}
function setCdsLiveState(accessToken, merchantId, state) {
    const token = String(accessToken || "").trim();
    if (!token || !merchantId)
        return;
    const ttl = ttlForPhase(state.phase);
    store.set(token, {
        state,
        merchantId,
        expiresAt: Date.now() + ttl,
    });
}
function getCdsLiveState(accessToken) {
    const token = String(accessToken || "").trim();
    if (!token)
        return null;
    const row = store.get(token);
    if (!row)
        return null;
    if (Date.now() > row.expiresAt) {
        store.delete(token);
        return null;
    }
    return row.state;
}
function sweepExpiredCdsLiveState() {
    const now = Date.now();
    for (const [key, row] of store.entries()) {
        if (now > row.expiresAt)
            store.delete(key);
    }
}
//# sourceMappingURL=cds-live-state.js.map