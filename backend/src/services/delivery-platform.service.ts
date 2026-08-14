import { createHmac, timingSafeEqual } from "crypto";
import { v4 as uuidv4 } from "uuid";
import { getDb, schema } from "@/db";
import { and, eq } from "drizzle-orm";
import { roundMoney2 } from "@/lib/money";
import {
  getDeliveryPlatformPublic,
  mergeDeliveryPlatformSettings,
  normalizeDeliveryPlatformSettings,
  orderSourceFromPlatform,
  platformKeyFromSource,
  type DeliveryPlatformSettings,
  type OrderSource,
} from "@/lib/delivery-platform-settings";
import { normalizePosPrintSettings } from "@/lib/pos-print-settings";
import { MerchantSettingsService } from "@/services/merchant-settings.service";
import { ChaslayFloorService } from "@/services/chaslay-floor.service";

export type ExternalOrderLine = {
  productId?: string | null;
  sku?: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  selectedExtras?: Array<{ id: string; name: string; price: number }>;
  comboSelections?: Array<{
    slotName: string;
    productName: string;
    selectedExtras?: Array<{ id: string; name: string; price: number }>;
  }>;
};

export type ExternalOrderPayload = {
  externalOrderId: string;
  fulfillmentChannel?: "takeaway" | "dine_in" | "delivery";
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  shippingAddress?: string | null;
  notes?: string | null;
  items: ExternalOrderLine[];
  subtotal?: number;
  taxAmount?: number;
  deliveryFee?: number;
  tipAmount?: number;
  total?: number;
  scheduledFor?: string | null;
};

function verifyWebhookSecret(
  provided: string | undefined,
  expected: string | undefined,
  testMode: boolean
): boolean {
  if (testMode && process.env.DELIVERY_PLATFORMS_ALLOW_TEST_WEBHOOKS !== "false") {
    return true;
  }
  if (!expected) return false;
  const a = Buffer.from(String(provided || ""));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function verifyHmacSignature(
  rawBody: string,
  signature: string | undefined,
  secret: string | undefined
): boolean {
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const provided = signature.replace(/^sha256=/i, "").trim();
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
  } catch {
    return expected === provided;
  }
}

function lineSubtotal(line: ExternalOrderLine): number {
  const qty = Number(line.quantity) || 0;
  const unit = Number(line.unitPrice) || 0;
  return roundMoney2(qty * unit);
}

export class DeliveryPlatformService {
  static getPublicSettings(raw: unknown) {
    return getDeliveryPlatformPublic(raw);
  }

  static async updateSettings(
    merchantId: string,
    updates: DeliveryPlatformSettings
  ): Promise<DeliveryPlatformSettings> {
    const db = getDb();
    const current = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
      columns: { deliveryPlatformSettings: true },
    });
    if (!current) throw new Error("Merchant not found");
    const merged = mergeDeliveryPlatformSettings(current.deliveryPlatformSettings, updates);
    await db
      .update(schema.merchants)
      .set({ deliveryPlatformSettings: merged })
      .where(eq(schema.merchants.id, merchantId));
    return merged;
  }

  static async getPlatformConfig(merchantId: string, platform: string) {
    const source = orderSourceFromPlatform(platform);
    if (!source || source === "online_shop") {
      throw new Error("Unknown delivery platform");
    }
    const key = platformKeyFromSource(source);
    if (!key) throw new Error("Unknown delivery platform");

    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
      columns: { deliveryPlatformSettings: true, name: true },
    });
    if (!merchant) throw new Error("Merchant not found");

    const settings = normalizeDeliveryPlatformSettings(merchant.deliveryPlatformSettings);
    const cfg = settings[key] || {};
    return { merchant, source, key, cfg };
  }

  static async verifyWebhook(opts: {
    platform: string;
    merchantId: string;
    headers: Record<string, string | string[] | undefined>;
    rawBody: string;
  }): Promise<{ source: OrderSource; cfg: DeliveryPlatformSettings["justEat"] }> {
    const { source, cfg } = await DeliveryPlatformService.getPlatformConfig(
      opts.merchantId,
      opts.platform
    );

    if (!cfg.enabled) {
      throw new Error("Delivery platform integration is disabled");
    }

    const webhookSecret = String(
      opts.headers["x-webhook-secret"] ||
        opts.headers["x-chaslay-webhook-secret"] ||
        ""
    );
    const signature = String(
      opts.headers["x-signature"] ||
        opts.headers["x-hub-signature-256"] ||
        opts.headers["x-just-eat-signature"] ||
        opts.headers["x-uber-signature"] ||
        ""
    );

    const secretOk = verifyWebhookSecret(webhookSecret, cfg.webhookSecret || undefined, !!cfg.testMode);
    const hmacOk = verifyHmacSignature(opts.rawBody, signature, cfg.webhookSecret || undefined);

    if (!secretOk && !hmacOk && !cfg.testMode) {
      throw new Error("Invalid webhook signature");
    }

    return { source, cfg };
  }

  static normalizeWebhookPayload(body: unknown): ExternalOrderPayload {
    const o = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
    const externalOrderId = String(
      o.externalOrderId || o.external_order_id || o.id || o.orderId || o.order_id || ""
    ).trim();
    if (!externalOrderId) throw new Error("externalOrderId is required");

    const rawItems = Array.isArray(o.items) ? o.items : Array.isArray(o.lineItems) ? o.lineItems : [];
    const items: ExternalOrderLine[] = rawItems.map((row) => {
      const r = (row && typeof row === "object" ? row : {}) as Record<string, unknown>;
      const name = String(r.name || r.productName || r.title || "Item").trim();
      const quantity = Number(r.quantity ?? r.qty ?? 1) || 1;
      const unitPrice = Number(r.unitPrice ?? r.price ?? r.unit_price ?? 0) || 0;
      return {
        productId: r.productId != null ? String(r.productId) : null,
        sku: r.sku != null ? String(r.sku) : null,
        name,
        quantity,
        unitPrice,
        selectedExtras: Array.isArray(r.selectedExtras) ? (r.selectedExtras as ExternalOrderLine["selectedExtras"]) : [],
        comboSelections: Array.isArray(r.comboSelections)
          ? (r.comboSelections as ExternalOrderLine["comboSelections"])
          : [],
      };
    });
    if (!items.length) throw new Error("At least one order item is required");

    const channelRaw = String(o.fulfillmentChannel || o.channel || o.fulfillment || "delivery")
      .trim()
      .toLowerCase();
    const fulfillmentChannel =
      channelRaw === "pickup" || channelRaw === "takeaway"
        ? "takeaway"
        : channelRaw === "dine_in" || channelRaw === "dine-in"
          ? "dine_in"
          : "delivery";

    const subtotal =
      o.subtotal != null
        ? roundMoney2(Number(o.subtotal))
        : roundMoney2(items.reduce((s, i) => s + lineSubtotal(i), 0));
    const taxAmount = o.taxAmount != null ? roundMoney2(Number(o.taxAmount)) : 0;
    const deliveryFee = o.deliveryFee != null ? roundMoney2(Number(o.deliveryFee)) : 0;
    const tipAmount = o.tipAmount != null ? roundMoney2(Number(o.tipAmount)) : 0;
    const total =
      o.total != null
        ? roundMoney2(Number(o.total))
        : roundMoney2(subtotal + taxAmount + deliveryFee + tipAmount);

    return {
      externalOrderId,
      fulfillmentChannel,
      customerName: o.customerName != null ? String(o.customerName) : null,
      customerPhone: o.customerPhone != null ? String(o.customerPhone) : null,
      customerEmail: o.customerEmail != null ? String(o.customerEmail) : null,
      shippingAddress: o.shippingAddress != null ? String(o.shippingAddress) : null,
      notes: o.notes != null ? String(o.notes) : null,
      items,
      subtotal,
      taxAmount,
      deliveryFee,
      tipAmount,
      total,
      scheduledFor: o.scheduledFor != null ? String(o.scheduledFor) : null,
    };
  }

  static async ingestOrder(
    merchantId: string,
    source: OrderSource,
    payload: ExternalOrderPayload
  ) {
    const db = getDb();
    const key = platformKeyFromSource(source);
    if (!key) throw new Error("Unsupported order source");

    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
    });
    if (!merchant) throw new Error("Merchant not found");

    const platformSettings = normalizeDeliveryPlatformSettings(merchant.deliveryPlatformSettings);
    const cfg = platformSettings[key];
    if (!cfg?.enabled) {
      throw new Error(`${source} integration is disabled`);
    }

    const existing = await db.query.orders.findFirst({
      where: and(
        eq(schema.orders.merchantId, merchantId),
        eq(schema.orders.orderSource, source),
        eq(schema.orders.externalOrderId, payload.externalOrderId)
      ),
    });
    if (existing) {
      return { order: existing, created: false };
    }

    const channel = payload.fulfillmentChannel || "delivery";
    const taxRate = MerchantSettingsService.channelTaxRate(merchant, channel);
    const subtotal = payload.subtotal ?? 0;
    let taxAmount = payload.taxAmount ?? 0;

    if (taxAmount <= 0 && subtotal > 0 && taxRate > 0 && merchant.taxIncludedInPrice !== true) {
      taxAmount = roundMoney2(subtotal * (taxRate / 100));
    }

    const orderNumber = `${source.toUpperCase()}-${Date.now()}-${uuidv4().substring(0, 6).toUpperCase()}`;
    const status = cfg.autoAccept ? "preparing" : "pending_approval";
    const platformNote = `[${source}:${payload.externalOrderId}]`;
    const notes = [platformNote, payload.notes].filter(Boolean).join("\n");

    const [order] = await db
      .insert(schema.orders)
      .values({
        merchantId,
        orderNumber,
        orderType: "web_shop",
        orderSource: source,
        externalOrderId: payload.externalOrderId,
        fulfillmentChannel: channel,
        status,
        subtotal: subtotal.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        discountAmount: "0",
        deliveryFee: (payload.deliveryFee ?? 0).toFixed(2),
        tipAmount: (payload.tipAmount ?? 0).toFixed(2),
        total: (payload.total ?? subtotal + taxAmount).toFixed(2),
        paymentMethod: "online",
        paymentStatus: "completed",
        notes,
        shippingAddress: payload.shippingAddress,
        scheduledFor: payload.scheduledFor ? new Date(payload.scheduledFor) : null,
        customerName: payload.customerName,
        customerPhone: payload.customerPhone,
        customerEmail: payload.customerEmail,
      })
      .returning();

    for (const line of payload.items) {
      let productId: string | null = line.productId || null;
      if (!productId && line.sku) {
        const product = await db.query.products.findFirst({
          where: and(
            eq(schema.products.merchantId, merchantId),
            eq(schema.products.sku, line.sku)
          ),
          columns: { id: true },
        });
        productId = product?.id || null;
      }

      const qty = Number(line.quantity) || 1;
      const unit = Number(line.unitPrice) || 0;
      const lineTotal = lineSubtotal(line);
      const lineTax =
        taxRate > 0 && merchant.taxIncludedInPrice !== true
          ? roundMoney2(lineTotal * (taxRate / 100))
          : 0;

      await db.insert(schema.orderItems).values({
        orderId: order.id,
        productId,
        productName: line.name,
        quantity: qty.toString(),
        unitPrice: unit.toFixed(2),
        totalPrice: lineTotal.toFixed(2),
        taxAmount: lineTax.toFixed(2),
        selectedExtras: line.selectedExtras || [],
        comboSelections: line.comboSelections || [],
      });
    }

    await DeliveryPlatformService.enqueueAutoPrint(merchantId, order.id, source);

    return { order, created: true };
  }

  static async enqueueAutoPrint(
    merchantId: string,
    orderId: string,
    orderSource: OrderSource
  ) {
    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
      columns: { posPrintSettings: true },
    });
    if (!merchant) return;

    const printSettings = normalizePosPrintSettings(merchant.posPrintSettings);
    const printKitchen = printSettings.autoPrintKitchen !== false;
    const printReceipt = printSettings.autoPrintReceipt !== false;
    if (!printKitchen && !printReceipt) return;

    await ChaslayFloorService.createPrintJob(merchantId, {
      jobType: "ESCPOS",
      payload: {
        kind: "auto_print_order",
        orderId,
        printKitchen,
        printReceipt,
        orderSource,
      },
      orderId,
      sourceDeviceId: "delivery-platform",
    });
  }

  static webhookUrl(platform: string, merchantId: string): string {
    const base =
      process.env.PUBLIC_APP_URL ||
      process.env.MERCHANT_DASHBOARD_URL ||
      "https://api.chaslay.com";
    const apiBase = base.replace(/\/$/, "").includes("api.")
      ? base.replace(/\/$/, "")
      : `${base.replace(/\/$/, "")}/api`;
    const slug = String(platform).toLowerCase().replace(/_/g, "-");
    return `${apiBase}/webhooks/${slug}/${merchantId}`;
  }
}
