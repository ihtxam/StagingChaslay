import { Request, Response, NextFunction } from "express";
import { ensureLocationsSchema, ensureMerchantColumnsSchema, ensureOrdersColumnsSchema } from "@/lib/ensure-merchant-schema";
import { LocationsService } from "@/services/locations.service";

declare global {
  namespace Express {
    interface Request {
      locationId?: string;
    }
  }
}

/**
 * Reads X-Location-Id header, validates staff access, sets req.locationId.
 * Falls back to merchant default location when header absent.
 */
export async function setLocationContext(req: Request, res: Response, next: NextFunction) {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return next();

    await ensureMerchantColumnsSchema();
    await ensureOrdersColumnsSchema();
    await ensureLocationsSchema();

    const headerId = String(req.headers["x-location-id"] || "").trim();
    const isOwner = req.user?.role === "merchant";
    const staffId = req.user?.staffId || null;

    if (headerId) {
      await LocationsService.assertStaffAccess(merchantId, headerId, { staffId, isOwner });
      req.locationId = await LocationsService.resolveLocationId(merchantId, headerId);
    } else {
      req.locationId = await LocationsService.getDefaultId(merchantId);
    }
    next();
  } catch (error) {
    res.status(403).json({
      error: error instanceof Error ? error.message : "Invalid location",
      code: "LOCATION_ACCESS_DENIED",
    });
  }
}
