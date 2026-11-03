import { Router, Request, Response } from "express";
import { eq, and } from "drizzle-orm";
import {
  verifyToken,
  requireMerchant,
  setMerchantContext,
  requirePermission,
} from "@/middleware/auth.middleware";
import { PaymentProfilesService } from "@/services/payment-profiles.service";
import { getDb, schema } from "@/db";
import { MerchantSettingsService } from "@/services/merchant-settings.service";
import { AdyenMerchantWebhookService } from "@/services/adyen-merchant-webhook.service";
import { shouldWriteCredential } from "@/lib/merchant-settings-preserve";
import { setLocationContext } from "@/middleware/location.middleware";
import {
  branchPanelTerminalsContext,
  resolveBranchPanelSettingsLocationId,
} from "@/lib/branch-panel-settings";

const router = Router();

router.use(verifyToken);
router.use(requireMerchant);
router.use(setMerchantContext);
router.use(setLocationContext);

function maskSecret(value?: string | null): string | null {
  if (!value) return null;
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

function sanitizeTerminal(
  t: typeof schema.paymentTerminals.$inferSelect,
  defaultProfileId?: string | null
) {
  return {
    ...t,
    adyenApiKey: undefined,
    adyenApiKeyMasked: maskSecret(t.adyenApiKey),
    adyenApiKeySet: !!t.adyenApiKey,
    paymentProfileId: t.paymentProfileId || defaultProfileId || null,
  };
}

/**
 * GET /api/terminals
 * Includes merchant-level Adyen credentials summary.
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const merchantId = req.merchantId!;
    const branchLocationId = resolveBranchPanelSettingsLocationId(
      req.locationFromHeader,
      req.locationId
    );
    const { profileId: branchProfileId, filterByProfile } = branchLocationId
      ? await branchPanelTerminalsContext(merchantId, branchLocationId)
      : {
          profileId: await PaymentProfilesService.getDefaultProfileId(merchantId),
          filterByProfile: false,
        };
    const defaultProfileId = await PaymentProfilesService.getDefaultProfileId(merchantId);
    let terminals = await db.query.paymentTerminals.findMany({
      where: eq(schema.paymentTerminals.merchantId, merchantId),
    });
    if (filterByProfile) {
      terminals = terminals.filter(
        (t) => (t.paymentProfileId || defaultProfileId) === branchProfileId
      );
    }
    const settings = await MerchantSettingsService.getMerchantSettings(merchantId, {
      branchLocationId,
    });
    const webhookUrl = AdyenMerchantWebhookService.webhookUrlFromRequest(req.merchantId!, req);
    res.json({
      success: true,
      terminals: terminals.map((t) => sanitizeTerminal(t, defaultProfileId)),
      adyen: {
        merchantAccount: settings.adyenMerchantAccount,
        storeReference: settings.adyenStoreReference || "",
        apiKeyMasked: settings.adyenApiKeyMasked,
        apiKeySet: settings.adyenApiKeySet,
        clientId: settings.adyenClientId,
        hmacKeyMasked: settings.adyenHmacKeyMasked,
        hmacKeySet: settings.adyenHmacKeySet,
        liveUrlPrefix: settings.adyenLiveUrlPrefix || "",
        webhookUrl,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list terminals" });
  }
});

/**
 * PUT /api/terminals/adyen-credentials
 * Store merchant-level Adyen merchant account, API key, client ID, and webhook HMAC key.
 */
router.put("/adyen-credentials", requirePermission("MANAGE_SETTINGS"), async (req: Request, res: Response) => {
  try {
    const { adyenMerchantAccount, adyenApiKey, adyenClientId, adyenHmacKey, adyenLiveUrlPrefix, adyenStoreReference } =
      req.body;
    const branchLocationId = resolveBranchPanelSettingsLocationId(
      req.locationFromHeader,
      req.locationId
    );
    const settings = await MerchantSettingsService.updateMerchantSettings(
      req.merchantId!,
      {
        ...(shouldWriteCredential(adyenMerchantAccount) ? { adyenMerchantAccount } : {}),
        ...(shouldWriteCredential(adyenApiKey) ? { adyenApiKey } : {}),
        ...(shouldWriteCredential(adyenClientId) ? { adyenClientId } : {}),
        ...(shouldWriteCredential(adyenHmacKey) ? { adyenHmacKey } : {}),
        ...(typeof adyenLiveUrlPrefix === "string" && adyenLiveUrlPrefix.trim()
          ? { adyenLiveUrlPrefix }
          : {}),
        ...(typeof adyenStoreReference === "string" && adyenStoreReference.trim()
          ? { adyenStoreReference }
          : {}),
      },
      { branchLocationId }
    );
    res.json({
      success: true,
      adyen: {
        merchantAccount: settings.adyenMerchantAccount,
        storeReference: settings.adyenStoreReference || "",
        apiKeyMasked: settings.adyenApiKeyMasked,
        apiKeySet: settings.adyenApiKeySet,
        clientId: settings.adyenClientId,
        hmacKeyMasked: settings.adyenHmacKeyMasked,
        hmacKeySet: settings.adyenHmacKeySet,
        liveUrlPrefix: settings.adyenLiveUrlPrefix || "",
        webhookUrl: AdyenMerchantWebhookService.webhookUrlFromRequest(req.merchantId!, req),
      },
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to save Adyen credentials" });
  }
});

/**
 * POST /api/terminals
 * Register a payment terminal. Uses merchant-level Adyen credentials from Settings.
 * Only terminal ID is required (display name optional).
 */
router.post("/", requirePermission("MANAGE_SETTINGS"), async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    const branchLocationId = resolveBranchPanelSettingsLocationId(
      req.locationFromHeader,
      req.locationId
    );
    const { profileId: scopedProfileId } = branchLocationId
      ? await branchPanelTerminalsContext(merchantId, branchLocationId)
      : { profileId: await PaymentProfilesService.getDefaultProfileId(merchantId) };
    const defaultProfileId = await PaymentProfilesService.getDefaultProfileId(merchantId);
    const targetProfileId =
      req.body.paymentProfileId || scopedProfileId || defaultProfileId;
    const terminalId = String(req.body.terminalId || req.body.serialNumber || "").trim();
    const terminalName = String(req.body.terminalName || terminalId || "").trim();
    const serialNumber = String(req.body.serialNumber || terminalId || "").trim() || null;
    if (!terminalId) {
      return res.status(400).json({ error: "terminalId is required" });
    }
    const db = getDb();
    const [terminal] = await db
      .insert(schema.paymentTerminals)
      .values({
        merchantId: req.merchantId!,
        paymentProfileId: targetProfileId,
        terminalId,
        terminalName: terminalName || terminalId,
        serialNumber,
        // Always inherit Adyen account/API from merchant settings
        adyenMerchantAccount: null,
        adyenApiKey: null,
        adyenClientId: null,
        status: "active",
      })
      .onConflictDoUpdate({
        target: schema.paymentTerminals.terminalId,
        set: {
          terminalName: terminalName || terminalId,
          serialNumber,
          status: "active",
          lastHeartbeat: new Date(),
          paymentProfileId: targetProfileId,
        },
      })
      .returning();
    if (!terminal) {
      return res.status(500).json({ error: "Failed to register terminal" });
    }
    if (terminal.merchantId !== req.merchantId!) {
      return res.status(409).json({ error: "Terminal ID is already registered to another merchant" });
    }
    res.status(201).json({
      success: true,
      terminal: sanitizeTerminal(terminal, defaultProfileId),
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to register terminal" });
  }
});

/**
 * PUT /api/terminals/:id
 */
router.put("/:id", requirePermission("MANAGE_SETTINGS"), async (req: Request, res: Response) => {
  try {
    const defaultProfileId = await PaymentProfilesService.getDefaultProfileId(req.merchantId!);
    const db = getDb();
    const patch: Record<string, unknown> = {};
    if (req.body.terminalId !== undefined) patch.terminalId = String(req.body.terminalId).trim();
    if (req.body.terminalName !== undefined) patch.terminalName = req.body.terminalName;
    if (req.body.serialNumber !== undefined) patch.serialNumber = req.body.serialNumber;
    if (req.body.status !== undefined) patch.status = req.body.status;
    if (req.body.paymentProfileId !== undefined) {
      patch.paymentProfileId = req.body.paymentProfileId || defaultProfileId;
    }
    // Do not accept per-terminal Adyen credential overrides

    const [terminal] = await db
      .update(schema.paymentTerminals)
      .set(patch)
      .where(
        and(
          eq(schema.paymentTerminals.id, req.params.id),
          eq(schema.paymentTerminals.merchantId, req.merchantId!)
        )
      )
      .returning();
    if (!terminal) return res.status(404).json({ error: "Terminal not found" });
    res.json({ success: true, terminal: sanitizeTerminal(terminal, defaultProfileId) });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update terminal" });
  }
});

/**
 * DELETE /api/terminals/:id
 */
router.delete("/:id", requirePermission("MANAGE_SETTINGS"), async (req: Request, res: Response) => {
  try {
    const db = getDb();
    await db
      .delete(schema.paymentTerminals)
      .where(
        and(
          eq(schema.paymentTerminals.id, req.params.id),
          eq(schema.paymentTerminals.merchantId, req.merchantId!)
        )
      );
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to delete terminal" });
  }
});

export default router;
