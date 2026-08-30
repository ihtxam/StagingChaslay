import { Router, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { verifyToken, requireMerchant, setMerchantContext } from "@/middleware/auth.middleware";
import { getDb, schema } from "@/db";
import { createSoftPosSession, buildSaleRequest } from "@/services/adyen-softpos.service";

/**
 * Adyen Tap to Pay (SoftPOS) endpoints for the Android POS, mounted at
 * /api/tap-to-pay. Guarded by the merchant dashboard JWT (same token the app
 * stores at online login) and scoped to the caller's merchant.
 *
 * Re-implemented for FoodTruckPOS from the Laravel adyen-api reference; that
 * project is untouched.
 */
const router = Router();

/** Short-lived idempotency cache for /sale retries (network blips on mobile). */
const saleIdempotencyCache = new Map<string, { payload: Record<string, unknown>; expiresAt: number }>();
const SALE_CACHE_TTL_MS = 60_000;

function getCachedSale(key: string): Record<string, unknown> | null {
  const entry = saleIdempotencyCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    saleIdempotencyCache.delete(key);
    return null;
  }
  return entry.payload;
}

function setCachedSale(key: string, payload: Record<string, unknown>): void {
  saleIdempotencyCache.set(key, { payload, expiresAt: Date.now() + SALE_CACHE_TTL_MS });
}

router.use(verifyToken);
router.use(requireMerchant);
router.use(setMerchantContext);

async function loadMerchant(merchantId: string) {
  const db = getDb();
  return db.query.merchants.findFirst({
    where: eq(schema.merchants.id, merchantId),
  });
}

function tapToPayBlocked(merchant: NonNullable<Awaited<ReturnType<typeof loadMerchant>>>) {
  if (merchant.tapToPayEnabled !== true) {
    return "Tap to Pay is disabled for this merchant.";
  }
  if (!merchant.adyenApiKey || !merchant.adyenMerchantAccount) {
    return "Adyen credentials are not configured for this merchant.";
  }
  return null;
}

const sessionSchema = z.object({
  setup_token: z.string().min(1),
  platform: z.enum(["ios", "android"]),
});

/**
 * POST /api/tap-to-pay/sessions
 * Exchange a Mobile-SDK setupToken for sdkData + installationId.
 */
router.post("/sessions", async (req: Request, res: Response) => {
  const parsed = sessionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({ error: "Invalid request", details: parsed.error.flatten() });
  }

  const merchant = await loadMerchant(req.merchantId!);
  if (!merchant) {
    return res.status(422).json({ error: "No merchant account." });
  }

  const blocked = tapToPayBlocked(merchant);
  if (blocked) {
    return res.status(403).json({ error: blocked, code: "tap_to_pay_disabled" });
  }

  try {
    const session = await createSoftPosSession(merchant, parsed.data.setup_token);
    return res.json({
      sdk_data: session.sdkData,
      installation_id: session.installationId,
    });
  } catch (error) {
    return res.status(422).json({
      error: error instanceof Error ? error.message : "SoftPOS session failed.",
    });
  }
});

const saleSchema = z.object({
  amount_minor: z.number().int().min(1),
  currency: z.string().length(3),
  reference: z.string().max(80).optional(),
  platform: z.enum(["ios", "android"]),
  installation_id: z.string().max(128),
});

/**
 * POST /api/tap-to-pay/sale
 * Build (not submit) the nexo Terminal API envelope for the mobile SDK.
 */
router.post("/sale", async (req: Request, res: Response) => {
  const parsed = saleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({ error: "Invalid request", details: parsed.error.flatten() });
  }

  const merchant = await loadMerchant(req.merchantId!);
  if (!merchant) {
    return res.status(422).json({ error: "No merchant account." });
  }

  const blocked = tapToPayBlocked(merchant);
  if (blocked) {
    return res.status(403).json({ error: blocked, code: "tap_to_pay_disabled" });
  }

  const { amount_minor, currency, reference, installation_id, platform } = parsed.data;
  const ref = reference ?? "";
  const cacheKey =
    ref !== ""
      ? `softpos:sale:${req.user?.id || req.merchantId}:${ref}:${amount_minor}:${currency.toUpperCase()}:${platform}`
      : null;

  if (cacheKey) {
    const cached = getCachedSale(cacheKey);
    if (cached) return res.json(cached);
  }

  const built = buildSaleRequest(
    merchant,
    installation_id,
    amount_minor,
    currency.toUpperCase(),
    ref,
  );

  const payload = {
    terminal_api_request: built.request,
    service_id: built.serviceId,
    transaction_id: built.transactionId,
  };

  if (cacheKey) {
    setCachedSale(cacheKey, payload);
  }

  return res.json(payload);
});

export default router;
