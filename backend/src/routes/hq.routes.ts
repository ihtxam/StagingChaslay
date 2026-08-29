import { Router, Request, Response } from "express";
import { verifyToken, requireMerchantAccess, setMerchantContext } from "@/middleware/auth.middleware";
import { BulkPricingService, HqCatalogService } from "@/services/hq-catalog.service";
import { HqMenuService } from "@/services/hq-menu.service";
import { PosReportsService } from "@/services/pos-reports.service";

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

/** GET /api/merchant/hq/analytics — org-wide KPIs by location */
router.get("/hq/analytics", async (req: Request, res: Response) => {
  try {
    const preset = (req.query.preset as string) || "today";
    const analytics = await PosReportsService.getOrgAnalytics(req.merchantId!, {
      preset: preset as "today" | "yesterday" | "this_month",
    });
    res.json({ success: true, analytics });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to load HQ analytics",
    });
  }
});

/** GET /api/merchant/hq/menus */
router.get("/hq/menus", async (req: Request, res: Response) => {
  try {
    const menus = await HqMenuService.list(req.merchantId!);
    res.json({ success: true, menus });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list HQ menus" });
  }
});

/** POST /api/merchant/hq/menus */
router.post("/hq/menus", async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const menu = await HqMenuService.create(req.merchantId!, body);
    res.json({ success: true, menu });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create HQ menu" });
  }
});

/** PUT /api/merchant/hq/menus/:menuId */
router.put("/hq/menus/:menuId", async (req: Request, res: Response) => {
  try {
    const menu = await HqMenuService.update(req.merchantId!, req.params.menuId, req.body || {});
    res.json({ success: true, menu });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update HQ menu" });
  }
});

/** DELETE /api/merchant/hq/menus/:menuId */
router.delete("/hq/menus/:menuId", async (req: Request, res: Response) => {
  try {
    await HqMenuService.remove(req.merchantId!, req.params.menuId);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to delete HQ menu" });
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
