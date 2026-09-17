import { Router, Request, Response } from "express";
import { AdyenPayAtXService } from "@/services/adyen-pay-at-x.service";

const router = Router();

/**
 * POST /api/webhooks/adyen-terminal/:merchantId
 * Adyen Terminal API event notifications (SaleWakeUp, PaymentResponse, InputResponse).
 * Configure in Adyen Customer Area > Devices > Terminal API > Event URLs.
 */
router.post("/adyen-terminal/:merchantId", (req: Request, res: Response) => {
  const merchantId = String(req.params.merchantId || "").trim();
  if (!merchantId) {
    return res.status(400).json({ status: "invalid" });
  }

  res.status(202).json({ status: "accepted" });

  void (async () => {
    try {
      await AdyenPayAtXService.handleWebhookBody(merchantId, req.body || {});
    } catch (error) {
      console.error(`[pay-at-x] webhook error (${merchantId}):`, error);
    }
  })();
});

export default router;
