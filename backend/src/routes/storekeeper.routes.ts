import { Router, Request, Response } from "express";
import { verifyToken, requireMerchant, requirePermission, setMerchantContext } from "@/middleware/auth.middleware";
import { InventoryLicenseError, InventoryService } from "@/services/inventory.service";

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

/** GET /api/merchant/storekeeper/lookup/:barcode */
router.get("/lookup/:barcode", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const item = await InventoryService.getItemByBarcode(merchantId, req.params.barcode);
    res.json({ success: true, item });
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
