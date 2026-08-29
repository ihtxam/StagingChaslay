import { Router, Request, Response } from "express";
import { verifyToken, requireMerchantAccess, setMerchantContext } from "@/middleware/auth.middleware";
import { BulkPricingService, HqCatalogService } from "@/services/hq-catalog.service";

const router = Router();

router.use(verifyToken);
router.use(requireMerchantAccess);
router.use(setMerchantContext);

/** GET /api/merchant/hq/catalog/versions */
router.get("/hq/catalog/versions", async (req: Request, res: Response) => {
  try {
    const versions = await HqCatalogService.listVersions(req.merchantId!);
    res.json({ success: true, versions });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to list HQ versions",
    });
  }
});

/** POST /api/merchant/hq/catalog/versions */
router.post("/hq/catalog/versions", async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const version = await HqCatalogService.createVersion(req.merchantId!, {
      name: body.name,
      productIds: body.productIds,
      staffId: req.user?.staffId || null,
    });
    res.json({ success: true, version });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to create HQ version",
    });
  }
});

/** POST /api/merchant/hq/catalog/push */
router.post("/hq/catalog/push", async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const result = await HqCatalogService.pushToLocations(req.merchantId!, {
      versionId: String(body.versionId || ""),
      locationIds: Array.isArray(body.locationIds) ? body.locationIds : [],
      overwritePrices: !!body.overwritePrices,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to push HQ catalog",
    });
  }
});

/** GET /api/merchant/hq/catalog/links/:locationId */
router.get("/hq/catalog/links/:locationId", async (req: Request, res: Response) => {
  try {
    const links = await HqCatalogService.listLocationLinks(req.merchantId!, req.params.locationId);
    res.json({ success: true, links });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to list catalog links",
    });
  }
});

/** POST /api/merchant/hq/bulk-pricing/preview */
router.post("/hq/bulk-pricing/preview", async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const preview = await BulkPricingService.preview(req.merchantId!, {
      locationIds: body.locationIds,
      categoryIds: body.categoryIds,
      productIds: body.productIds,
      operation: body.operation === "decrease" ? "decrease" : "increase",
      valueType: body.valueType === "percent" ? "percent" : "fixed",
      value: Number(body.value) || 0,
      roundTo: body.roundTo != null ? Number(body.roundTo) : null,
    });
    res.json({ success: true, ...preview });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to preview bulk pricing",
    });
  }
});

/** POST /api/merchant/hq/bulk-pricing/apply */
router.post("/hq/bulk-pricing/apply", async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const result = await BulkPricingService.apply(req.merchantId!, String(body.previewToken || ""), {
      staffId: req.user?.staffId || null,
      staffName: req.user?.name || null,
      locationIds: body.locationIds,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to apply bulk pricing",
    });
  }
});

/** GET /api/merchant/hq/bulk-pricing/jobs */
router.get("/hq/bulk-pricing/jobs", async (req: Request, res: Response) => {
  try {
    const jobs = await BulkPricingService.listJobs(req.merchantId!);
    res.json({ success: true, jobs });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to list bulk pricing jobs",
    });
  }
});

export default router;
