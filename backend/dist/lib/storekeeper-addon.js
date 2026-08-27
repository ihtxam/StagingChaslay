"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorekeeperLicenseError = void 0;
exports.isStorekeeperAddonEnabled = isStorekeeperAddonEnabled;
exports.readStorekeeperAddonEnabled = readStorekeeperAddonEnabled;
exports.writeStorekeeperAddonEnabled = writeStorekeeperAddonEnabled;
exports.assertStorekeeperLicensed = assertStorekeeperLicensed;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const ensure_merchant_schema_1 = require("@/lib/ensure-merchant-schema");
const inventory_addon_1 = require("@/lib/inventory-addon");
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
function isStorekeeperAddonEnabled(value) {
    return isAddonFlag(value);
}
class StorekeeperLicenseError extends Error {
    constructor(message = "Storekeeper addon is not enabled") {
        super(message);
        this.name = "StorekeeperLicenseError";
    }
}
exports.StorekeeperLicenseError = StorekeeperLicenseError;
/** Storekeeper mobile app — own addon, or bundled with full inventory addon. */
async function readStorekeeperAddonEnabled(merchantId) {
    await (0, ensure_merchant_schema_1.ensureStorekeeperAddonColumn)();
    await (0, ensure_merchant_schema_1.ensureInventoryAddonColumn)();
    const db = (0, db_1.getDb)();
    const result = await db.execute((0, drizzle_orm_1.sql) `SELECT storekeeper_addon_enabled, inventory_addon_enabled FROM merchants WHERE id = ${merchantId} LIMIT 1`);
    const row = firstRow(result);
    if (!row)
        throw new Error("Merchant not found");
    const storekeeper = isStorekeeperAddonEnabled(row.storekeeper_addon_enabled ?? row.storekeeperAddonEnabled);
    const inventory = (0, inventory_addon_1.isInventoryAddonEnabled)(row.inventory_addon_enabled ?? row.inventoryAddonEnabled);
    return storekeeper || inventory;
}
async function writeStorekeeperAddonEnabled(merchantId, enabled) {
    await (0, ensure_merchant_schema_1.ensureStorekeeperAddonColumn)();
    const db = (0, db_1.getDb)();
    const on = isStorekeeperAddonEnabled(enabled);
    await db.execute((0, drizzle_orm_1.sql) `UPDATE merchants SET storekeeper_addon_enabled = ${on}, updated_at = NOW() WHERE id = ${merchantId}`);
    return readStorekeeperAddonEnabled(merchantId);
}
async function assertStorekeeperLicensed(merchantId) {
    const on = await readStorekeeperAddonEnabled(merchantId);
    if (!on)
        throw new StorekeeperLicenseError();
}
//# sourceMappingURL=storekeeper-addon.js.map