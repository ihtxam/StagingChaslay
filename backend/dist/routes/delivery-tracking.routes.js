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
const auth_service_1 = require("@/services/auth.service");
const delivery_tracking_service_1 = require("@/services/delivery-tracking.service");
const router = (0, express_1.Router)();
function overlayPinStaff(req, _res, next) {
    const pinHeader = req.headers["x-webpos-staff-access"];
    const pinTok = Array.isArray(pinHeader) ? pinHeader[0] : pinHeader;
    if (pinTok && typeof pinTok === "string" && pinTok.trim() && req.merchantId) {
        try {
            const payload = auth_service_1.AuthService.verifyToken(pinTok.trim());
            if (payload.role === "staff" &&
                payload.merchantId &&
                payload.merchantId === req.merchantId) {
                req.user = {
                    ...(req.user || payload),
                    ...payload,
                    staffId: payload.staffId || payload.id,
                    permissions: payload.permissions || req.user?.permissions,
                };
            }
        }
        catch {
            /* ignore invalid pin token */
        }
    }
    next();
}
router.use(auth_middleware_1.verifyToken);
router.use(auth_middleware_1.requireMerchant);
router.use(auth_middleware_1.setMerchantContext);
router.use(overlayPinStaff);
/** POST /api/merchant/delivery/location — driver GPS ping */
router.post("/location", (0, auth_middleware_1.requirePermission)("DELIVERY_ORDERS"), async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const staffId = req.user?.staffId;
        if (!merchantId)
            return res.status(400).json({ error: "Merchant ID is required" });
        if (!staffId) {
            return res.status(403).json({ error: "Clock in with your staff PIN to share location" });
        }
        const body = req.body || {};
        const result = await delivery_tracking_service_1.DeliveryTrackingService.postLocation(merchantId, staffId, {
            latitude: Number(body.latitude),
            longitude: Number(body.longitude),
            accuracyM: body.accuracyM != null ? Number(body.accuracyM) : null,
            heading: body.heading != null ? Number(body.heading) : null,
            speedMps: body.speedMps != null ? Number(body.speedMps) : null,
        });
        const { DeliveryDriverPayService } = await Promise.resolve().then(() => __importStar(require("@/services/delivery-driver-pay.service")));
        await DeliveryDriverPayService.startShift(merchantId, staffId);
        res.json(result);
    }
    catch (error) {
        res.status(400).json({
            error: error instanceof Error ? error.message : "Failed to save location",
        });
    }
});
/** GET /api/merchant/delivery/live — map panel: drivers + orders */
router.get("/live", (0, auth_middleware_1.requirePermission)("VIEW_DELIVERY_TRACKING"), async (req, res) => {
    try {
        const merchantId = req.merchantId;
        if (!merchantId)
            return res.status(400).json({ error: "Merchant ID is required" });
        const [drivers, orders, deliveryStaff] = await Promise.all([
            delivery_tracking_service_1.DeliveryTrackingService.listLiveDrivers(merchantId),
            delivery_tracking_service_1.DeliveryTrackingService.listActiveDeliveryOrders(merchantId),
            delivery_tracking_service_1.DeliveryTrackingService.listDeliveryStaff(merchantId),
        ]);
        res.json({ success: true, drivers, orders, deliveryStaff });
    }
    catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : "Failed to load delivery map",
        });
    }
});
/** POST /api/merchant/delivery/orders/:orderId/assign */
router.post("/orders/:orderId/assign", (0, auth_middleware_1.requirePermission)("VIEW_DELIVERY_TRACKING"), async (req, res) => {
    try {
        const merchantId = req.merchantId;
        if (!merchantId)
            return res.status(400).json({ error: "Merchant ID is required" });
        const staffId = req.body?.staffId === null || req.body?.staffId === ""
            ? null
            : String(req.body?.staffId || "").trim() || null;
        const result = await delivery_tracking_service_1.DeliveryTrackingService.assignDriver(merchantId, req.params.orderId, staffId);
        res.json(result);
    }
    catch (error) {
        res.status(400).json({
            error: error instanceof Error ? error.message : "Failed to assign driver",
        });
    }
});
/** GET /api/merchant/delivery/my-orders — driver app: assigned active deliveries */
router.get("/my-orders", (0, auth_middleware_1.requirePermission)("DELIVERY_ORDERS"), async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const staffId = req.user?.staffId;
        if (!merchantId)
            return res.status(400).json({ error: "Merchant ID is required" });
        if (!staffId) {
            return res.status(403).json({ error: "Clock in with your staff PIN" });
        }
        const all = await delivery_tracking_service_1.DeliveryTrackingService.listActiveDeliveryOrders(merchantId);
        const mine = all.filter((o) => o.assignedDeliveryStaffId === staffId);
        res.json({ success: true, orders: mine });
    }
    catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : "Failed to load orders",
        });
    }
});
/** GET /api/merchant/delivery/wage — driver daily pay summary */
router.get("/wage", (0, auth_middleware_1.requirePermission)("DELIVERY_ORDERS"), async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const staffId = req.user?.staffId;
        if (!merchantId)
            return res.status(400).json({ error: "Merchant ID is required" });
        if (!staffId)
            return res.status(403).json({ error: "Clock in with your staff PIN" });
        const { DeliveryDriverPayService } = await Promise.resolve().then(() => __importStar(require("@/services/delivery-driver-pay.service")));
        const summary = await DeliveryDriverPayService.getDailySummary(merchantId, staffId, req.query.date ? String(req.query.date) : undefined);
        res.json({ success: true, summary });
    }
    catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : "Failed to load wage summary",
        });
    }
});
/** GET /api/merchant/delivery/completed — driver completed deliveries today */
router.get("/completed", (0, auth_middleware_1.requirePermission)("DELIVERY_ORDERS"), async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const staffId = req.user?.staffId;
        if (!merchantId)
            return res.status(400).json({ error: "Merchant ID is required" });
        if (!staffId)
            return res.status(403).json({ error: "Clock in with your staff PIN" });
        const orders = await delivery_tracking_service_1.DeliveryTrackingService.listCompletedForDriver(merchantId, staffId, req.query.date ? String(req.query.date) : undefined);
        res.json({ success: true, orders });
    }
    catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : "Failed to load completed orders",
        });
    }
});
/** POST /api/merchant/delivery/shift/end — end hourly shift when stopping GPS */
router.post("/shift/end", (0, auth_middleware_1.requirePermission)("DELIVERY_ORDERS"), async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const staffId = req.user?.staffId;
        if (!merchantId || !staffId) {
            return res.status(403).json({ error: "Clock in with your staff PIN" });
        }
        const { DeliveryDriverPayService } = await Promise.resolve().then(() => __importStar(require("@/services/delivery-driver-pay.service")));
        await DeliveryDriverPayService.endShift(merchantId, staffId);
        res.json({ success: true });
    }
    catch (error) {
        res.status(400).json({
            error: error instanceof Error ? error.message : "Failed to end shift",
        });
    }
});
/** POST /api/merchant/delivery/orders/:orderId/start — driver starts delivery run */
router.post("/orders/:orderId/start", (0, auth_middleware_1.requirePermission)("DELIVERY_ORDERS"), async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const staffId = req.user?.staffId;
        if (!merchantId)
            return res.status(400).json({ error: "Merchant ID is required" });
        if (!staffId)
            return res.status(403).json({ error: "Clock in with your staff PIN" });
        const order = await delivery_tracking_service_1.DeliveryTrackingService.startDeliveryAsDriver(merchantId, staffId, req.params.orderId);
        res.json({ success: true, order });
    }
    catch (error) {
        res.status(400).json({
            error: error instanceof Error ? error.message : "Failed to start delivery",
        });
    }
});
/** POST /api/merchant/delivery/orders/:orderId/complete — driver marks delivered */
router.post("/orders/:orderId/complete", (0, auth_middleware_1.requirePermission)("DELIVERY_ORDERS"), async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const staffId = req.user?.staffId;
        if (!merchantId)
            return res.status(400).json({ error: "Merchant ID is required" });
        if (!staffId)
            return res.status(403).json({ error: "Clock in with your staff PIN" });
        const order = await delivery_tracking_service_1.DeliveryTrackingService.completeDeliveryAsDriver(merchantId, staffId, req.params.orderId);
        res.json({ success: true, order });
    }
    catch (error) {
        res.status(400).json({
            error: error instanceof Error ? error.message : "Failed to complete delivery",
        });
    }
});
/** GET /api/merchant/delivery/orders/:orderId/driver — driver ping for orders board */
router.get("/orders/:orderId/driver", (0, auth_middleware_1.requirePermission)("VIEW_DELIVERY_TRACKING", "VIEW_ORDER_HISTORY"), async (req, res) => {
    try {
        const merchantId = req.merchantId;
        if (!merchantId)
            return res.status(400).json({ error: "Merchant ID is required" });
        const driver = await delivery_tracking_service_1.DeliveryTrackingService.getDriverPingForOrder(merchantId, req.params.orderId);
        res.json({ success: true, driver });
    }
    catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : "Failed to load driver location",
        });
    }
});
/** POST /api/merchant/delivery/orders/:orderId/claim — driver scanned delivery slip QR */
router.post("/orders/:orderId/claim", (0, auth_middleware_1.requirePermission)("DELIVERY_ORDERS"), async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const staffId = req.user?.staffId;
        if (!merchantId)
            return res.status(400).json({ error: "Merchant ID is required" });
        if (!staffId)
            return res.status(403).json({ error: "Clock in with your staff PIN" });
        const token = String(req.body?.token || req.query?.token || "").trim();
        if (!token)
            return res.status(400).json({ error: "Scan token is required" });
        const result = await delivery_tracking_service_1.DeliveryTrackingService.claimOrderAsDriver(merchantId, staffId, req.params.orderId, token);
        res.json(result);
    }
    catch (error) {
        res.status(400).json({
            error: error instanceof Error ? error.message : "Failed to claim delivery",
        });
    }
});
/** GET /api/merchant/delivery/orders/:orderId/slip — driver claim URL for printing */
router.get("/orders/:orderId/slip", (0, auth_middleware_1.requirePermission)("VIEW_DELIVERY_TRACKING", "VIEW_ORDER_HISTORY"), async (req, res) => {
    try {
        const merchantId = req.merchantId;
        if (!merchantId)
            return res.status(400).json({ error: "Merchant ID is required" });
        const token = await delivery_tracking_service_1.DeliveryTrackingService.ensureDeliveryTrackingToken(merchantId, req.params.orderId);
        const { buildDriverClaimUrl } = await Promise.resolve().then(() => __importStar(require("@/lib/delivery-tracking-url")));
        res.json({
            success: true,
            orderId: req.params.orderId,
            token,
            driverClaimUrl: buildDriverClaimUrl(req.params.orderId, token),
        });
    }
    catch (error) {
        res.status(400).json({
            error: error instanceof Error ? error.message : "Failed to build slip URL",
        });
    }
});
exports.default = router;
//# sourceMappingURL=delivery-tracking.routes.js.map