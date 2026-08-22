"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatWebOrderNumberDisplay = formatWebOrderNumberDisplay;
exports.generateWebOrderNumber = generateWebOrderNumber;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const vacation_1 = require("@/lib/vacation");
const SHORT_WEB_RE = /^WEB-(\d{1,6})$/;
const LEGACY_WEB_RE = /^WEB-(\d{10,})(?:-([A-F0-9]{4,8}))?$/i;
/** Display-friendly web order number — shortens legacy WEB-{timestamp}-{suffix} values. */
function formatWebOrderNumberDisplay(orderNumber) {
    const n = String(orderNumber || "").trim();
    if (!n)
        return n;
    if (SHORT_WEB_RE.test(n))
        return n;
    const legacy = n.match(LEGACY_WEB_RE);
    if (legacy) {
        if (legacy[2])
            return `WEB-${legacy[2]}`;
        return `WEB-${legacy[1].slice(-4)}`;
    }
    return n;
}
function parseShortWebSeq(orderNumber) {
    const m = orderNumber.match(SHORT_WEB_RE);
    if (!m)
        return null;
    const seq = parseInt(m[1], 10);
    return Number.isFinite(seq) ? seq : null;
}
/** Next short WEB-xxxx number for a merchant (daily sequence, Europe/Zurich). */
async function generateWebOrderNumber(db, merchantId) {
    const { start, end } = (0, vacation_1.zurichDayBounds)((0, vacation_1.ymdZurich)());
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
    for (let attempt = 0; attempt < 10; attempt++) {
        const seq = maxSeq + 1 + attempt;
        const candidate = `WEB-${seq}`;
        const exists = await db.query.orders.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.orders.orderNumber, candidate),
        });
        if (!exists)
            return candidate;
    }
    const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `WEB-${maxSeq + 1}${rand}`;
}
//# sourceMappingURL=web-order-number.js.map