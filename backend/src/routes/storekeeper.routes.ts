import { Router, Request, Response } from "express";
import { verifyToken, requireMerchant, requirePermission, setMerchantContext } from "@/middleware/auth.middleware";
import { InventoryLicenseError, InventoryService } from "@/services/inventory.service";
import {
  BarcodeProductLookupService,
  matchInventoryCategoryId,
} from "@/services/barcode-product-lookup.service";
import { ProductService } from "@/services/product.service";

const router = Router();

router.use(verifyToken);
router.use(requireMerchant);
router.use(setMerchantContext);
router.use(requirePermission("STOREKEEPER_INTAKE", "MANAGE_INVENTORY"));

function handleError(res: Response, error: unknown, fallback: string) {
  if (error instanceof InventoryLicenseError) {
    return res.status(403).json({ error: error.message, code: "INVENTORY_ADDON_REQUIRED" });
  }
  const message = error instanceof Error ? error.message : fallback;
  const status = /not found/i.test(message) ? 404 : 400;
  return res.status(status).json({ error: message });
}

/** GET /api/merchant/storekeeper/bootstrap — categories, units, license. */
router.get("/bootstrap", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const data = await InventoryService.getStorekeeperBootstrap(merchantId);
    res.json({ success: true, ...data });
  } catch (error) {
    handleError(res, error, "Failed to load storekeeper data");
  }
});

/** GET /api/merchant/storekeeper/lookup/:barcode — local stock, then online product DB. */
router.get("/lookup/:barcode", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const barcode = String(req.params.barcode || "").trim();
    const [item, menuProduct] = await Promise.all([
      InventoryService.getItemByBarcode(merchantId, barcode),
      ProductService.getProductByBarcode(merchantId, barcode),
    ]);
    const menuProductSummary = menuProduct
      ? {
          id: menuProduct.id,
          name: menuProduct.name,
          price: Number(menuProduct.price) || 0,
          imageUrl: menuProduct.imageUrl || null,
        }
      : null;

    if (item) {
      return res.json({
        success: true,
        item,
        menuProduct: menuProductSummary,
        suggestion: null,
        source: "local",
      });
    }

    const bootstrap = await InventoryService.getStorekeeperBootstrap(merchantId);
    const suggestion = await BarcodeProductLookupService.lookupExternal(barcode);
    if (!suggestion) {
      return res.json({
        success: true,
        item: null,
        menuProduct: menuProductSummary,
        suggestion: null,
        source: menuProductSummary ? "menu" : null,
      });
    }

    const categoryId = matchInventoryCategoryId(bootstrap.categories, suggestion.categoryHint);
    res.json({
      success: true,
      item: null,
      menuProduct: menuProductSummary,
      suggestion: { ...suggestion, categoryId },
      source: suggestion.source,
    });
  } catch (error) {
    handleError(res, error, "Barcode lookup failed");
  }
});

/** POST /api/merchant/storekeeper/intake — scan/create item and receive stock. */
router.post("/intake", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const result = await InventoryService.storekeeperIntake(merchantId, req.body || {});
    res.json({ success: true, ...result });
  } catch (error) {
    handleError(res, error, "Stock intake failed");
  }
});

export default router;
