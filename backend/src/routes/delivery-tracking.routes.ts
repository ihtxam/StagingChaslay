import { Router, Request, Response, NextFunction } from "express";
import {
  verifyToken,
  requireMerchant,
  requirePermission,
  setMerchantContext,
} from "@/middleware/auth.middleware";
import { AuthService, type JWTPayload } from "@/services/auth.service";
import { DeliveryTrackingService } from "@/services/delivery-tracking.service";

const router = Router();

function overlayPinStaff(req: Request, _res: Response, next: NextFunction) {
  const pinHeader = req.headers["x-webpos-staff-access"];
  const pinTok = Array.isArray(pinHeader) ? pinHeader[0] : pinHeader;
  if (pinTok && typeof pinTok === "string" && pinTok.trim() && req.merchantId) {
    try {
      const payload = AuthService.verifyToken(pinTok.trim()) as JWTPayload;
      if (
        payload.role === "staff" &&
        payload.merchantId &&
        payload.merchantId === req.merchantId
      ) {
        req.user = {
          ...(req.user || payload),
          ...payload,
          staffId: payload.staffId || payload.id,
          permissions: payload.permissions || req.user?.permissions,
        };
      }
    } catch {
      /* ignore invalid pin token */
    }
  }
  next();
}

router.use(verifyToken);
router.use(requireMerchant);
router.use(setMerchantContext);
router.use(overlayPinStaff);

/** POST /api/merchant/delivery/location — driver GPS ping */
router.post("/location", requirePermission("DELIVERY_ORDERS"), async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const staffId = req.user?.staffId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    if (!staffId) {
      return res.status(403).json({ error: "Clock in with your staff PIN to share location" });
    }
    const body = req.body || {};
    const result = await DeliveryTrackingService.postLocation(merchantId, staffId, {
      latitude: Number(body.latitude),
      longitude: Number(body.longitude),
      accuracyM: body.accuracyM != null ? Number(body.accuracyM) : null,
      heading: body.heading != null ? Number(body.heading) : null,
      speedMps: body.speedMps != null ? Number(body.speedMps) : null,
    });
    const { DeliveryDriverPayService } = await import("@/services/delivery-driver-pay.service");
    await DeliveryDriverPayService.startShift(merchantId, staffId);
    res.json(result);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to save location",
    });
  }
});

/** GET /api/merchant/delivery/live — map panel: drivers + orders */
router.get(
  "/live",
  requirePermission("VIEW_DELIVERY_TRACKING"),
  async (req: Request, res: Response) => {
    try {
      const merchantId = req.merchantId;
      if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
      const [drivers, orders, deliveryStaff] = await Promise.all([
        DeliveryTrackingService.listLiveDrivers(merchantId),
        DeliveryTrackingService.listActiveDeliveryOrders(merchantId),
        DeliveryTrackingService.listDeliveryStaff(merchantId),
      ]);
      res.json({ success: true, drivers, orders, deliveryStaff });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to load delivery map",
      });
    }
  }
);

/** POST /api/merchant/delivery/orders/:orderId/assign */
router.post(
  "/orders/:orderId/assign",
  requirePermission("VIEW_DELIVERY_TRACKING"),
  async (req: Request, res: Response) => {
    try {
      const merchantId = req.merchantId;
      if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
      const staffId =
        req.body?.staffId === null || req.body?.staffId === ""
          ? null
          : String(req.body?.staffId || "").trim() || null;
      const result = await DeliveryTrackingService.assignDriver(
        merchantId,
        req.params.orderId,
        staffId
      );
      res.json(result);
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : "Failed to assign driver",
      });
    }
  }
);

/** GET /api/merchant/delivery/my-orders — driver app: assigned active deliveries */
router.get("/my-orders", requirePermission("DELIVERY_ORDERS"), async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const staffId = req.user?.staffId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    if (!staffId) {
      return res.status(403).json({ error: "Clock in with your staff PIN" });
    }
    const all = await DeliveryTrackingService.listActiveDeliveryOrders(merchantId);
    const mine = all.filter((o) => o.assignedDeliveryStaffId === staffId);
    res.json({ success: true, orders: mine });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to load orders",
    });
  }
});

/** GET /api/merchant/delivery/wage — driver daily pay summary */
router.get("/wage", requirePermission("DELIVERY_ORDERS"), async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const staffId = req.user?.staffId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    if (!staffId) return res.status(403).json({ error: "Clock in with your staff PIN" });
    const { DeliveryDriverPayService } = await import("@/services/delivery-driver-pay.service");
    const summary = await DeliveryDriverPayService.getDailySummary(
      merchantId,
      staffId,
      req.query.date ? String(req.query.date) : undefined
    );
    res.json({ success: true, summary });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to load wage summary",
    });
  }
});

/** GET /api/merchant/delivery/completed — driver completed deliveries today */
router.get(
  "/completed",
  requirePermission("DELIVERY_ORDERS"),
  async (req: Request, res: Response) => {
    try {
      const merchantId = req.merchantId;
      const staffId = req.user?.staffId;
      if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
      if (!staffId) return res.status(403).json({ error: "Clock in with your staff PIN" });
      const orders = await DeliveryTrackingService.listCompletedForDriver(
        merchantId,
        staffId,
        req.query.date ? String(req.query.date) : undefined
      );
      res.json({ success: true, orders });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to load completed orders",
      });
    }
  }
);

/** POST /api/merchant/delivery/shift/end — end hourly shift when stopping GPS */
router.post("/shift/end", requirePermission("DELIVERY_ORDERS"), async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const staffId = req.user?.staffId;
    if (!merchantId || !staffId) {
      return res.status(403).json({ error: "Clock in with your staff PIN" });
    }
    const { DeliveryDriverPayService } = await import("@/services/delivery-driver-pay.service");
    await DeliveryDriverPayService.endShift(merchantId, staffId);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to end shift",
    });
  }
});

/** POST /api/merchant/delivery/orders/:orderId/complete — driver marks delivered */
router.post(
  "/orders/:orderId/complete",
  requirePermission("DELIVERY_ORDERS"),
  async (req: Request, res: Response) => {
    try {
      const merchantId = req.merchantId;
      const staffId = req.user?.staffId;
      if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
      if (!staffId) return res.status(403).json({ error: "Clock in with your staff PIN" });
      const order = await DeliveryTrackingService.completeDeliveryAsDriver(
        merchantId,
        staffId,
        req.params.orderId
      );
      res.json({ success: true, order });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : "Failed to complete delivery",
      });
    }
  }
);

/** GET /api/merchant/delivery/orders/:orderId/driver — driver ping for orders board */
router.get(
  "/orders/:orderId/driver",
  requirePermission("VIEW_DELIVERY_TRACKING", "VIEW_ORDER_HISTORY"),
  async (req: Request, res: Response) => {
    try {
      const merchantId = req.merchantId;
      if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
      const driver = await DeliveryTrackingService.getDriverPingForOrder(
        merchantId,
        req.params.orderId
      );
      res.json({ success: true, driver });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to load driver location",
      });
    }
  }
);

/** POST /api/merchant/delivery/orders/:orderId/claim — driver scanned delivery slip QR */
router.post(
  "/orders/:orderId/claim",
  requirePermission("DELIVERY_ORDERS"),
  async (req: Request, res: Response) => {
    try {
      const merchantId = req.merchantId;
      const staffId = req.user?.staffId;
      if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
      if (!staffId) return res.status(403).json({ error: "Clock in with your staff PIN" });
      const token = String(req.body?.token || req.query?.token || "").trim();
      if (!token) return res.status(400).json({ error: "Scan token is required" });
      const result = await DeliveryTrackingService.claimOrderAsDriver(
        merchantId,
        staffId,
        req.params.orderId,
        token
      );
      res.json(result);
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : "Failed to claim delivery",
      });
    }
  }
);

/** GET /api/merchant/delivery/orders/:orderId/slip — driver claim URL for printing */
router.get(
  "/orders/:orderId/slip",
  requirePermission("VIEW_DELIVERY_TRACKING", "VIEW_ORDER_HISTORY"),
  async (req: Request, res: Response) => {
    try {
      const merchantId = req.merchantId;
      if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
      const token = await DeliveryTrackingService.ensureDeliveryTrackingToken(
        merchantId,
        req.params.orderId
      );
      const { buildDriverClaimUrl } = await import("@/lib/delivery-tracking-url");
      res.json({
        success: true,
        orderId: req.params.orderId,
        token,
        driverClaimUrl: buildDriverClaimUrl(req.params.orderId, token),
      });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : "Failed to build slip URL",
      });
    }
  }
);

export default router;
