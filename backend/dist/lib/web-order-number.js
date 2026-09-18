"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.merchantWebOrderCode = merchantWebOrderCode;
exports.formatWebOrderNumberDisplay = formatWebOrderNumberDisplay;
exports.generateWebOrderNumber = generateWebOrderNumber;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const vacation_1 = require("@/lib/vacation");
const SHORT_WEB_RE = /^WEB-(\d{1,6})$/;
const SCOPED_WEB_RE = /^WEB-([A-Z0-9]{4})-(\d{1,6})$/;
const LEGACY_WEB_RE = /^WEB-(\d{10,})(?:-([A-F0-9]{4,8}))?$/i;
/** Stable 4-char merchant code for globally unique WEB order numbers. */
function merchantWebOrderCode(merchantId) {
    const compact = String(merchantId || "")
        .replace(/[^a-zA-Z0-9]/g, "")
        .toUpperCase();
    if (compact.length >= 4)
        return compact.slice(-4);
    return compact.padStart(4, "0");
}
/** Display-friendly web order number — keeps scoped WEB-CODE-SEQ; shortens legacy timestamps. */
function formatWebOrderNumberDisplay(orderNumber) {
    const n = String(orderNumber || "").trim();
    if (!n)
        return n;
    if (SHORT_WEB_RE.test(n))
        return n;
    if (SCOPED_WEB_RE.test(n))
        return n;
    const legacy = n.match(LEGACY_WEB_RE);
    if (legacy) {
        if (legacy[2])
            return `WEB-${legacy[2]}`;
        return `WEB-${legacy[1].slice(-8)}`;
    }
    return n;
}
function parseShortWebSeq(orderNumber) {
    const scoped = orderNumber.match(SCOPED_WEB_RE);
    if (scoped) {
        const seq = parseInt(scoped[2], 10);
        return Number.isFinite(seq) ? seq : null;
    }
    const m = orderNumber.match(SHORT_WEB_RE);
    if (!m)
        return null;
    const seq = parseInt(m[1], 10);
    return Number.isFinite(seq) ? seq : null;
}
function scopedWebOrderNumber(merchantId, seq) {
    return `WEB-${merchantWebOrderCode(merchantId)}-${seq}`;
}
/** Next short WEB-xxxx number for a merchant (daily sequence, Europe/Zurich). */
async function generateWebOrderNumber(db, merchantId) {
    const { start, end } = (0, vacation_1.zurichDayBounds)((0, vacation_1.ymdZurich)());
    const merchantCode = merchantWebOrderCode(merchantId);
    const rows = await db
        .select({ orderNumber: db_1.schema.orders.orderNumber })
        .from(db_1.schema.orders)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId), (0, drizzle_orm_1.inArray)(db_1.schema.orders.orderType, ["web_shop", "online"]), (0, drizzle_orm_1.gte)(db_1.schema.orders.createdAt, start), (0, drizzle_orm_1.lte)(db_1.schema.orders.createdAt, end)));
    let maxSeq = 0;
    for (const row of rows) {
        const seq = parseShortWebSeq(row.orderNumber);
        if (seq != null)
            maxSeq = Math.max(maxSeq, seq);
    }
    for (let attempt = 0; attempt < 12; attempt++) {
        const seq = maxSeq + 1 + attempt;
        const candidate = scopedWebOrderNumber(merchantId, seq);
        const exists = await db.query.orders.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.orders.orderNumber, candidate),
        });
        if (!exists)
            return candidate;
    }
    const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `WEB-${merchantCode}-${maxSeq + 1}${rand}`;
}
//# sourceMappingURL=web-order-number.js.map