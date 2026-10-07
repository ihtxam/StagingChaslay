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
exports.isGrowthSkuAddonEnabled = isGrowthSkuAddonEnabled;
exports.createGrowthSkuAddon = createGrowthSkuAddon;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
function isGrowthSkuAddonEnabled(value) {
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
function createGrowthSkuAddon(config) {
    const { columnSnake, columnCamel, ensureColumn } = config;
    function flagFromRow(row) {
        if (!row)
            return false;
        return isGrowthSkuAddonEnabled(row[columnSnake] ?? row[columnCamel]);
    }
    async function readEnabled(merchantId) {
        await ensureColumn();
        const db = (0, db_1.getDb)();
        const result = await db.execute((0, drizzle_orm_1.sql) `SELECT ${drizzle_orm_1.sql.raw(columnSnake)} FROM merchants WHERE id = ${merchantId} LIMIT 1`);
        const row = firstRow(result);
        if (!row)
            throw new Error("Merchant not found");
        return flagFromRow(row);
    }
    async function writeEnabled(merchantId, enabled) {
        await ensureColumn();
        const db = (0, db_1.getDb)();
        const on = isGrowthSkuAddonEnabled(enabled);
        await db.execute((0, drizzle_orm_1.sql) `UPDATE merchants SET ${drizzle_orm_1.sql.raw(columnSnake)} = ${on}, updated_at = NOW() WHERE id = ${merchantId}`);
        try {
            const { EditionEntitlementsService } = await Promise.resolve().then(() => __importStar(require("@/services/edition-entitlements.service")));
            EditionEntitlementsService.invalidate(merchantId);
        }
        catch {
            /* optional cache */
        }
        return readEnabled(merchantId);
    }
    return {
        readEnabled,
        writeEnabled,
        merchantHasLicense: readEnabled,
    };
}
//# sourceMappingURL=growth-sku-addon-lib.js.map