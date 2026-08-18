import { Router, Request, Response } from "express";
import { verifyToken, requireMerchant, setMerchantContext } from "@/middleware/auth.middleware";
import { InventoryLicenseError, InventoryService } from "@/services/inventory.service";

const router = Router();

router.use(verifyToken);
router.use(requireMerchant);
router.use(setMerchantContext);

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
    res.json({ success: true, ...license });
  } catch (error) {
    handleError(res, error, "Failed to load inventory status");
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

router.get("/usage", async (req: Request, res: Response) => {
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

router.get("/products/:productId/recipe", async (req: Request, res: Response) => {
  try {
    const recipe = await InventoryService.getRecipe(req.merchantId!, req.params.productId);
    res.json({ success: true, recipe });
  } catch (error) {
    handleError(res, error, "Failed to load recipe");
  }
});

router.put("/products/:productId/recipe", async (req: Request, res: Response) => {
  try {
    const recipe = await InventoryService.setRecipe(
      req.merchantId!,
      req.params.productId,
      req.body?.lines || []
    );
    res.json({ success: true, recipe });
  } catch (error) {
    handleError(res, error, "Failed to save recipe");
  }
});

export default router;
