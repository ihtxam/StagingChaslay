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
const chaslay_api_key_middleware_1 = require("@/middleware/chaslay-api-key.middleware");
const chaslay_compat_service_1 = require("@/services/chaslay-compat.service");
const router = (0, express_1.Router)();
router.use(chaslay_api_key_middleware_1.requireChaslayApiKey);
router.get("/bootstrap", async (req, res) => {
    try {
        const data = await chaslay_compat_service_1.ChaslayCompatService.syncBootstrap(req.chaslayMerchantId);
        res.json(data);
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Bootstrap failed" });
    }
});
router.get("/menu", async (req, res) => {
    try {
        const since = Number(req.query.since || 0);
        const data = await chaslay_compat_service_1.ChaslayCompatService.syncMenuChanges(req.chaslayMerchantId, since);
        res.json(data);
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Menu sync failed" });
    }
});
/** Push local POS catalog → merchant panel (two-way menu sync). */
router.post("/push-catalog", async (req, res) => {
    try {
        const { SyncService } = await Promise.resolve().then(() => __importStar(require("@/services/sync.service")));
        const data = await SyncService.pushCatalog(req.chaslayMerchantId, req.body || {});
        res.json({ ok: true, serverTime: Date.now(), ...data });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Catalog push failed" });
    }
});
router.get("/payment-config", async (req, res) => {
    try {
        const data = await chaslay_compat_service_1.ChaslayCompatService.getPaymentConfig(req.chaslayMerchantId);
        res.json(data);
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Payment config sync failed" });
    }
});
router.post("/terminals", async (req, res) => {
    try {
        const data = await chaslay_compat_service_1.ChaslayCompatService.pushTerminalsFromDevice(req.chaslayMerchantId, req.body || {});
        res.json(data);
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Terminal sync failed" });
    }
});
router.get("/staff", async (req, res) => {
    try {
        const { StaffService } = await Promise.resolve().then(() => __importStar(require("@/services/staff.service")));
        const data = await StaffService.getSyncPayload(req.chaslayMerchantId);
        res.json(data);
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Staff sync failed" });
    }
});
router.post("/staff/verify-pin", async (req, res) => {
    try {
        const { StaffService } = await Promise.resolve().then(() => __importStar(require("@/services/staff.service")));
        const staff = await StaffService.verifyPin(req.chaslayMerchantId, String(req.body?.pin || ""));
        res.json({ success: true, staff });
    }
    catch (error) {
        res.status(401).json({ error: error instanceof Error ? error.message : "Invalid PIN" });
    }
});
/** Android POS crash/error logs — superadmin System Logs only. */
router.post("/diagnostic-report", async (req, res) => {
    try {
        const { SupportTicketService } = await Promise.resolve().then(() => __importStar(require("@/services/support-ticket.service")));
        const { subject, body, auto, deviceId, appVersion } = req.body || {};
        if (!subject?.trim() || !body?.trim()) {
            return res.status(400).json({ error: "Subject and body are required" });
        }
        const header = [
            "--- Chaslay Android POS diagnostics ---",
            JSON.stringify({
                deviceId: deviceId ? String(deviceId).slice(0, 64) : null,
                appVersion: appVersion ? String(appVersion).slice(0, 64) : null,
                auto: auto === true || auto === "true",
            }, null, 2),
            "--- Log ---",
        ].join("\n");
        const log = await SupportTicketService.createDiagnosticReport(req.chaslayMerchantId, {
            source: "android",
            subject: String(subject).slice(0, 255),
            body: `${header}\n${String(body)}`,
            auto: auto === true || auto === "true",
            authorName: "Android POS",
        });
        res.json({ ok: true, logId: log.id });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to submit report" });
    }
});
exports.default = router;
//# sourceMappingURL=sync.routes.js.map