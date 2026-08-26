"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRetailModule = exports.requireRestaurantModule = void 0;
exports.getMerchantBusinessModule = getMerchantBusinessModule;
exports.requireBusinessModule = requireBusinessModule;
const db_1 = require("@/db");
const drizzle_orm_1 = require("drizzle-orm");
const business_module_1 = require("@/lib/business-module");
const moduleCache = new Map();
const CACHE_MS = 60000;
async function getMerchantBusinessModule(merchantId) {
    const hit = moduleCache.get(merchantId);
    if (hit && Date.now() - hit.at < CACHE_MS)
        return hit.module;
    const db = (0, db_1.getDb)();
    const row = await db.query.merchants.findFirst({
        where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
        columns: { businessCategory: true },
    });
    const module = (0, business_module_1.normalizeBusinessModule)(row?.businessCategory);
    moduleCache.set(merchantId, { module, at: Date.now() });
    return module;
}
/** null module = legacy merchant — allow all vertical features. */
function requireBusinessModule(...modules) {
    return async (req, res, next) => {
        try {
            const merchantId = req.merchantId || req.user?.merchantId;
            if (!merchantId) {
                return res.status(400).json({ error: "Merchant ID is required" });
            }
            const module = await getMerchantBusinessModule(merchantId);
            if (!module)
                return next();
            if (modules.includes(module))
                return next();
            return res.status(403).json({
                error: "This feature is not available for your business type",
                businessModule: module,
                requiredModules: modules,
            });
        }
        catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : "Business module check failed",
            });
        }
    };
}
exports.requireRestaurantModule = requireBusinessModule("restaurant");
exports.requireRetailModule = requireBusinessModule("retail");
//# sourceMappingURL=business-module.middleware.js.map