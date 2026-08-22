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
const express_1 = require("express");
const auth_middleware_1 = require("@/middleware/auth.middleware");
const sync_service_1 = require("@/services/sync.service");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.verifyToken);
router.use(auth_middleware_1.requireMerchant);
router.use(auth_middleware_1.setMerchantContext);
/**
 * GET /api/sync/pull?since=ISO
 * Pull catalog + terminals for offline POS.
 */
router.get("/pull", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const since = req.query.since ? new Date(String(req.query.since)) : undefined;
        const data = await sync_service_1.SyncService.pullCatalog(merchantId, since);
        res.json({ success: true, ...data });
    }
    catch (error) {
        console.error("Sync pull failed:", error);
        res.status(500).json({ error: error instanceof Error ? error.message : "Sync pull failed" });
    }
});
/**
 * POST /api/sync/push-catalog
 * Push offline-created categories/products.
 */
router.post("/push-catalog", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const maps = await sync_service_1.SyncService.pushCatalog(merchantId, req.body || {});
        res.json({ success: true, ...maps });
    }
    catch (error) {
        console.error("Sync push-catalog failed:", error);
        res.status(400).json({ error: error instanceof Error ? error.message : "Sync push failed" });
    }
});
/**
 * POST /api/sync/push-sales
 * Push offline sales/orders (idempotent by clientId).
 */
router.post("/push-sales", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const { WebPosEntitlementService } = await Promise.resolve().then(() => __importStar(require("@/services/webpos-entitlement.service")));
        if (!(await WebPosEntitlementService.guard(merchantId, res)))
            return;
        const sales = Array.isArray(req.body?.sales) ? req.body.sales : [];
        const result = await sync_service_1.SyncService.pushSales(merchantId, sales);
        res.json({ success: true, ...result });
    }
    catch (error) {
        console.error("Sync push-sales failed:", error);
        res.status(400).json({ error: error instanceof Error ? error.message : "Sync sales failed" });
    }
});
exports.default = router;
//# sourceMappingURL=sync.routes.js.map