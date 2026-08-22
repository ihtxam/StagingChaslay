"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.isInventoryAddonEnabled = isInventoryAddonEnabled;
exports.readInventoryAddonEnabled = readInventoryAddonEnabled;
exports.writeInventoryAddonEnabled = writeInventoryAddonEnabled;
exports.readInventoryAddonEnabledMap = readInventoryAddonEnabledMap;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const ensure_merchant_schema_1 = require("@/lib/ensure-merchant-schema");
/** Paid restaurant inventory + recipes addon (merchant-level, not edition-gated). */
function isInventoryAddonEnabled(value) {
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
function flagFromRow(row) {
    if (!row)
        return false;
    return isInventoryAddonEnabled(row.inventory_addon_enabled ?? row.inventoryAddonEnabled);
}
/** Read the paid-addon column via SQL so a stale Drizzle mapping cannot hide a true flag. */
async function readInventoryAddonEnabled(merchantId) {
    await (0, ensure_merchant_schema_1.ensureInventoryAddonColumn)();
    const db = (0, db_1.getDb)();
    const result = await db.execute((0, drizzle_orm_1.sql) `SELECT inventory_addon_enabled FROM merchants WHERE id = ${merchantId} LIMIT 1`);
    const row = firstRow(result);
    if (!row)
        throw new Error("Merchant not found");
    return flagFromRow(row);
}
/** Persist the paid-addon column via SQL (source of truth for Superadmin / reseller toggles). */
async function writeInventoryAddonEnabled(merchantId, enabled) {
    await (0, ensure_merchant_schema_1.ensureInventoryAddonColumn)();
    const db = (0, db_1.getDb)();
    const on = isInventoryAddonEnabled(enabled);
    await db.execute((0, drizzle_orm_1.sql) `UPDATE merchants SET inventory_addon_enabled = ${on}, updated_at = NOW() WHERE id = ${merchantId}`);
    try {
        const { EditionEntitlementsService } = await Promise.resolve().then(() => __importStar(require("@/services/edition-entitlements.service")));
        EditionEntitlementsService.invalidate(merchantId);
    }
    catch {
        /* cache module may not be loaded yet */
    }
    return readInventoryAddonEnabled(merchantId);
}
async function readInventoryAddonEnabledMap(merchantIds) {
    const out = new Map();
    if (merchantIds.length === 0)
        return out;
    await (0, ensure_merchant_schema_1.ensureInventoryAddonColumn)();
    const db = (0, db_1.getDb)();
    const result = await db.execute((0, drizzle_orm_1.sql) `SELECT id, inventory_addon_enabled FROM merchants WHERE id IN (${drizzle_orm_1.sql.join(merchantIds.map((id) => (0, drizzle_orm_1.sql) `${id}`), (0, drizzle_orm_1.sql) `, `)})`);
    const rows = Array.isArray(result)
        ? result
        : (result.rows ?? []);
    for (const raw of rows) {
        const row = raw;
        const id = String(row.id || "");
        if (id)
            out.set(id, flagFromRow(row));
    }
    return out;
}
//# sourceMappingURL=inventory-addon.js.map