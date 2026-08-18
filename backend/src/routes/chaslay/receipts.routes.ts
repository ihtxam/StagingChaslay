import { Router, Request, Response } from "express";
import { and, eq, or } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireChaslayApiKey } from "@/middleware/chaslay-api-key.middleware";
import { buildReceiptPublicUrl, normalizeReceiptPublicUrl } from "@/lib/receipt-public-url";
import { SyncService } from "@/services/sync.service";
import { EmailService } from "@/services/email.service";

const router = Router();

async function findOrderForReceipt(merchantId: string, ref: string) {
  const db = getDb();
  const looksLikeUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ref);

  return db.query.orders.findFirst({
    where: and(
      eq(schema.orders.merchantId, merchantId),
      looksLikeUuid
        ? or(
            eq(schema.orders.id, ref),
            eq(schema.orders.orderNumber, ref),
            eq(schema.orders.clientId, ref)
          )
        : or(eq(schema.orders.orderNumber, ref), eq(schema.orders.clientId, ref))
    ),
    with: { merchant: true },
  });
}

router.post("/", requireChaslayApiKey, async (req: Request, res: Response) => {
  try {
    const body = req.body ?? {};
    const id = String(body.id || body.transaction_number || "").trim();
    if (!id) {
      return res.status(400).json({ error: "id is required" });
    }

    const orderNumber = String(
      body.transaction_number || body.orderNumber || body.order_number || id
    ).trim();
    const items = Array.isArray(body.items) ? body.items : [];
    const subtotal = Number(body.subtotal ?? body.total ?? 0);
    const taxTotal = Number(body.tax_total ?? 0);
    const total = Number(body.total ?? subtotal + taxTotal);
    const discountAmount = Number(body.discount_amount ?? body.item_discount_total ?? 0);
    const tipAmount = Number(body.tip_amount ?? body.tipAmount ?? 0);
    const paymentMethod = String(body.payment_method || "cash").toLowerCase();
    const isPending =
      paymentMethod === "pending" ||
      paymentMethod === "pay_later" ||
      paymentMethod === "invoice";
    const paymentBreakdown = Array.isArray(body.payment_breakdown)
      ? body.payment_breakdown
          .map((row: { method?: string; amount?: number }) => ({
            method: String(row?.method || "").trim().toLowerCase(),
            amount: Number(row?.amount || 0),
          }))
          .filter((row: { method: string; amount: number }) => row.method && row.amount > 0)
      : undefined;

    const pushResults = await SyncService.pushSales(req.chaslayMerchantId!, [
      {
        clientId: id,
        orderNumber,
        paymentMethod,
        paymentBreakdown: paymentBreakdown?.length ? paymentBreakdown : undefined,
        paymentStatus: isPending ? "awaiting_payment" : "completed",
        subtotal,
        taxAmount: taxTotal,
        discountAmount,
        tipAmount,
        total,
        completedAt: body.created_at || Date.now(),
        customerId: body.customer_id || body.customerId || null,
        customerName: body.customer_name || body.customerName || null,
        customerPhone: body.customer_phone || body.customerPhone || null,
        customerEmail: body.customer_email || body.customerEmail || null,
        shippingAddress: body.shipping_address || body.shippingAddress || null,
        items: items.map((item: any) => ({
          productName: item.product_name || item.productName || "Item",
          quantity: Number(item.quantity || 1),
          unitPrice: Number(item.unit_price ?? item.unitPrice ?? 0),
          totalPrice: Number(item.line_total ?? item.lineTotal ?? 0),
          weightKg:
            item.weight_kg != null
              ? Number(item.weight_kg)
              : item.weightKg != null
                ? Number(item.weightKg)
                : undefined,
        })),
      },
    ]);

    const pushed = pushResults[0];
    if (!pushed?.orderId || pushed.skipped) {
      return res.status(400).json({
        error: "Receipt could not be saved (empty or invalid sale data)",
      });
    }

    const order =
      (await findOrderForReceipt(req.chaslayMerchantId!, pushed.orderId)) ||
      (await findOrderForReceipt(req.chaslayMerchantId!, id));
    if (!order) {
      return res.status(502).json({ error: "Receipt publish failed — order not found after sync" });
    }

    const url = buildReceiptPublicUrl(order.id);
    let invoiceNumber: string | null = order.invoiceNumber || null;
    if (paymentMethod === "invoice") {
      try {
        const { InvoiceService } = await import("@/services/invoice.service");
        invoiceNumber = await InvoiceService.ensureInvoiceNumber(req.chaslayMerchantId!, order.id);
      } catch (err) {
        console.warn("[receipts] invoice number assign failed:", err);
      }
    }
    res.status(201).json({
      id: order.id,
      clientId: id,
      url,
      invoiceNumber,
      invoicePdfPath: paymentMethod === "invoice" ? `/v1/invoices/${order.id}/pdf` : null,
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Receipt publish failed" });
  }
});

router.post("/:id/email", requireChaslayApiKey, async (req: Request, res: Response) => {
  try {
    const receiptId = String(req.params.id || "").trim();
    const email = String(req.body?.email || "").trim();
    const customerName = String(req.body?.customerName || req.body?.customer_name || "").trim();

    if (!receiptId) {
      return res.status(400).json({ success: false, message: "Receipt id is required" });
    }
    if (!email.includes("@")) {
      return res.status(400).json({ success: false, message: "Valid email required" });
    }

    const order = await findOrderForReceipt(req.chaslayMerchantId!, receiptId);
    const merchant = req.chaslayMerchant;
    const shopName = order?.merchant?.name || merchant?.name || "Shop";
    const receiptUrl = normalizeReceiptPublicUrl("", order?.id || receiptId);
    const orderNumber = String(
      req.body?.orderNumber || req.body?.transaction_number || order?.orderNumber || receiptId
    ).trim();
    const amount =
      req.body?.amount != null && Number.isFinite(Number(req.body.amount))
        ? Number(req.body.amount)
        : order?.total != null
          ? Number(order.total)
          : null;

    const subject = [shopName, orderNumber ? `#${orderNumber}` : null, "Receipt"].filter(Boolean).join(" · ");
    const greeting = customerName ? `Hi ${customerName},` : "Hello,";
    const amountLine =
      amount != null
        ? `<p style="font-size:18px;font-weight:700;margin:12px 0;">CHF ${amount.toFixed(2)}</p>`
        : "";

    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#1c1917;">
        <h2 style="margin:0 0 8px;">${shopName}</h2>
        <p style="margin:0;color:#57534e;">${greeting} here is your receipt${orderNumber ? ` for order ${orderNumber}` : ""}.</p>
        ${amountLine}
        <p><a href="${receiptUrl}" style="display:inline-block;padding:10px 16px;background:#0f766e;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">View receipt</a></p>
        <p style="color:#666;font-size:12px;word-break:break-all;">${receiptUrl}</p>
      </div>
    `;
    const text =
      `${shopName}\n${greeting}\nYour receipt${orderNumber ? ` for order ${orderNumber}` : ""}\n` +
      (amount != null ? `CHF ${amount.toFixed(2)}\n` : "") +
      `${receiptUrl}\n`;

    await EmailService.send({
      merchantId: req.chaslayMerchantId!,
      to: email,
      subject,
      html,
      text,
    });

    res.json({ success: true, message: `Receipt sent to ${email}`, url: receiptUrl });
  } catch (error) {
    console.error("Chaslay receipt email failed:", error);
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Could not send receipt email",
    });
  }
});

export default router;
