"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isJustEatAddonEnabled = isJustEatAddonEnabled;
exports.isUberEatsAddonEnabled = isUberEatsAddonEnabled;
exports.readJustEatAddonEnabled = readJustEatAddonEnabled;
exports.readUberEatsAddonEnabled = readUberEatsAddonEnabled;
exports.writeJustEatAddonEnabled = writeJustEatAddonEnabled;
exports.writeUberEatsAddonEnabled = writeUberEatsAddonEnabled;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const ensure_merchant_schema_1 = require("@/lib/ensure-merchant-schema");
function isAddonFlag(value) {
    return value === true || value === 1 || value === "1" || value === "true" || value === "t";
}
function firstRow(result) {
    if (!result)
        return undefined;
    if (Array.isArray(result))
        return result[0];
    const r = result;
    if (Array.isArray(r.rows))
        return r.rows[0];
    return undefined;
}
function isJustEatAddonEnabled(value) {
    return isAddonFlag(value);
}
function isUberEatsAddonEnabled(value) {
    return isAddonFlag(value);
}
async function readJustEatAddonEnabled(merchantId) {
    await (0, ensure_merchant_schema_1.ensureJustEatAddonColumn)();
    const db = (0, db_1.getDb)();
    const result = await db.execute((0, drizzle_orm_1.sql) `SELECT just_eat_addon_enabled FROM merchants WHERE id = ${merchantId} LIMIT 1`);
    const row = firstRow(result);
    if (!row)
        throw new Error("Merchant not found");
    return isJustEatAddonEnabled(row.just_eat_addon_enabled ?? row.justEatAddonEnabled);
}
async function readUberEatsAddonEnabled(merchantId) {
    await (0, ensure_merchant_schema_1.ensureUberEatsAddonColumn)();
    const db = (0, db_1.getDb)();
    const result = await db.execute((0, drizzle_orm_1.sql) `SELECT uber_eats_addon_enabled FROM merchants WHERE id = ${merchantId} LIMIT 1`);
    const row = firstRow(result);
    if (!row)
        throw new Error("Merchant not found");
    return isUberEatsAddonEnabled(row.uber_eats_addon_enabled ?? row.uberEatsAddonEnabled);
}
async function writeJustEatAddonEnabled(merchantId, enabled) {
    await (0, ensure_merchant_schema_1.ensureJustEatAddonColumn)();
    const db = (0, db_1.getDb)();
    const on = isJustEatAddonEnabled(enabled);
    await db.execute((0, drizzle_orm_1.sql) `UPDATE merchants SET just_eat_addon_enabled = ${on}, updated_at = NOW() WHERE id = ${merchantId}`);
    return readJustEatAddonEnabled(merchantId);
}
async function writeUberEatsAddonEnabled(merchantId, enabled) {
    await (0, ensure_merchant_schema_1.ensureUberEatsAddonColumn)();
    const db = (0, db_1.getDb)();
    const on = isUberEatsAddonEnabled(enabled);
    await db.execute((0, drizzle_orm_1.sql) `UPDATE merchants SET uber_eats_addon_enabled = ${on}, updated_at = NOW() WHERE id = ${merchantId}`);
    return readUberEatsAddonEnabled(merchantId);
}
//# sourceMappingURL=delivery-platform-addon.js.map