"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeDeliveryMode = normalizeDeliveryMode;
exports.normalizeZipCode = normalizeZipCode;
exports.computeEffectiveDeliveryFee = computeEffectiveDeliveryFee;
exports.findMatchingDeliveryRule = findMatchingDeliveryRule;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const geo_1 = require("@/lib/geo");
function normalizeDeliveryMode(value) {
    const mode = String(value || "")
        .trim()
        .toLowerCase();
    return mode === "zipcode" ? "zipcode" : "zones";
}
function normalizeZipCode(value) {
    return String(value || "")
        .trim()
        .replace(/\s+/g, "");
}
function matchesZipRule(zip, rule) {
    const normalized = normalizeZipCode(zip).toLowerCase();
    if (!normalized)
        return false;
    const exact = normalizeZipCode(rule.zipCode || "").toLowerCase();
    return !!exact && exact === normalized;
}
/** Apply free-delivery threshold when subtotal is high enough. */
function computeEffectiveDeliveryFee(rule, subtotal) {
    const baseFee = parseFloat(String(rule.deliveryFee ?? 0)) || 0;
    const freeThreshold = parseFloat(String(rule.freeDeliveryMinOrder ?? 0)) || 0;
    if (freeThreshold > 0 && subtotal >= freeThreshold)
        return 0;
    return baseFee;
}
async function findMatchingZoneRule(merchantId, lng, lat, zip) {
    const db = (0, db_1.getDb)();
    const zones = await db.query.deliveryZones.findMany({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.deliveryZones.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.deliveryZones.isActive, true)),
        orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.deliveryZones.sortOrder)],
    });
    if (lng != null && lat != null && Number.isFinite(lng) && Number.isFinite(lat)) {
        const hit = zones.find((z) => (0, geo_1.pointInPolygon)(lng, lat, (z.polygon || [])));
        if (hit)
            return hit;
    }
    if (zip) {
        const normalized = normalizeZipCode(zip).toLowerCase();
        const hit = zones.find((z) => (z.zipCodes || []).some((c) => normalizeZipCode(c).toLowerCase() === normalized));
        if (hit)
            return hit;
    }
    return null;
}
async function findMatchingZipRule(merchantId, zip) {
    if (!zip)
        return null;
    const db = (0, db_1.getDb)();
    const rules = await db.query.deliveryZipRules.findMany({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.deliveryZipRules.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.deliveryZipRules.isActive, true)),
        orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.deliveryZipRules.sortOrder)],
    });
    return rules.find((rule) => matchesZipRule(zip, rule)) || null;
}
async function findMatchingDeliveryRule(merchantId, modeInput, lng, lat, zip) {
    const mode = normalizeDeliveryMode(modeInput);
    if (mode === "zipcode") {
        return findMatchingZipRule(merchantId, zip);
    }
    return findMatchingZoneRule(merchantId, lng, lat, zip);
}
//# sourceMappingURL=delivery-match.js.map