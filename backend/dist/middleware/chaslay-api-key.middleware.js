"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireChaslayApiKey = requireChaslayApiKey;
exports.resolveChaslayMerchantBySlug = resolveChaslayMerchantBySlug;
const db_1 = require("@/db");
const drizzle_orm_1 = require("drizzle-orm");
/**
 * Resolve merchant from Chaslay Android POS `X-Api-Key` header.
 * Falls back to global API_KEY env mapped to default merchant slug.
 */
async function requireChaslayApiKey(req, res, next) {
    try {
        const apiKey = String(req.header("X-Api-Key") || req.header("x-api-key") || "").trim();
        if (!apiKey) {
            return res.status(401).json({ error: "Missing X-Api-Key" });
        }
        const db = (0, db_1.getDb)();
        let merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.syncApiKey, apiKey),
        });
        if (!merchant && process.env.API_KEY && apiKey === process.env.API_KEY) {
            const defaultSlug = process.env.DEFAULT_TENANT_SLUG || process.env.DEFAULT_MERCHANT_SLUG || "demo";
            merchant =
                (await db.query.merchants.findFirst({
                    where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.slug, defaultSlug),
                })) ||
                    (await db.query.merchants.findFirst());
        }
        if (!merchant) {
            return res.status(401).json({ error: "Invalid API key" });
        }
        req.chaslayMerchantId = merchant.id;
        req.chaslayMerchant = merchant;
        next();
    }
    catch (error) {
        console.error("Chaslay API key auth failed:", error);
        res.status(500).json({ error: "Auth failed" });
    }
}
async function resolveChaslayMerchantBySlug(slug) {
    const db = (0, db_1.getDb)();
    if (slug) {
        const m = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.slug, slug),
        });
        if (m)
            return m;
    }
    const defaultSlug = process.env.DEFAULT_TENANT_SLUG || process.env.DEFAULT_MERCHANT_SLUG;
    if (defaultSlug) {
        const m = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.slug, defaultSlug),
        });
        if (m)
            return m;
    }
    return db.query.merchants.findFirst();
}
//# sourceMappingURL=chaslay-api-key.middleware.js.map