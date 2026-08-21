import { Router, Request, Response } from "express";
import { getDb, schema } from "@/db";
import { eq, or, sql } from "drizzle-orm";
import { resolveOrderItemName } from "@/lib/order-item-name";
import {
  adyenReceiptToPlainText,
  parseAdyenReceiptJson,
  type AdyenTerminalReceipt,
} from "@/lib/adyen-receipt";
import { MerchantSettingsService } from "@/services/merchant-settings.service";

const router = Router();

/** Any hex UUID (v1–v8), not just RFC 4122 v1–v5. Postgres accepts all of these. */
function isPgUuid(ref: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref);
}

type ReceiptOrderRow = {
  id: string;
  clientId: string | null;
  orderNumber: string;
  notes: string | null;
  customerName: string | null;
  fulfillmentChannel: string | null;
  paymentMethod: string | null;
  paymentStatus: string | null;
  status: string | null;
  subtotal: string | number | null;
  taxAmount: string | number | null;
  discountAmount: string | number | null;
  total: string | number | null;
  tipAmount: string | number | null;
  roundingAmount: string | number | null;
  tableLabel: string | null;
  guestCount: number | null;
  completedAt: Date | string | null;
  createdAt: Date | string | null;
  pointsEarned: number | null;
  adyenCustomerReceiptJson: string | null;
  businessName: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  vatNumber: string | null;
  vatRate: string | number | null;
  taxTakeawayRate: string | number | null;
  taxDineInRate: string | number | null;
  taxDeliveryRate: string | number | null;
  taxIncludedInPrice: boolean | null;
  vatAfterDiscount: boolean | null;
};

type ReceiptItemRow = {
  productName: string | null;
  quantity: string | number;
  unitPrice: string | number;
  totalPrice: string | number;
  selectedExtras?: unknown;
  comboSelections?: unknown;
  seatNumber?: number | null;
};

function lookupWhere(ref: string) {
  const clauses = [eq(schema.orders.orderNumber, ref), eq(schema.orders.clientId, ref)];
  if (isPgUuid(ref)) {
    clauses.unshift(eq(schema.orders.id, ref));
  }
  return or(...clauses);
}

/**
 * Public receipt lookup must not SELECT * on merchants/products.
 * Relational `with: { merchant: true, items: { product: true } }` pulls every
 * schema column (signage flags, recipe yield, staff_id, …). If drizzle-kit push
 * lagged, Postgres throws and the page shows "Failed to load receipt" for every QR.
 */
async function findReceiptOrder(ref: string): Promise<ReceiptOrderRow | null> {
  const db = getDb();
  const where = lookupWhere(ref);

  const rich = () =>
    db
      .select({
        id: schema.orders.id,
        clientId: schema.orders.clientId,
        orderNumber: schema.orders.orderNumber,
        notes: schema.orders.notes,
        customerName: schema.orders.customerName,
        fulfillmentChannel: schema.orders.fulfillmentChannel,
        paymentMethod: schema.orders.paymentMethod,
        paymentStatus: schema.orders.paymentStatus,
        status: schema.orders.status,
        subtotal: schema.orders.subtotal,
        taxAmount: schema.orders.taxAmount,
        discountAmount: schema.orders.discountAmount,
        total: schema.orders.total,
        tipAmount: schema.orders.tipAmount,
        roundingAmount: schema.orders.roundingAmount,
        tableLabel: schema.orders.tableLabel,
        guestCount: schema.orders.guestCount,
        completedAt: schema.orders.completedAt,
        createdAt: schema.orders.createdAt,
        pointsEarned: schema.orders.pointsEarned,
        adyenCustomerReceiptJson: schema.orders.adyenCustomerReceiptJson,
        businessName: schema.merchants.name,
        address: schema.merchants.address,
        city: schema.merchants.city,
        phone: schema.merchants.phone,
        vatNumber: schema.merchants.vatNumber,
        vatRate: schema.merchants.vatRate,
        taxTakeawayRate: schema.merchants.taxTakeawayRate,
        taxDineInRate: schema.merchants.taxDineInRate,
        taxDeliveryRate: schema.merchants.taxDeliveryRate,
        taxIncludedInPrice: schema.merchants.taxIncludedInPrice,
        vatAfterDiscount: schema.merchants.vatAfterDiscount,
      })
      .from(schema.orders)
      .leftJoin(schema.merchants, eq(schema.merchants.id, schema.orders.merchantId))
      .where(where)
      .limit(1);

  const minimal = () =>
    db
      .select({
        id: schema.orders.id,
        clientId: schema.orders.clientId,
        orderNumber: schema.orders.orderNumber,
        notes: schema.orders.notes,
        customerName: schema.orders.customerName,
        fulfillmentChannel: schema.orders.fulfillmentChannel,
        paymentMethod: schema.orders.paymentMethod,
        paymentStatus: schema.orders.paymentStatus,
        status: schema.orders.status,
        subtotal: schema.orders.subtotal,
        taxAmount: schema.orders.taxAmount,
        discountAmount: schema.orders.discountAmount,
        total: schema.orders.total,
        tipAmount: schema.orders.tipAmount,
        tableLabel: schema.orders.tableLabel,
        guestCount: schema.orders.guestCount,
        completedAt: schema.orders.completedAt,
        createdAt: schema.orders.createdAt,
        businessName: schema.merchants.name,
        address: schema.merchants.address,
        city: schema.merchants.city,
        phone: schema.merchants.phone,
        vatNumber: schema.merchants.vatNumber,
        vatRate: schema.merchants.vatRate,
      })
      .from(schema.orders)
      .leftJoin(schema.merchants, eq(schema.merchants.id, schema.orders.merchantId))
      .where(where)
      .limit(1);

  try {
    const rows = await rich();
    return (rows[0] as ReceiptOrderRow) || null;
  } catch (err) {
    console.warn("[receipts] rich order query failed, using minimal columns:", err);
    const rows = await minimal();
    const row = rows[0];
    if (!row) return null;
    return {
      ...row,
      roundingAmount: null,
      pointsEarned: null,
      adyenCustomerReceiptJson: null,
      taxTakeawayRate: null,
      taxDineInRate: null,
      taxDeliveryRate: null,
      taxIncludedInPrice: null,
      vatAfterDiscount: null,
    };
  }
}

async function findReceiptByKitchenShout(ref: string): Promise<ReceiptOrderRow | null> {
  const shout = ref.replace(/^#/, "").trim();
  if (!shout || shout.length > 40 || isPgUuid(ref)) return null;
  const db = getDb();
  try {
    const rows = await db
      .select({
        id: schema.orders.id,
        clientId: schema.orders.clientId,
        orderNumber: schema.orders.orderNumber,
        notes: schema.orders.notes,
        customerName: schema.orders.customerName,
        fulfillmentChannel: schema.orders.fulfillmentChannel,
        paymentMethod: schema.orders.paymentMethod,
        paymentStatus: schema.orders.paymentStatus,
        status: schema.orders.status,
        subtotal: schema.orders.subtotal,
        taxAmount: schema.orders.taxAmount,
        discountAmount: schema.orders.discountAmount,
        total: schema.orders.total,
        tipAmount: schema.orders.tipAmount,
        tableLabel: schema.orders.tableLabel,
        guestCount: schema.orders.guestCount,
        completedAt: schema.orders.completedAt,
        createdAt: schema.orders.createdAt,
        businessName: schema.merchants.name,
        address: schema.merchants.address,
        city: schema.merchants.city,
        phone: schema.merchants.phone,
        vatNumber: schema.merchants.vatNumber,
        vatRate: schema.merchants.vatRate,
      })
      .from(schema.orders)
      .leftJoin(schema.merchants, eq(schema.merchants.id, schema.orders.merchantId))
      .where(sql`${schema.orders.notes} ILIKE ${"%[ticket:" + shout + "]%"}`)
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      ...row,
      roundingAmount: null,
      pointsEarned: null,
      adyenCustomerReceiptJson: null,
      taxTakeawayRate: null,
      taxDineInRate: null,
      taxDeliveryRate: null,
      taxIncludedInPrice: null,
      vatAfterDiscount: null,
    };
  } catch (err) {
    console.warn("[receipts] kitchen-shout lookup failed:", err);
    return null;
  }
}

async function loadReceiptItems(orderId: string): Promise<ReceiptItemRow[]> {
  const db = getDb();
  try {
    return await db
      .select({
        productName: schema.orderItems.productName,
        quantity: schema.orderItems.quantity,
        unitPrice: schema.orderItems.unitPrice,
        totalPrice: schema.orderItems.totalPrice,
        selectedExtras: schema.orderItems.selectedExtras,
        comboSelections: schema.orderItems.comboSelections,
        seatNumber: schema.orderItems.seatNumber,
      })
      .from(schema.orderItems)
      .where(eq(schema.orderItems.orderId, orderId));
  } catch (err) {
    console.warn("[receipts] rich items query failed, using core columns:", err);
    return db
      .select({
        productName: schema.orderItems.productName,
        quantity: schema.orderItems.quantity,
        unitPrice: schema.orderItems.unitPrice,
        totalPrice: schema.orderItems.totalPrice,
      })
      .from(schema.orderItems)
      .where(eq(schema.orderItems.orderId, orderId));
  }
}

/**
 * GET /api/receipts/:ref
 * Public digital receipt lookup by order UUID, orderNumber, POS clientId, or kitchen shout.
 */
router.get("/:ref", async (req: Request, res: Response) => {
  try {
    let ref = String(req.params.ref || "").trim();
    try {
      ref = decodeURIComponent(ref);
    } catch {
      /* keep raw */
    }
    if (ref.includes("://")) {
      const parts = ref.replace(/\/+$/, "").split("/");
      ref = parts[parts.length - 1] || ref;
    }
    if (!ref || ref.length > 120) {
      return res.status(400).json({ error: "Invalid receipt reference" });
    }

    const order =
      (await findReceiptOrder(ref)) || (await findReceiptByKitchenShout(ref));

    if (!order) {
      return res.status(404).json({ error: "Receipt not found" });
    }

    const items = await loadReceiptItems(order.id);

    const adyenCustomerReceipt: AdyenTerminalReceipt | null = parseAdyenReceiptJson(
      order.adyenCustomerReceiptJson
    );
    const channel = (order.fulfillmentChannel || "takeaway") as "takeaway" | "dine_in" | "delivery";
    const taxRate = MerchantSettingsService.channelTaxRate(
      {
        vatRate: order.vatRate,
        taxTakeawayRate: order.taxTakeawayRate,
        taxDineInRate: order.taxDineInRate,
        taxDeliveryRate: order.taxDeliveryRate,
      },
      channel
    );
    const notes = String(order.notes || "");
    const memberMatch = notes.match(/\[member:([^\]]+)\]/i);
    const ptsEarnMatch = notes.match(/\[pts_earn:(\d+)\]/i);
    const ptsBalMatch = notes.match(/\[pts_bal:(\d+)\]/i);
    const memberName = memberMatch?.[1]?.trim() || null;
    const pointsEarned =
      order.pointsEarned != null && Number(order.pointsEarned) > 0
        ? Number(order.pointsEarned)
        : ptsEarnMatch?.[1]
          ? Number(ptsEarnMatch[1])
          : 0;
    const pointsBalance = ptsBalMatch?.[1] != null ? Number(ptsBalMatch[1]) : null;

    res.json({
      success: true,
      receipt: {
        id: order.id,
        clientId: order.clientId,
        orderNumber: order.orderNumber,
        businessName: order.businessName,
        address: [order.address, order.city].filter(Boolean).join(", "),
        phone: order.phone,
        vatNumber: order.vatNumber,
        customerName: order.customerName,
        memberName,
        pointsEarned,
        pointsBalance,
        channel: order.fulfillmentChannel,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        status: order.status,
        subtotal: order.subtotal,
        taxAmount: order.taxAmount,
        taxRate,
        vatIncludedInPrice: order.taxIncludedInPrice === true,
        vatAfterDiscount: order.vatAfterDiscount !== false,
        discountAmount: order.discountAmount,
        total: order.total,
        tipAmount: order.tipAmount,
        roundingAmount: order.roundingAmount,
        tableLabel: order.tableLabel,
        guestCount: order.guestCount,
        notes: order.notes,
        completedAt: order.completedAt || order.createdAt,
        adyenCustomerReceipt,
        adyenPaymentReceiptText: adyenCustomerReceipt
          ? adyenReceiptToPlainText(adyenCustomerReceipt, 40)
          : null,
        items: items.map((i) => ({
          name: resolveOrderItemName(i.productName),
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          lineTotal: i.totalPrice,
          seatNumber: i.seatNumber ?? null,
          selectedExtras: i.selectedExtras || [],
          comboSelections: i.comboSelections || [],
        })),
      },
    });
  } catch (error) {
    console.error("Error loading receipt:", error);
    res.status(500).json({ error: "Failed to load receipt" });
  }
});

export default router;
