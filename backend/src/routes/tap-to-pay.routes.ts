import { Router, Request, Response } from "express";
import { z } from "zod";
import { verifyToken, requireMerchant, setMerchantContext } from "@/middleware/auth.middleware";
import { eq, or, and } from "drizzle-orm";
import {
  createSoftPosSession,
  buildSaleRequest,
  buildReversalRequest,
  syncTerminalApiRequest,
} from "@/services/adyen-softpos.service";
import { getDb, schema } from "@/db";

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

const refundSchema = z.object({
  reference: z.string().max(80).optional(),
  psp_reference: z.string().max(255).optional(),
  original_service_id: z.string().max(128).optional(),
  amount_minor: z.number().int().min(1),
  currency: z.string().length(3).optional(),
  platform: z.enum(["ios", "android"]),
  installation_id: z.string().max(128),
});

/**
 * POST /api/tap-to-pay/refund
 * Refund a prior SoftPOS sale via Terminal API ReversalRequest.
 */
router.post("/refund", async (req: Request, res: Response) => {
  const parsed = refundSchema.safeParse(req.body);
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

  const {
    reference,
    psp_reference,
    original_service_id,
    amount_minor,
    currency,
    installation_id,
  } = parsed.data;

  const ref = (reference || psp_reference || "").trim();
  if (!ref && !original_service_id) {
    return res.status(422).json({
      error: "reference, psp_reference, or original_service_id is required.",
    });
  }

  const db = getDb();
  let originalServiceId = original_service_id?.trim() || "";
  let resolvedCurrency = (currency || "CHF").toUpperCase();

  if (!originalServiceId && ref) {
    const order = await db.query.orders.findFirst({
      where: and(
        eq(schema.orders.merchantId, req.merchantId!),
        or(eq(schema.orders.clientId, ref), eq(schema.orders.adyenReference, ref)),
      ),
    });

    if (order) {
      const payments = await db.query.paymentTransactions.findMany({
        where: and(
          eq(schema.paymentTransactions.merchantId, req.merchantId!),
          eq(schema.paymentTransactions.orderId, order.id),
        ),
        limit: 1,
      });
      const payment = payments[0];
      if (payment?.adyenReference) {
        originalServiceId = payment.adyenReference;
      }
      if (payment?.currency) {
        resolvedCurrency = payment.currency.toUpperCase();
      }
    }

    if (!originalServiceId) {
      originalServiceId = ref;
    }
  }

  const built = buildReversalRequest(
    merchant,
    installation_id,
    originalServiceId,
    amount_minor,
    resolvedCurrency,
  );

  try {
    const terminalResponse = await syncTerminalApiRequest(merchant, built.request);
    return res.json({
      reference: ref || null,
      original_service_id: originalServiceId,
      terminal_api_response: terminalResponse,
    });
  } catch (error) {
    return res.status(422).json({
      error: error instanceof Error ? error.message : "SoftPOS refund failed.",
    });
  }
});

const receiptEmailSchema = z.object({
  reference: z.string().min(1).max(80),
  email: z.string().email().max(254),
});

async function findSoftPosSale(merchantId: string, reference: string) {
  const db = getDb();
  const ref = reference.trim();
  if (!ref) return null;

  for (let attempt = 0; attempt < 6; attempt++) {
    const order = await db.query.orders.findFirst({
      where: and(
        eq(schema.orders.merchantId, merchantId),
        or(eq(schema.orders.clientId, ref), eq(schema.orders.adyenReference, ref)),
      ),
      with: { items: true },
    });
    if (order) return order;
    if (attempt < 5) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return null;
}

/**
 * GET /api/tap-to-pay/receipt?reference=
 * Return receipt metadata for a SoftPOS sale (public receipt URL + order summary).
 */
router.get("/receipt", async (req: Request, res: Response) => {
  const reference = String(req.query.reference || "").trim();
  if (!reference) {
    return res.status(422).json({ error: "reference query parameter is required." });
  }

  const merchant = await loadMerchant(req.merchantId!);
  if (!merchant) {
    return res.status(422).json({ error: "No merchant account." });
  }

  const blocked = tapToPayBlocked(merchant);
  if (blocked) {
    return res.status(403).json({ error: blocked, code: "tap_to_pay_disabled" });
  }

  const order = await findSoftPosSale(req.merchantId!, reference);
  if (!order) {
    return res.status(404).json({
      error: "Transaction not found yet — try again in a moment.",
    });
  }

  const { receiptPublicUrl } = await import("@/lib/receipt-public-url");
  const receiptRef = order.clientId || order.id;
  const receiptUrl = receiptPublicUrl(receiptRef);

  return res.json({
    reference,
    order_id: order.id,
    order_number: order.orderNumber,
    amount: Number(order.total),
    currency: "CHF",
    payment_method: order.paymentMethod,
    receipt_url: receiptUrl,
    created_at: order.createdAt?.toISOString() || null,
    items: (order.items || []).map((item) => ({
      name: item.productName,
      quantity: Number(item.quantity),
      line_total: Number(item.totalPrice),
    })),
  });
});

/**
 * POST /api/tap-to-pay/receipt
 * Email a receipt link for a SoftPOS sale (waits briefly for webhook-created order).
 */
router.post("/receipt", async (req: Request, res: Response) => {
  const parsed = receiptEmailSchema.safeParse(req.body);
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

  const order = await findSoftPosSale(req.merchantId!, parsed.data.reference);
  if (!order) {
    return res.status(404).json({
      error: "Transaction not found yet — try again in a moment.",
    });
  }

  const { receiptPublicUrl } = await import("@/lib/receipt-public-url");
  const receiptRef = order.clientId || order.id;
  const receiptUrl = receiptPublicUrl(receiptRef);
  const amount = Number(order.total) || 0;
  const shopName = merchant.name || "Shop";
  const orderNumber = order.orderNumber || "";
  const subject = [shopName, orderNumber ? `#${orderNumber}` : null, "Receipt"]
    .filter(Boolean)
    .join(" · ");

  const amountLine =
    amount > 0
      ? `<p style="font-size:18px;font-weight:700;margin:12px 0;">CHF ${amount.toFixed(2)}</p>`
      : "";
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#1c1917;">
      <h2 style="margin:0 0 8px;">${shopName}</h2>
      <p style="margin:0;color:#57534e;">Your receipt${orderNumber ? ` for order ${orderNumber}` : ""}</p>
      ${amountLine}
      <p><a href="${receiptUrl}" style="display:inline-block;padding:10px 16px;background:#0f766e;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">View receipt</a></p>
      <p style="color:#666;font-size:12px;word-break:break-all;">${receiptUrl}</p>
    </div>
  `;
  const text =
    `${shopName}\nYour receipt${orderNumber ? ` for order ${orderNumber}` : ""}\n` +
    (amount > 0 ? `CHF ${amount.toFixed(2)}\n` : "") +
    `${receiptUrl}\n`;

  try {
    const { EmailService } = await import("@/services/email.service");
    await EmailService.send({
      merchantId: req.merchantId!,
      to: parsed.data.email,
      subject,
      html,
      text,
    });
  } catch (error) {
    console.error("[tap-to-pay/receipt] email failed:", error);
    return res.status(500).json({ error: "Could not send receipt." });
  }

  return res.json({ sent: true, order_id: order.id, receipt_url: receiptUrl });
});

export default router;
