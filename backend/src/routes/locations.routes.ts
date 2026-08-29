import { Router, Request, Response } from "express";
import { verifyToken, requireMerchantAccess, setMerchantContext } from "@/middleware/auth.middleware";
import { setLocationContext } from "@/middleware/location.middleware";
import { LocationsService } from "@/services/locations.service";
import { MerchantEntitlementsService } from "@/services/merchant-entitlements.service";

const router = Router();

router.use(verifyToken);
router.use(requireMerchantAccess);
router.use(setMerchantContext);

function userContext(req: Request) {
  return {
    staffId: req.user?.staffId || null,
    isOwner: req.user?.role === "merchant",
    staffName: req.user?.name || null,
  };
}

/** GET /api/merchant/locations */
router.get("/locations", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    const ctx = userContext(req);
    const locations = await LocationsService.listForUser(merchantId, ctx);
    const limits = await MerchantEntitlementsService.getLocationLimitInfo(merchantId).catch(() => ({
      maxLocations: 1,
      currentCount: locations.length,
      planSlug: null,
      planName: null,
    }));
    res.json({ success: true, locations, limits });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to list locations",
    });
  }
});

/** POST /api/merchant/locations */
router.post("/locations", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    const body = req.body || {};
    const location = await LocationsService.create(merchantId, {
      name: body.name,
      slug: body.slug,
      businessCategory: body.businessCategory,
      address: body.address,
      city: body.city,
      country: body.country,
      timezone: body.timezone,
      isDefault: !!body.isDefault,
    });
    res.json({ success: true, location });
  } catch (error) {
    const err = error as Error & { statusCode?: number; code?: string };
    res.status(err.statusCode === 403 ? 403 : 400).json({
      error: error instanceof Error ? error.message : "Failed to create location",
      code: err.code,
    });
  }
});

/** PUT /api/merchant/locations/:id */
router.put("/locations/:id", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    const body = req.body || {};
    const location = await LocationsService.update(merchantId, req.params.id, {
      name: body.name,
      slug: body.slug,
      businessCategory: body.businessCategory,
      address: body.address,
      city: body.city,
      country: body.country,
      timezone: body.timezone,
      isDefault: body.isDefault,
      status: body.status,
      settings: body.settings,
    });
    res.json({ success: true, location });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to update location",
    });
  }
});

/** DELETE /api/merchant/locations/:id */
router.delete("/locations/:id", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    await LocationsService.remove(merchantId, req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to delete location",
    });
  }
});

/** GET /api/merchant/locations/:id/staff/:staffId */
router.get("/locations/staff/:staffId", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    const locationIds = await LocationsService.getStaffLocationIds(merchantId, req.params.staffId);
    res.json({ success: true, locationIds });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to load staff locations",
    });
  }
});

/** PUT /api/merchant/locations/staff/:staffId */
router.put("/locations/staff/:staffId", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    const locationIds = Array.isArray(req.body?.locationIds) ? req.body.locationIds : [];
    const saved = await LocationsService.setStaffLocations(
      merchantId,
      req.params.staffId,
      locationIds
    );
    res.json({ success: true, locationIds: saved });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to save staff locations",
    });
  }
});

/** GET /api/merchant/locations/context — resolve active location for client */
router.get("/locations/context", setLocationContext, async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    const locationId = req.locationId!;
    const locations = await LocationsService.listForUser(merchantId, userContext(req));
    const active = locations.find((l) => l.id === locationId) || locations[0];
    res.json({ success: true, locationId: active?.id, location: active, locations });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to resolve location context",
    });
  }
});

export default router;
