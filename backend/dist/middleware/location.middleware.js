"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setLocationContext = setLocationContext;
const ensure_merchant_schema_1 = require("@/lib/ensure-merchant-schema");
const locations_service_1 = require("@/services/locations.service");
/**
 * Reads X-Location-Id header, validates staff access, sets req.locationId.
 * Unknown or stale headers fall back to the merchant default location
 * so Settings / catalog keep working for single-shop merchants.
 */
async function setLocationContext(req, res, next) {
    try {
        const merchantId = req.merchantId;
        if (!merchantId)
            return next();
        await (0, ensure_merchant_schema_1.ensureMerchantColumnsSchema)();
        await (0, ensure_merchant_schema_1.ensureOrdersColumnsSchema)();
        await (0, ensure_merchant_schema_1.ensureOrderItemsColumnsSchema)();
        await (0, ensure_merchant_schema_1.ensureLocationsSchema)();
        const headerId = String(req.headers["x-location-id"] || "").trim();
        const isOwner = req.user?.role === "merchant";
        const staffId = req.user?.staffId || null;
        if (headerId) {
            const resolved = await locations_service_1.LocationsService.resolveLocationIdOrNull(merchantId, headerId);
            if (resolved) {
                await locations_service_1.LocationsService.assertStaffAccess(merchantId, resolved, { staffId, isOwner });
                req.locationId = resolved;
                return next();
            }
        }
        req.locationId = await locations_service_1.LocationsService.getDefaultId(merchantId);
        next();
    }
    catch (error) {
        // Stale X-Location-Id / missing locations row must not blank Settings, Tables, or Reservations.
        console.warn("[location] context failed, falling back to default:", error);
        try {
            if (req.merchantId) {
                req.locationId = await locations_service_1.LocationsService.getDefaultId(req.merchantId);
                return next();
            }
        }
        catch (fallbackError) {
            console.warn("[location] default location fallback failed:", fallbackError);
        }
        req.locationId = undefined;
        next();
    }
}
//# sourceMappingURL=location.middleware.js.map