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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const auth_routes_1 = __importDefault(require("@/routes/auth.routes"));
const licensing_routes_1 = __importDefault(require("@/routes/licensing.routes"));
const superadmin_routes_1 = __importDefault(require("@/routes/superadmin.routes"));
const merchant_routes_1 = __importDefault(require("@/routes/merchant.routes"));
const payment_routes_1 = __importDefault(require("@/routes/payment.routes"));
const webshop_routes_1 = __importDefault(require("@/routes/webshop.routes"));
const loyalty_routes_1 = __importDefault(require("@/routes/loyalty.routes"));
const gift_cards_routes_1 = __importDefault(require("@/routes/gift-cards.routes"));
const sync_routes_1 = __importDefault(require("@/routes/sync.routes"));
const terminals_routes_1 = __importDefault(require("@/routes/terminals.routes"));
const tap_to_pay_routes_1 = __importDefault(require("@/routes/tap-to-pay.routes"));
const shop_routes_1 = __importDefault(require("@/routes/shop.routes"));
const cms_routes_1 = __importDefault(require("@/routes/cms.routes"));
const rfid_readers_routes_1 = __importDefault(require("@/routes/rfid-readers.routes"));
const delivery_zones_routes_1 = __importDefault(require("@/routes/delivery-zones.routes"));
const floor_plans_routes_1 = __importDefault(require("@/routes/floor-plans.routes"));
const reservations_routes_1 = __importDefault(require("@/routes/reservations.routes"));
const receipts_routes_1 = __importDefault(require("@/routes/receipts.routes"));
const kds_routes_1 = __importStar(require("@/routes/kds.routes"));
const ods_routes_1 = __importStar(require("@/routes/ods.routes"));
const signage_routes_1 = __importStar(require("@/routes/signage.routes"));
const chaslay_1 = __importDefault(require("@/routes/chaslay"));
const webhooks_routes_1 = __importDefault(require("@/routes/webhooks.routes"));
const delivery_platform_routes_1 = __importDefault(require("@/routes/delivery-platform.routes"));
const offers_routes_1 = __importDefault(require("@/routes/offers.routes"));
const vouchers_routes_1 = __importDefault(require("@/routes/vouchers.routes"));
const marketing_routes_1 = __importDefault(require("@/routes/marketing.routes"));
const panel_routes_1 = __importDefault(require("@/routes/panel.routes"));
const merchant_support_routes_1 = __importDefault(require("@/routes/merchant-support.routes"));
const reseller_support_routes_1 = __importDefault(require("@/routes/reseller-support.routes"));
const inventory_routes_1 = __importDefault(require("@/routes/inventory.routes"));
const storekeeper_routes_1 = __importDefault(require("@/routes/storekeeper.routes"));
const delivery_tracking_routes_1 = __importDefault(require("@/routes/delivery-tracking.routes"));
const staff_routes_1 = __importDefault(require("@/routes/staff.routes"));
const reseller_routes_1 = __importDefault(require("@/routes/reseller.routes"));
const media_upload_service_1 = require("@/services/media-upload.service");
const marketing_service_1 = require("@/services/marketing.service");
const reservation_service_1 = require("@/services/reservation.service");
const subscription_billing_service_1 = require("@/services/subscription-billing.service");
const ensure_merchant_schema_1 = require("@/lib/ensure-merchant-schema");
const ensure_licenses_schema_1 = require("@/lib/ensure-licenses-schema");
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const brand_1 = require("@/lib/brand");
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
function buildCorsOrigins() {
    const defaults = [
        process.env.SUPERADMIN_URL,
        process.env.MERCHANT_DASHBOARD_URL,
        process.env.WEB_SHOP_URL,
        process.env.PUBLIC_APP_URL,
        "http://localhost:5173",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://localhost:3003",
        ...brand_1.CURRENT_HOST_ALIASES,
        ...brand_1.LEGACY_HOST_ALIASES,
    ].filter(Boolean);
    const extra = (process.env.CORS_ORIGINS || "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);
    return [...new Set([...defaults, ...extra])];
}
// ============================================================================
// MIDDLEWARE
// ============================================================================
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        const allowed = buildCorsOrigins();
        // Allow mobile apps / same-origin / curl (no Origin header)
        if (!origin || allowed.includes(origin) || process.env.CORS_ALLOW_ALL === "true") {
            return callback(null, true);
        }
        return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
}));
app.use(express_1.default.json({
    limit: "10mb",
    verify: (req, _res, buf) => {
        const url = req.originalUrl || req.url || "";
        if (/\/api\/webhooks\/(just-eat|uber-eats)/.test(url)) {
            req.rawBody = buf.toString("utf8");
        }
    },
}));
app.use(express_1.default.urlencoded({ extended: true }));
app.use((req, _res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
});
// Public uploaded media (vacation popup images, etc.)
const uploadsRoot = (0, media_upload_service_1.ensureUploadsRoot)();
app.use("/api/uploads", express_1.default.static(uploadsRoot, {
    fallthrough: false,
    maxAge: "7d",
    setHeaders(res) {
        res.setHeader("Cache-Control", "public, max-age=604800");
    },
}));
// Public installers / static downloads (print agent EXE, etc.)
const downloadsRoot = path_1.default.join(__dirname, "..", "public", "downloads");
app.use("/downloads", express_1.default.static(downloadsRoot, {
    // Missing file → 404 from static (do not fall through to SPA-style handlers)
    fallthrough: false,
    maxAge: "1h",
    setHeaders(res, filePath) {
        if (filePath.endsWith(".exe")) {
            res.setHeader("Content-Type", "application/octet-stream");
            res.setHeader("Content-Disposition", `attachment; filename="${path_1.default.basename(filePath)}"`);
            // Prevent proxies from gzip/brotli-transforming the binary
            res.setHeader("Content-Encoding", "identity");
            res.setHeader("X-Content-Type-Options", "nosniff");
            res.setHeader("Cache-Control", "public, max-age=3600");
        }
        else {
            res.setHeader("Cache-Control", "public, max-age=3600");
        }
    },
}));
// ============================================================================
// ROUTES
// ============================================================================
app.get("/health", (_req, res) => {
    res.json({
        status: "ok",
        service: "reborn-backend",
        timestamp: new Date().toISOString(),
    });
});
/** Public status page data (no auth). */
app.get("/api/public/status", async (_req, res) => {
    const components = {
        api: { status: "ok" },
        dashboard: { status: "ok" },
        shop: { status: "ok" },
        pay: { status: "ok" },
    };
    let overall = "operational";
    try {
        const start = Date.now();
        await (0, db_1.getDb)().execute((0, drizzle_orm_1.sql) `SELECT 1`);
        components.database = { status: "ok", latencyMs: Date.now() - start };
    }
    catch {
        components.database = { status: "error" };
        overall = "degraded";
    }
    res.json({
        status: overall,
        updatedAt: new Date().toISOString(),
        components,
    });
});
app.use("/api/auth", auth_routes_1.default);
app.use("/api/licensing", licensing_routes_1.default);
app.use("/api/superadmin", superadmin_routes_1.default);
app.use("/api/panel", panel_routes_1.default);
app.use("/api/reseller", reseller_routes_1.default);
app.use("/api/reseller/support", reseller_support_routes_1.default);
app.use("/api/merchant", merchant_routes_1.default);
app.use("/api/merchant/support", merchant_support_routes_1.default);
app.use("/api/merchant", staff_routes_1.default);
app.use("/api/payment", payment_routes_1.default);
app.use("/api/webshop", webshop_routes_1.default);
app.use("/api/loyalty", loyalty_routes_1.default);
app.use("/api/gift-cards", gift_cards_routes_1.default);
app.use("/api/sync", sync_routes_1.default);
app.use("/api/terminals", terminals_routes_1.default);
app.use("/api/tap-to-pay", tap_to_pay_routes_1.default);
app.use("/api/shop", shop_routes_1.default);
app.use("/api/merchant/cms", cms_routes_1.default);
app.use("/api/rfid-readers", rfid_readers_routes_1.default);
app.use("/api/delivery-zones", delivery_zones_routes_1.default);
app.use("/api/merchant/floor-plans", floor_plans_routes_1.default);
app.use("/api/merchant/reservations", reservations_routes_1.default);
app.use("/api/merchant/offers", offers_routes_1.default);
app.use("/api/merchant/vouchers", vouchers_routes_1.default);
app.use("/api/merchant/marketing", marketing_routes_1.default);
app.use("/api/merchant/inventory", inventory_routes_1.default);
app.use("/api/merchant/storekeeper", storekeeper_routes_1.default);
app.use("/api/merchant/delivery", delivery_tracking_routes_1.default);
app.use("/api/receipts", receipts_routes_1.default);
app.use("/api/kds", kds_routes_1.default);
app.use("/api/merchant/kds", kds_routes_1.kdsMerchantRoutes);
app.use("/api/ods", ods_routes_1.default);
app.use("/api/merchant/ods", ods_routes_1.odsMerchantRoutes);
app.use("/api/tv", signage_routes_1.default);
app.use("/api/merchant/signage", signage_routes_1.signageMerchantRoutes);
app.use("/api/webhooks", webhooks_routes_1.default);
app.use("/api/webhooks", delivery_platform_routes_1.default);
/** Reborn / FoodTruck Android POS (Retrofit /v1/* contract) */
app.use("/v1", chaslay_1.default);
// ============================================================================
// ERROR HANDLING
// ============================================================================
app.use((_req, res) => {
    res.status(404).json({ error: "Route not found" });
});
app.use((err, _req, res, _next) => {
    console.error("Error:", err);
    const isCors = err.message.startsWith("CORS blocked");
    res.status(isCors ? 403 : 500).json({
        error: isCors ? err.message : "Internal server error",
        message: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
});
app.listen(PORT, () => {
    console.log(`✅ ${brand_1.APP_NAME} API running on port ${PORT}`);
    console.log(`🏥 Health check: /health`);
    console.log(`🔧 Environment: ${process.env.NODE_ENV || "development"}`);
    (0, ensure_merchant_schema_1.ensureMerchantSchemaAtStartup)();
    (0, ensure_licenses_schema_1.ensureLicensesSchemaAtStartup)();
    // Reminder sweeps (~hourly). Lightweight; skips merchants without email.
    const tick = async () => {
        try {
            const result = await marketing_service_1.MarketingService.processReorderReminders();
            if (result.sent > 0) {
                console.log(`[marketing] reorder reminders sent: ${result.sent}`);
            }
        }
        catch (error) {
            console.error("[marketing] reorder reminder job failed", error);
        }
        try {
            const result = await reservation_service_1.ReservationService.processReminders();
            if (result.sent > 0) {
                console.log(`[reservations] reminders sent: ${result.sent}`);
            }
        }
        catch (error) {
            console.error("[reservations] reminder job failed", error);
        }
        try {
            const result = await reservation_service_1.ReservationService.processDailySummaries();
            if (result.sent > 0) {
                console.log(`[reservations] daily summaries sent: ${result.sent}`);
            }
        }
        catch (error) {
            console.error("[reservations] daily summary job failed", error);
        }
        try {
            const { PosShiftService } = await Promise.resolve().then(() => __importStar(require("@/services/pos-shift.service")));
            const closed = await PosShiftService.autoCloseStaleShifts();
            if (closed > 0) {
                console.log(`[pos-shifts] auto-closed stale shifts: ${closed}`);
            }
        }
        catch (error) {
            console.error("[pos-shifts] auto-close job failed", error);
        }
        try {
            const { ReportEmailService } = await Promise.resolve().then(() => __importStar(require("@/services/report-email.service")));
            const result = await ReportEmailService.processScheduledReports();
            if (result.sent > 0) {
                console.log(`[report-email] scheduled reports sent: ${result.sent}`);
            }
        }
        catch (error) {
            console.error("[report-email] scheduled job failed", error);
        }
        try {
            const result = await subscription_billing_service_1.SubscriptionBillingService.processRecurringRenewals();
            if (result.charged > 0 || result.failed > 0) {
                console.log(`[subscription] recurring renewals: charged=${result.charged} failed=${result.failed}`);
            }
        }
        catch (error) {
            console.error("[subscription] recurring renewal job failed", error);
        }
    };
    setTimeout(() => void tick(), 45000);
    setInterval(() => void tick(), 60 * 60 * 1000);
});
exports.default = app;
//# sourceMappingURL=index.js.map