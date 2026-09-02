import { Router, Request, Response } from "express";
import { verifyToken, requireMerchant, requirePermission, setMerchantContext } from "@/middleware/auth.middleware";
import { requireRetailModule } from "@/middleware/business-module.middleware";
import { InventoryLicenseError, InventoryService } from "@/services/inventory.service";
import { DemoInventoryService } from "@/services/demo-inventory.service";

const router = Router();

router.use(verifyToken);
router.use(requireMerchant);
router.use(setMerchantContext);
router.use(requirePermission("MANAGE_INVENTORY"));
router.use(requireRetailModule);

function denyInventoryRecipes(_req: Request, res: Response) {
  return res.status(403).json({
    error: "Recipes and consumption reports are not available in retail inventory",
    code: "INVENTORY_RECIPES_DISABLED",
  });
}

function handleError(res: Response, error: unknown, fallback: string) {
  if (error instanceof InventoryLicenseError) {
    return res.status(403).json({ error: error.message, code: "INVENTORY_ADDON_REQUIRED" });
  }
  const message = error instanceof Error ? error.message : fallback;
  const status = /not found/i.test(message) ? 404 : 400;
  return res.status(status).json({ error: message });
}

/** GET /api/merchant/inventory/status — works even when addon is locked (upsell). */
router.get("/status", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const license = await InventoryService.getLicense(merchantId);
    let hasDemoData = false;
    try {
      hasDemoData = await DemoInventoryService.hasDemoData(merchantId);
    } catch {
      /* column may not exist yet on old DBs */
    }
    res.json({ success: true, ...license, hasDemoData });
  } catch (error) {
    handleError(res, error, "Failed to load inventory status");
  }
});

/**
 * POST /api/merchant/inventory/import-demo
 * Seed sample ingredients, units, recipes and stock movements (testing only).
 * Idempotent: re-import replaces demo rows only.
 */
router.post("/import-demo", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const result = await DemoInventoryService.importDemo(merchantId);
    res.json(result);
  } catch (error) {
    console.error("Inventory demo import failed:", error);
    handleError(res, error, "Demo inventory import failed");
  }
});

/**
 * DELETE /api/merchant/inventory/demo-data
 * Remove all demo-flagged inventory rows for this merchant.
 */
router.delete("/demo-data", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const result = await DemoInventoryService.deleteDemo(merchantId);
    res.json(result);
  } catch (error) {
    console.error("Inventory demo delete failed:", error);
    handleError(res, error, "Failed to delete demo inventory");
  }
});

/** GET /api/merchant/inventory/dashboard — KPIs, scenarios and charts for inventory home. */
router.get("/dashboard", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const dashboard = await DemoInventoryService.getDashboard(merchantId);
    res.json({ success: true, dashboard });
  } catch (error) {
    handleError(res, error, "Failed to load inventory dashboard");
  }
});

router.put("/settings", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const license = await InventoryService.updateSettings(merchantId, {
      wasteFactor: req.body?.wasteFactor != null ? Number(req.body.wasteFactor) : undefined,
      autoReorderEmailEnabled:
        req.body?.autoReorderEmailEnabled != null ? !!req.body.autoReorderEmailEnabled : undefined,
    });
    res.json({ success: true, ...license });
  } catch (error) {
    handleError(res, error, "Failed to save inventory settings");
  }
});

router.get("/items", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    const items = await InventoryService.listItems(merchantId);
    res.json({ success: true, items });
  } catch (error) {
    handleError(res, error, "Failed to list items");
  }
});

router.post("/items", async (req: Request, res: Response) => {
  try {
    const item = await InventoryService.createItem(req.merchantId!, req.body || {});
    res.status(201).json({ success: true, item });
  } catch (error) {
    handleError(res, error, "Failed to create item");
  }
});

router.put("/items/:itemId", async (req: Request, res: Response) => {
  try {
    const item = await InventoryService.updateItem(req.merchantId!, req.params.itemId, req.body || {});
    res.json({ success: true, item });
  } catch (error) {
    handleError(res, error, "Failed to update item");
  }
});

router.delete("/items/:itemId", async (req: Request, res: Response) => {
  try {
    await InventoryService.deleteItem(req.merchantId!, req.params.itemId);
    res.json({ success: true });
  } catch (error) {
    handleError(res, error, "Failed to delete item");
  }
});

router.post("/items/:itemId/stock-in", async (req: Request, res: Response) => {
  try {
    const item = await InventoryService.stockIn(req.merchantId!, req.params.itemId, req.body || {});
    res.json({ success: true, item });
  } catch (error) {
    handleError(res, error, "Failed to record stock in");
  }
});

router.post("/items/:itemId/waste", async (req: Request, res: Response) => {
  try {
    const item = await InventoryService.waste(req.merchantId!, req.params.itemId, req.body || {});
    res.json({ success: true, item });
  } catch (error) {
    handleError(res, error, "Failed to record waste");
  }
});

router.get("/items/:itemId/movements", async (req: Request, res: Response) => {
  try {
    const movements = await InventoryService.listMovements(req.merchantId!, req.params.itemId);
    res.json({ success: true, movements });
  } catch (error) {
    handleError(res, error, "Failed to list movements");
  }
});

router.post("/items/:itemId/reorder-email", async (req: Request, res: Response) => {
  try {
    const result = await InventoryService.sendReorderEmail(req.merchantId!, {
      itemIds: [req.params.itemId],
      force: true,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    handleError(res, error, "Failed to email supplier");
  }
});

router.get("/low-stock", async (req: Request, res: Response) => {
  try {
    const items = await InventoryService.lowStock(req.merchantId!);
    res.json({ success: true, items });
  } catch (error) {
    handleError(res, error, "Failed to load low stock");
  }
});

router.get("/expiring-soon", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const data = await InventoryService.listExpiringSoon(merchantId);
    res.json({ success: true, ...data });
  } catch (error) {
    handleError(res, error, "Failed to load expiring stock");
  }
});

router.get("/usage", denyInventoryRecipes, async (req: Request, res: Response) => {
  try {
    const days = Number(req.query.days) || 30;
    const rows = await InventoryService.usageReport(req.merchantId!, days);
    res.json({ success: true, rows });
  } catch (error) {
    handleError(res, error, "Failed to load usage");
  }
});

router.get("/suppliers", async (req: Request, res: Response) => {
  try {
    const suppliers = await InventoryService.listSuppliers(req.merchantId!, {
      includeArchived: req.query.archived === "1",
    });
    res.json({ success: true, suppliers });
  } catch (error) {
    handleError(res, error, "Failed to list suppliers");
  }
});

router.post("/suppliers", async (req: Request, res: Response) => {
  try {
    const supplier = await InventoryService.createSupplier(req.merchantId!, req.body || {});
    res.status(201).json({ success: true, supplier });
  } catch (error) {
    handleError(res, error, "Failed to create supplier");
  }
});

router.get("/suppliers/:supplierId", async (req: Request, res: Response) => {
  try {
    const data = await InventoryService.getSupplier(req.merchantId!, req.params.supplierId);
    res.json({ success: true, ...data });
  } catch (error) {
    handleError(res, error, "Failed to load supplier");
  }
});

router.put("/suppliers/:supplierId", async (req: Request, res: Response) => {
  try {
    const supplier = await InventoryService.updateSupplier(
      req.merchantId!,
      req.params.supplierId,
      req.body || {}
    );
    res.json({ success: true, supplier });
  } catch (error) {
    handleError(res, error, "Failed to update supplier");
  }
});

router.delete("/suppliers/:supplierId", async (req: Request, res: Response) => {
  try {
    const result = await InventoryService.deleteSupplier(req.merchantId!, req.params.supplierId);
    res.json({ success: true, ...result });
  } catch (error) {
    handleError(res, error, "Failed to delete supplier");
  }
});

router.post("/suppliers/:supplierId/reorder-email", async (req: Request, res: Response) => {
  try {
    const result = await InventoryService.sendReorderEmail(req.merchantId!, {
      supplierId: req.params.supplierId,
      itemIds: Array.isArray(req.body?.itemIds) ? req.body.itemIds : undefined,
      force: true,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    handleError(res, error, "Failed to email supplier");
  }
});

router.get("/movements", async (req: Request, res: Response) => {
  try {
    const movements = await InventoryService.listMovements(
      req.merchantId!,
      typeof req.query.itemId === "string" ? req.query.itemId : undefined,
      Number(req.query.limit) || 200
    );
    res.json({ success: true, movements });
  } catch (error) {
    handleError(res, error, "Failed to list movements");
  }
});

router.post("/items/:itemId/stock-out", async (req: Request, res: Response) => {
  try {
    const item = await InventoryService.stockOut(req.merchantId!, req.params.itemId, {
      qty: Number(req.body?.qty),
      note: req.body?.note,
      reason: req.body?.reason === "out" ? "out" : "waste",
    });
    res.json({ success: true, item });
  } catch (error) {
    handleError(res, error, "Failed to record outbound");
  }
});

router.post("/items/:itemId/count", async (req: Request, res: Response) => {
  try {
    const item = await InventoryService.countStock(req.merchantId!, req.params.itemId, {
      realQty: Number(req.body?.realQty),
      note: req.body?.note,
    });
    res.json({ success: true, item });
  } catch (error) {
    handleError(res, error, "Failed to count stock");
  }
});

router.get("/categories", async (req: Request, res: Response) => {
  try {
    const categories = await InventoryService.listCategories(req.merchantId!);
    res.json({ success: true, categories });
  } catch (error) {
    handleError(res, error, "Failed to list categories");
  }
});

router.post("/categories", async (req: Request, res: Response) => {
  try {
    const category = await InventoryService.createCategory(req.merchantId!, req.body?.name);
    res.status(201).json({ success: true, category });
  } catch (error) {
    handleError(res, error, "Failed to create category");
  }
});

router.delete("/categories/:categoryId", async (req: Request, res: Response) => {
  try {
    await InventoryService.deleteCategory(req.merchantId!, req.params.categoryId);
    res.json({ success: true });
  } catch (error) {
    handleError(res, error, "Failed to delete category");
  }
});

router.get("/units", async (req: Request, res: Response) => {
  try {
    const data = await InventoryService.listUnits(req.merchantId!);
    res.json({ success: true, ...data });
  } catch (error) {
    handleError(res, error, "Failed to list units");
  }
});

router.post("/units", async (req: Request, res: Response) => {
  try {
    const unit = await InventoryService.createUnit(req.merchantId!, req.body || {});
    res.status(201).json({ success: true, unit });
  } catch (error) {
    handleError(res, error, "Failed to create unit");
  }
});

router.delete("/units/:unitId", async (req: Request, res: Response) => {
  try {
    await InventoryService.deleteUnit(req.merchantId!, req.params.unitId);
    res.json({ success: true });
  } catch (error) {
    handleError(res, error, "Failed to delete unit");
  }
});

router.post("/unit-ratios", async (req: Request, res: Response) => {
  try {
    const ratio = await InventoryService.createRatio(req.merchantId!, req.body || {});
    res.status(201).json({ success: true, ratio });
  } catch (error) {
    handleError(res, error, "Failed to create unit ratio");
  }
});

router.delete("/unit-ratios/:ratioId", async (req: Request, res: Response) => {
  try {
    await InventoryService.deleteRatio(req.merchantId!, req.params.ratioId);
    res.json({ success: true });
  } catch (error) {
    handleError(res, error, "Failed to delete unit ratio");
  }
});

router.get("/purchase-report", async (req: Request, res: Response) => {
  try {
    const report = await InventoryService.purchaseReport(
      req.merchantId!,
      Number(req.query.days) || 30
    );
    res.json({ success: true, report });
  } catch (error) {
    handleError(res, error, "Failed to load purchase report");
  }
});

router.get("/cookbook", denyInventoryRecipes, async (req: Request, res: Response) => {
  try {
    const entries = await InventoryService.listCookbook(req.merchantId!);
    res.json({ success: true, entries });
  } catch (error) {
    handleError(res, error, "Failed to load cookbook");
  }
});

router.get("/products/:productId/recipe", denyInventoryRecipes, async (req: Request, res: Response) => {
  try {
    const recipe = await InventoryService.getRecipe(req.merchantId!, req.params.productId);
    res.json({ success: true, recipe });
  } catch (error) {
    handleError(res, error, "Failed to load recipe");
  }
});

router.put("/products/:productId/recipe", denyInventoryRecipes, async (req: Request, res: Response) => {
  try {
    const recipe = await InventoryService.setRecipe(
      req.merchantId!,
      req.params.productId,
      req.body?.lines || [],
      req.body?.recipeYield != null ? Number(req.body.recipeYield) : undefined
    );
    res.json({ success: true, recipe });
  } catch (error) {
    handleError(res, error, "Failed to save recipe");
  }
});

/** Cross-location inventory transfers */
router.get("/transfers", async (req: Request, res: Response) => {
  try {
    const { InventoryTransferService } = await import("@/services/inventory-transfer.service");
    const status = req.query.status ? String(req.query.status) : undefined;
    const transfers = await InventoryTransferService.list(req.merchantId!, status);
    res.json({ success: true, transfers });
  } catch (error) {
    handleError(res, error, "Failed to list transfers");
  }
});

router.post("/transfers", async (req: Request, res: Response) => {
  try {
    const { InventoryTransferService } = await import("@/services/inventory-transfer.service");
    const body = req.body || {};
    const transfer = await InventoryTransferService.create(req.merchantId!, {
      fromLocationId: String(body.fromLocationId || ""),
      toLocationId: String(body.toLocationId || ""),
      itemId: String(body.itemId || ""),
      qty: Number(body.qty),
      note: body.note,
      staffId: req.user?.staffId || null,
      staffName: req.user?.name || null,
    });
    res.json({ success: true, transfer });
  } catch (error) {
    handleError(res, error, "Failed to create transfer");
  }
});

router.post("/transfers/:transferId/confirm", async (req: Request, res: Response) => {
  try {
    const { InventoryTransferService } = await import("@/services/inventory-transfer.service");
    const transfer = await InventoryTransferService.confirm(req.merchantId!, req.params.transferId);
    res.json({ success: true, transfer });
  } catch (error) {
    handleError(res, error, "Failed to confirm transfer");
  }
});

router.post("/transfers/:transferId/cancel", async (req: Request, res: Response) => {
  try {
    const { InventoryTransferService } = await import("@/services/inventory-transfer.service");
    const transfer = await InventoryTransferService.cancel(req.merchantId!, req.params.transferId);
    res.json({ success: true, transfer });
  } catch (error) {
    handleError(res, error, "Failed to cancel transfer");
  }
});

router.get("/location-stock/:locationId", async (req: Request, res: Response) => {
  try {
    const { InventoryTransferService } = await import("@/services/inventory-transfer.service");
    const stock = await InventoryTransferService.locationStockSummary(
      req.merchantId!,
      req.params.locationId
    );
    res.json({ success: true, stock });
  } catch (error) {
    handleError(res, error, "Failed to load location stock");
  }
});

router.post("/backfill-location-stock", async (req: Request, res: Response) => {
  try {
    const { InventoryTransferService } = await import("@/services/inventory-transfer.service");
    const result = await InventoryTransferService.backfillDefaultLocation(req.merchantId!);
    res.json({ success: true, ...result });
  } catch (error) {
    handleError(res, error, "Failed to backfill location stock");
  }
});

export default router;
