"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const drizzle_orm_1 = require("drizzle-orm");
const auth_middleware_1 = require("@/middleware/auth.middleware");
const db_1 = require("@/db");
const merchant_settings_service_1 = require("@/services/merchant-settings.service");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.verifyToken);
router.use(auth_middleware_1.requireMerchant);
router.use(auth_middleware_1.setMerchantContext);
function maskSecret(value) {
    if (!value)
        return null;
    if (value.length <= 8)
        return "••••••••";
    return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}
function sanitizeTerminal(t) {
    return {
        ...t,
        adyenApiKey: undefined,
        adyenApiKeyMasked: maskSecret(t.adyenApiKey),
        adyenApiKeySet: !!t.adyenApiKey,
    };
}
/**
 * GET /api/terminals
 * Includes merchant-level Adyen credentials summary.
 */
router.get("/", async (req, res) => {
    try {
        const db = (0, db_1.getDb)();
        const terminals = await db.query.paymentTerminals.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.paymentTerminals.merchantId, req.merchantId),
        });
        const settings = await merchant_settings_service_1.MerchantSettingsService.getMerchantSettings(req.merchantId);
        res.json({
            success: true,
            terminals: terminals.map(sanitizeTerminal),
            adyen: {
                merchantAccount: settings.adyenMerchantAccount,
                apiKeyMasked: settings.adyenApiKeyMasked,
                apiKeySet: settings.adyenApiKeySet,
                clientId: settings.adyenClientId,
            },
        });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list terminals" });
    }
});
/**
 * PUT /api/terminals/adyen-credentials
 * Store merchant-level Adyen merchant account, API key, and client ID.
 */
router.put("/adyen-credentials", async (req, res) => {
    try {
        const { adyenMerchantAccount, adyenApiKey, adyenClientId } = req.body;
        const settings = await merchant_settings_service_1.MerchantSettingsService.updateMerchantSettings(req.merchantId, {
            adyenMerchantAccount,
            adyenApiKey,
            adyenClientId,
        });
        res.json({
            success: true,
            adyen: {
                merchantAccount: settings.adyenMerchantAccount,
                apiKeyMasked: settings.adyenApiKeyMasked,
                apiKeySet: settings.adyenApiKeySet,
                clientId: settings.adyenClientId,
            },
        });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to save Adyen credentials" });
    }
});
/**
 * POST /api/terminals
 * Register a payment terminal. Uses merchant-level Adyen credentials from Settings.
 * Only terminal ID is required (display name optional).
 */
router.post("/", async (req, res) => {
    try {
        const terminalId = String(req.body.terminalId || req.body.serialNumber || "").trim();
        const terminalName = String(req.body.terminalName || terminalId || "").trim();
        const serialNumber = String(req.body.serialNumber || terminalId || "").trim() || null;
        if (!terminalId) {
            return res.status(400).json({ error: "terminalId is required" });
        }
        const db = (0, db_1.getDb)();
        const [terminal] = await db
            .insert(db_1.schema.paymentTerminals)
            .values({
            merchantId: req.merchantId,
            terminalId,
            terminalName: terminalName || terminalId,
            serialNumber,
            // Always inherit Adyen account/API from merchant settings
            adyenMerchantAccount: null,
            adyenApiKey: null,
            adyenClientId: null,
            status: "active",
        })
            .onConflictDoUpdate({
            target: db_1.schema.paymentTerminals.terminalId,
            set: {
                terminalName: terminalName || terminalId,
                serialNumber,
                status: "active",
                lastHeartbeat: new Date(),
            },
        })
            .returning();
        res.status(201).json({ success: true, terminal: sanitizeTerminal(terminal) });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to register terminal" });
    }
});
/**
 * PUT /api/terminals/:id
 */
router.put("/:id", async (req, res) => {
    try {
        const db = (0, db_1.getDb)();
        const patch = {};
        if (req.body.terminalId !== undefined)
            patch.terminalId = String(req.body.terminalId).trim();
        if (req.body.terminalName !== undefined)
            patch.terminalName = req.body.terminalName;
        if (req.body.serialNumber !== undefined)
            patch.serialNumber = req.body.serialNumber;
        if (req.body.status !== undefined)
            patch.status = req.body.status;
        // Do not accept per-terminal Adyen credential overrides
        const [terminal] = await db
            .update(db_1.schema.paymentTerminals)
            .set(patch)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.paymentTerminals.id, req.params.id), (0, drizzle_orm_1.eq)(db_1.schema.paymentTerminals.merchantId, req.merchantId)))
            .returning();
        if (!terminal)
            return res.status(404).json({ error: "Terminal not found" });
        res.json({ success: true, terminal: sanitizeTerminal(terminal) });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update terminal" });
    }
});
/**
 * DELETE /api/terminals/:id
 */
router.delete("/:id", async (req, res) => {
    try {
        const db = (0, db_1.getDb)();
        await db
            .delete(db_1.schema.paymentTerminals)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.paymentTerminals.id, req.params.id), (0, drizzle_orm_1.eq)(db_1.schema.paymentTerminals.merchantId, req.merchantId)));
        res.json({ success: true });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to delete terminal" });
    }
});
exports.default = router;
//# sourceMappingURL=terminals.routes.js.map