import { Request, Response, NextFunction } from "express";
import { ensureLocationsSchema, ensureMerchantColumnsSchema, ensureOrdersColumnsSchema, ensureOrderItemsColumnsSchema } from "@/lib/ensure-merchant-schema";
import { LocationsService } from "@/services/locations.service";

declare global {
  namespace Express {
    interface Request {
      locationId?: string;
      /** True when X-Location-Id was sent and resolved to a real location row. */
      locationFromHeader?: boolean;
    }
  }
}

/**
 * Reads X-Location-Id header, validates staff access, sets req.locationId.
 * Unknown or stale headers fall back to the merchant default location
 * so Settings / catalog keep working for single-shop merchants.
 */
export async function setLocationContext(req: Request, res: Response, next: NextFunction) {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return next();

    await ensureMerchantColumnsSchema();
    await ensureOrdersColumnsSchema();
    await ensureOrderItemsColumnsSchema();
    await ensureLocationsSchema();

    const headerId = String(req.headers["x-location-id"] || "").trim();
    const isOwner = req.user?.role === "merchant";
    const staffId = req.user?.staffId || null;

    if (headerId) {
      const resolved = await LocationsService.resolveLocationIdOrNull(merchantId, headerId);
      if (resolved) {
        await LocationsService.assertStaffAccess(merchantId, resolved, { staffId, isOwner });
        req.locationId = resolved;
        req.locationFromHeader = true;
        return next();
      }
      // Invalid terminal header: do not substitute merchant default (prevents Bar menu on Kiosk).
      req.locationFromHeader = true;
      return next();
    }
    req.locationId = await LocationsService.getDefaultId(merchantId);
    next();
  } catch (error) {
    // Stale X-Location-Id / missing locations row must not blank Settings, Tables, or Reservations.
    console.warn("[location] context failed, falling back to default:", error);
    try {
      if (req.merchantId) {
        req.locationId = await LocationsService.getDefaultId(req.merchantId);
        return next();
      }
    } catch (fallbackError) {
      console.warn("[location] default location fallback failed:", fallbackError);
    }
    req.locationId = undefined;
    next();
  }
}
