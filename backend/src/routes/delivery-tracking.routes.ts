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

export default router;
