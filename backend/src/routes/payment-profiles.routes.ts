import { Router, Request, Response } from "express";
import { requirePermission } from "@/middleware/auth.middleware";
import { PaymentProfilesService } from "@/services/payment-profiles.service";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const locationId = req.query.locationId ? String(req.query.locationId) : undefined;
    const profiles = await PaymentProfilesService.list(req.merchantId!, {
      locationId,
    });
    res.json({ success: true, profiles });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to list payment profiles",
    });
  }
});

router.get("/terminals", async (req: Request, res: Response) => {
  try {
    const terminals = await PaymentProfilesService.listTerminals(req.merchantId!, {
      paymentProfileId: req.query.paymentProfileId
        ? String(req.query.paymentProfileId)
        : undefined,
      locationId: req.query.locationId ? String(req.query.locationId) : undefined,
    });
    res.json({ success: true, terminals });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to list terminals",
    });
  }
});

router.post("/", requirePermission("MANAGE_SETTINGS"), async (req: Request, res: Response) => {
  try {
    const profile = await PaymentProfilesService.create(req.merchantId!, req.body || {});
    res.status(201).json({ success: true, profile });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to create payment profile",
    });
  }
});

router.put("/:id", requirePermission("MANAGE_SETTINGS"), async (req: Request, res: Response) => {
  try {
    const profile = await PaymentProfilesService.update(
      req.merchantId!,
      req.params.id,
      req.body || {}
    );
    res.json({ success: true, profile });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to update payment profile",
    });
  }
});

router.delete("/:id", requirePermission("MANAGE_SETTINGS"), async (req: Request, res: Response) => {
  try {
    await PaymentProfilesService.delete(req.merchantId!, req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to delete payment profile",
    });
  }
});

router.put(
  "/:id/terminals",
  requirePermission("MANAGE_SETTINGS"),
  async (req: Request, res: Response) => {
    try {
      const terminalIds = Array.isArray(req.body?.terminalIds) ? req.body.terminalIds : [];
      const result = await PaymentProfilesService.assignTerminals(
        req.merchantId!,
        req.params.id,
        terminalIds
      );
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : "Failed to assign terminals",
      });
    }
  }
);

export default router;
