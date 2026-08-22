"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const drizzle_orm_1 = require("drizzle-orm");
const zod_1 = require("zod");
const auth_middleware_1 = require("@/middleware/auth.middleware");
const db_1 = require("@/db");
const adyen_softpos_service_1 = require("@/services/adyen-softpos.service");
/**
 * Adyen Tap to Pay (SoftPOS) endpoints for the Android POS, mounted at
 * /api/tap-to-pay. Guarded by the merchant dashboard JWT (same token the app
 * stores at online login) and scoped to the caller's merchant.
 *
 * Re-implemented for FoodTruckPOS from the Laravel adyen-api reference; that
 * project is untouched.
 */
const router = (0, express_1.Router)();
router.use(auth_middleware_1.verifyToken);
router.use(auth_middleware_1.requireMerchant);
router.use(auth_middleware_1.setMerchantContext);
async function loadMerchant(merchantId) {
    const db = (0, db_1.getDb)();
    return db.query.merchants.findFirst({
        where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
    });
}
const sessionSchema = zod_1.z.object({
    setup_token: zod_1.z.string().min(1),
    platform: zod_1.z.enum(["ios", "android"]),
});
/**
 * POST /api/tap-to-pay/sessions
 * Exchange a Mobile-SDK setupToken for sdkData + installationId.
 */
router.post("/sessions", async (req, res) => {
    const parsed = sessionSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(422).json({ error: "Invalid request", details: parsed.error.flatten() });
    }
    const merchant = await loadMerchant(req.merchantId);
    if (!merchant) {
        return res.status(422).json({ error: "No merchant account." });
    }
    try {
        const session = await (0, adyen_softpos_service_1.createSoftPosSession)(merchant, parsed.data.setup_token);
        return res.json({
            sdk_data: session.sdkData,
            installation_id: session.installationId,
        });
    }
    catch (error) {
        return res.status(422).json({
            error: error instanceof Error ? error.message : "SoftPOS session failed.",
        });
    }
});
const saleSchema = zod_1.z.object({
    amount_minor: zod_1.z.number().int().min(1),
    currency: zod_1.z.string().length(3),
    reference: zod_1.z.string().max(80).optional(),
    platform: zod_1.z.enum(["ios", "android"]),
    installation_id: zod_1.z.string().max(128),
});
/**
 * POST /api/tap-to-pay/sale
 * Build (not submit) the nexo Terminal API envelope for the mobile SDK.
 */
router.post("/sale", async (req, res) => {
    const parsed = saleSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(422).json({ error: "Invalid request", details: parsed.error.flatten() });
    }
    const merchant = await loadMerchant(req.merchantId);
    if (!merchant) {
        return res.status(422).json({ error: "No merchant account." });
    }
    const { amount_minor, currency, reference, installation_id } = parsed.data;
    const built = (0, adyen_softpos_service_1.buildSaleRequest)(merchant, installation_id, amount_minor, currency.toUpperCase(), reference ?? "");
    return res.json({
        terminal_api_request: built.request,
        service_id: built.serviceId,
        transaction_id: built.transactionId,
    });
});
exports.default = router;
//# sourceMappingURL=tap-to-pay.routes.js.map