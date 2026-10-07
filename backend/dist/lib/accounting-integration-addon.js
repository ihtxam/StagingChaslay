"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isBexioAddonEnabled = isBexioAddonEnabled;
exports.isOdooAddonEnabled = isOdooAddonEnabled;
exports.readBexioAddonEnabled = readBexioAddonEnabled;
exports.readOdooAddonEnabled = readOdooAddonEnabled;
exports.writeBexioAddonEnabled = writeBexioAddonEnabled;
exports.writeOdooAddonEnabled = writeOdooAddonEnabled;
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
function isBexioAddonEnabled(value) {
    return isAddonFlag(value);
}
function isOdooAddonEnabled(value) {
    return isAddonFlag(value);
}
async function readBexioAddonEnabled(merchantId) {
    await (0, ensure_merchant_schema_1.ensureBexioAddonColumn)();
    const db = (0, db_1.getDb)();
    const result = await db.execute((0, drizzle_orm_1.sql) `SELECT bexio_addon_enabled FROM merchants WHERE id = ${merchantId} LIMIT 1`);
    const row = firstRow(result);
    if (!row)
        throw new Error("Merchant not found");
    return isBexioAddonEnabled(row.bexio_addon_enabled ?? row.bexioAddonEnabled);
}
async function readOdooAddonEnabled(merchantId) {
    await (0, ensure_merchant_schema_1.ensureOdooAddonColumn)();
    const db = (0, db_1.getDb)();
    const result = await db.execute((0, drizzle_orm_1.sql) `SELECT odoo_addon_enabled FROM merchants WHERE id = ${merchantId} LIMIT 1`);
    const row = firstRow(result);
    if (!row)
        throw new Error("Merchant not found");
    return isOdooAddonEnabled(row.odoo_addon_enabled ?? row.odooAddonEnabled);
}
async function writeBexioAddonEnabled(merchantId, enabled) {
    await (0, ensure_merchant_schema_1.ensureBexioAddonColumn)();
    const db = (0, db_1.getDb)();
    const on = isBexioAddonEnabled(enabled);
    await db.execute((0, drizzle_orm_1.sql) `UPDATE merchants SET bexio_addon_enabled = ${on}, updated_at = NOW() WHERE id = ${merchantId}`);
    return readBexioAddonEnabled(merchantId);
}
async function writeOdooAddonEnabled(merchantId, enabled) {
    await (0, ensure_merchant_schema_1.ensureOdooAddonColumn)();
    const db = (0, db_1.getDb)();
    const on = isOdooAddonEnabled(enabled);
    await db.execute((0, drizzle_orm_1.sql) `UPDATE merchants SET odoo_addon_enabled = ${on}, updated_at = NOW() WHERE id = ${merchantId}`);
    return readOdooAddonEnabled(merchantId);
}
//# sourceMappingURL=accounting-integration-addon.js.map