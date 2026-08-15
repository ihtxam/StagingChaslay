import { Router, Request, Response } from "express";
import { verifyToken, requireMerchant, setMerchantContext } from "@/middleware/auth.middleware";
import { VoucherService } from "@/services/voucher.service";

const router = Router();

router.use(verifyToken, requireMerchant, setMerchantContext);

router.get("/", async (req: Request, res: Response) => {
  try {
    const vouchers = await VoucherService.list(req.merchantId!);
    res.json({ success: true, vouchers });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list vouchers" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const voucher = await VoucherService.create(req.merchantId!, req.body || {});
    res.status(201).json({ success: true, voucher });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create voucher" });
  }
});

router.get("/:voucherId/redemptions", async (req: Request, res: Response) => {
  try {
    const redemptions = await VoucherService.listRedemptions(
      req.merchantId!,
      req.params.voucherId
    );
    res.json({ success: true, redemptions });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to load redemptions" });
  }
});

router.put("/:voucherId", async (req: Request, res: Response) => {
  try {
    const voucher = await VoucherService.update(req.merchantId!, req.params.voucherId, req.body || {});
    res.json({ success: true, voucher });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update voucher" });
  }
});

router.delete("/:voucherId", async (req: Request, res: Response) => {
  try {
    await VoucherService.remove(req.merchantId!, req.params.voucherId);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to delete voucher" });
  }
});

export default router;
