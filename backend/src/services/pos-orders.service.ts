import { getDb, schema } from "@/db";
import { and, desc, eq, gte, lte, inArray } from "drizzle-orm";
import { POS_CANCEL_REASONS, resolvePosCancelReason } from "@/lib/pos-print-settings";
import { roundMoney2 } from "@/lib/money";
import { zurichDayBounds } from "@/lib/vacation";
import { resolveOrderItemName } from "@/lib/order-item-name";

const COMPLETED_STATUSES = new Set(["completed", "partially_refunded"]);
const BLOCKED_CANCEL_STATUSES = new Set([
  "completed",
  "partially_refunded",
  "refunded",
  "cancelled",
]);
const ALLOWED_PAYMENT_METHODS = new Set([
  "cash",
  "card",
  "terminal",
  "express",
  "online",
  "loyalty",
  "pay_later",
]);

type HeldCartLine = {
  productId?: string;
  name?: string;
  quantity?: number;
  unitPrice?: number;
  lineTotal?: number;
  taxable?: boolean;
  selectedExtras?: unknown;
  comboSelections?: unknown;
  isOpenPrice?: boolean;
};

function parseHeldCart(cartJson: unknown): {
  lines: HeldCartLine[];
  channel: string;
  tableLabel: string | null;
  notes: string | null;
} {
  const data = cartJson as
    | { cart?: HeldCartLine[]; channel?: string; tableLabel?: string; orderNote?: string }
    | HeldCartLine[]
    | null;
  const lines = Array.isArray(data) ? data : data?.cart || [];
  const channel = (!Array.isArray(data) && data?.channel) || "takeaway";
  const tableLabel = (!Array.isArray(data) && data?.tableLabel) || null;
  const notes = (!Array.isArray(data) && data?.orderNote) || null;
  return { lines, channel: String(channel), tableLabel, notes };
}

export class PosOrdersService {
  static cancelReasons() {
    return POS_CANCEL_REASONS;
  }

  static async listPosOrders(
    merchantId: string,
    opts: {
      status?: string;
      from?: string;
      to?: string;
      limit?: number;
    } = {}
  ) {
    const db = getDb();
    const limit = Math.min(Math.max(Number(opts.limit) || 50, 1), 200);
    const conditions = [
      eq(schema.orders.merchantId, merchantId),
      eq(schema.orders.orderType, "pos"),
    ];

    if (opts.status && opts.status !== "all") {
      conditions.push(eq(schema.orders.status, opts.status));
    }
    if (opts.from) {
      conditions.push(gte(schema.orders.createdAt, zurichDayBounds(opts.from).start));
    }
    if (opts.to) {
      conditions.push(lte(schema.orders.createdAt, zurichDayBounds(opts.to).end));
    }

    const rows = await db.query.orders.findMany({
      where: and(...conditions),
      with: {
        items: {
          with: { product: true },
        },
      },
      orderBy: [desc(schema.orders.createdAt)],
      limit,
    });

    return rows.map((o) => {
      const notes = String(o.notes || "");
      const ticketMatch = notes.match(/\[ticket:([^\]]+)\]/i);
      const tabMatch = notes.match(/\[tab:([^\]]+)\]/i);
      let ticketDisplay = ticketMatch?.[1]?.trim() || null;
      if (ticketDisplay && !ticketDisplay.startsWith("#")) {
        ticketDisplay = `#${ticketDisplay.replace(/^#/, "")}`;
      }
      const tabNumber =
        tabMatch?.[1]?.trim() ||
        (o.guestCount != null && Number(o.guestCount) > 0 ? String(o.guestCount) : null);
      return {
      id: o.id,
      orderNumber: o.orderNumber,
      clientId: o.clientId,
      status: o.status,
      channel: o.fulfillmentChannel,
      paymentMethod: o.paymentMethod,
      paymentStatus: o.paymentStatus,
      subtotal: Number(o.subtotal),
      taxAmount: Number(o.taxAmount),
      discountAmount: Number(o.discountAmount || 0),
      tipAmount: Number(o.tipAmount || 0),
      roundingAmount: Number(o.roundingAmount || 0),
      total: Number(o.total),
      refundAmount: Number(o.refundAmount || 0),
      cancelReason: o.cancelReason,
      cancelledAt: o.cancelledAt,
      refundedAt: o.refundedAt,
      notes: o.notes,
      tableLabel: o.tableLabel,
      guestCount: o.guestCount,
      ticketDisplay,
      tabNumber,
      staffName: o.staffName,
      masterOrderId: o.masterOrderId,
      splitCheckNumber: o.splitCheckNumber,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      shippingAddress: o.shippingAddress,
      createdAt: o.createdAt,
      completedAt: o.completedAt,
      items: (o.items || []).map((i) => {
        const name = resolveOrderItemName(i.productName, i.product?.name);
        return {
          id: i.id,
          productId: i.productId,
          name,
          productName: name,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
          totalPrice: Number(i.totalPrice),
          selectedExtras: i.selectedExtras || [],
          comboSelections: i.comboSelections || [],
        };
      }),
    };
    });
  }

  static async cancelOrder(merchantId: string, orderId: string, reason: string) {
    const db = getDb();
    const order = await db.query.orders.findFirst({
      where: and(eq(schema.orders.id, orderId), eq(schema.orders.merchantId, merchantId)),
    });
    if (!order) throw new Error("Order not found");
    if (order.status === "cancelled") throw new Error("Order already cancelled");
    if (order.status === "refunded") throw new Error("Order already refunded");
    if (
      BLOCKED_CANCEL_STATUSES.has(String(order.status)) ||
      COMPLETED_STATUSES.has(String(order.paymentStatus || ""))
    ) {
      throw new Error(
        "Completed orders cannot be cancelled. Change the payment method or issue a refund."
      );
    }

    const reasonText = resolvePosCancelReason(reason);
    if (!reasonText) throw new Error("Cancel reason is required");

    const [updated] = await db
      .update(schema.orders)
      .set({
        status: "cancelled",
        paymentStatus: "cancelled",
        cancelReason: reasonText,
        cancelledAt: new Date(),
      })
      .where(eq(schema.orders.id, orderId))
      .returning();

    return updated;
  }

  static async updatePaymentMethod(
    merchantId: string,
    orderId: string,
    paymentMethod: string
  ) {
    const db = getDb();
    const method = String(paymentMethod || "")
      .trim()
      .toLowerCase();
    if (!ALLOWED_PAYMENT_METHODS.has(method)) {
      throw new Error("Invalid payment method");
    }

    const order = await db.query.orders.findFirst({
      where: and(eq(schema.orders.id, orderId), eq(schema.orders.merchantId, merchantId)),
    });
    if (!order) throw new Error("Order not found");
    if (order.status === "cancelled" || order.paymentStatus === "cancelled") {
      throw new Error("Cannot change payment method on a cancelled order");
    }
    if (order.status === "refunded" || order.paymentStatus === "refunded") {
      throw new Error("Cannot change payment method on a refunded order");
    }
    if (
      !COMPLETED_STATUSES.has(String(order.status)) &&
      !COMPLETED_STATUSES.has(String(order.paymentStatus || ""))
    ) {
      throw new Error("Only completed orders can change payment method");
    }

    const [updated] = await db
      .update(schema.orders)
      .set({ paymentMethod: method })
      .where(eq(schema.orders.id, orderId))
      .returning();

    return updated;
  }

  static async refundOrder(
    merchantId: string,
    orderId: string,
    amount?: number
  ) {
    const db = getDb();
    const order = await db.query.orders.findFirst({
      where: and(eq(schema.orders.id, orderId), eq(schema.orders.merchantId, merchantId)),
    });
    if (!order) throw new Error("Order not found");
    if (order.status === "cancelled") throw new Error("Cannot refund a cancelled order");

    const total = Number(order.total) || 0;
    const already = Number(order.refundAmount || 0) || 0;
    const remaining = roundMoney2(total - already);
    if (remaining <= 0) throw new Error("Nothing left to refund");

    const refund = amount != null ? roundMoney2(Number(amount)) : remaining;
    if (!Number.isFinite(refund) || refund <= 0) throw new Error("Invalid refund amount");
    if (refund > remaining + 0.001) throw new Error("Refund exceeds remaining amount");

    const newRefundTotal = roundMoney2(already + refund);
    const fully = newRefundTotal >= total - 0.001;

    const [updated] = await db
      .update(schema.orders)
      .set({
        refundAmount: newRefundTotal.toFixed(2),
        refundedAt: new Date(),
        status: fully ? "refunded" : "partially_refunded",
        paymentStatus: fully ? "refunded" : "partially_refunded",
      })
      .where(eq(schema.orders.id, orderId))
      .returning();

    return { order: updated, refunded: refund, refundTotal: newRefundTotal };
  }

  static async listHeld(merchantId: string) {
    const db = getDb();
    return db.query.heldOrders.findMany({
      where: and(
        eq(schema.heldOrders.merchantId, merchantId),
        inArray(schema.heldOrders.status, ["held", "sent_to_kitchen"])
      ),
      orderBy: [desc(schema.heldOrders.updatedAt)],
    });
  }

  static async holdOrder(
    merchantId: string,
    body: {
      label?: string;
      channel?: string;
      cartJson: unknown;
      notes?: string;
      staffId?: string;
      staffName?: string;
      sendToKitchen?: boolean;
    }
  ) {
    const db = getDb();
    if (body.cartJson == null) throw new Error("cartJson is required");
    const [row] = await db
      .insert(schema.heldOrders)
      .values({
        merchantId,
        label: (body.label || "").trim().slice(0, 120) || null,
        status: body.sendToKitchen ? "sent_to_kitchen" : "held",
        channel: body.channel || "takeaway",
        cartJson: body.cartJson,
        notes: body.notes || null,
        staffId: body.staffId || null,
        staffName: body.staffName || null,
      })
      .returning();
    return row;
  }

  static async deleteHeld(merchantId: string, id: string) {
    const db = getDb();
    const existing = await db.query.heldOrders.findFirst({
      where: and(eq(schema.heldOrders.id, id), eq(schema.heldOrders.merchantId, merchantId)),
    });
    if (!existing) throw new Error("Held order not found");
    await db.delete(schema.heldOrders).where(eq(schema.heldOrders.id, id));
    return { ok: true };
  }

  /**
   * Cancel a held / kitchen-sent order with a required reason.
   * Records a cancelled POS sale for EOD and sales reports, then removes the hold.
   */
  static async cancelHeld(merchantId: string, id: string, reason: string) {
    const db = getDb();
    const existing = await db.query.heldOrders.findFirst({
      where: and(eq(schema.heldOrders.id, id), eq(schema.heldOrders.merchantId, merchantId)),
    });
    if (!existing) throw new Error("Held order not found");

    const reasonText = resolvePosCancelReason(reason);
    if (!reasonText) throw new Error("Cancel reason is required");

    const { lines, channel, tableLabel, notes } = parseHeldCart(existing.cartJson);
    if (!lines.length) {
      await db.delete(schema.heldOrders).where(eq(schema.heldOrders.id, id));
      return { ok: true, order: null, heldStatus: existing.status };
    }

    let subtotal = 0;
    for (const line of lines) {
      subtotal += Number(line.lineTotal || 0);
    }
    subtotal = roundMoney2(subtotal);
    const orderNumber = `CXL-${Date.now().toString(36).toUpperCase()}-${Math.random()
      .toString(36)
      .slice(2, 6)
      .toUpperCase()}`.slice(0, 50);
    const clientId = `cancel-held-${existing.id}`.slice(0, 64);
    const now = new Date();

    const [order] = await db
      .insert(schema.orders)
      .values({
        merchantId,
        orderNumber,
        orderType: "pos",
        fulfillmentChannel: existing.channel || channel || "takeaway",
        status: "cancelled",
        subtotal: subtotal.toFixed(2),
        taxAmount: "0.00",
        discountAmount: "0.00",
        tipAmount: "0.00",
        roundingAmount: "0.00",
        total: subtotal.toFixed(2),
        paymentMethod: null,
        paymentStatus: "cancelled",
        notes: notes || existing.notes || null,
        tableLabel: tableLabel || null,
        staffName: existing.staffName || null,
        clientId,
        cancelReason: reasonText,
        cancelledAt: now,
        completedAt: null,
        syncedAt: now,
      })
      .returning();

    for (const line of lines) {
      const qty = Number(line.quantity) || 1;
      const totalPrice = roundMoney2(Number(line.lineTotal || 0));
      const unitPrice = roundMoney2(
        Number(line.unitPrice != null ? line.unitPrice : qty ? totalPrice / qty : 0)
      );
      await db.insert(schema.orderItems).values({
        orderId: order.id,
        productId: null,
        productName: resolveOrderItemName(line.name),
        quantity: String(qty),
        unitPrice: unitPrice.toFixed(2),
        totalPrice: totalPrice.toFixed(2),
        taxAmount: "0.00",
        selectedExtras: Array.isArray(line.selectedExtras) ? line.selectedExtras : [],
        comboSelections: Array.isArray(line.comboSelections) ? line.comboSelections : [],
        isOpenPrice: !!line.isOpenPrice,
      });
    }

    await db.delete(schema.heldOrders).where(eq(schema.heldOrders.id, id));
    return { ok: true, order, heldStatus: existing.status, cancelReason: reasonText };
  }

  static async resumeHeld(merchantId: string, id: string) {
    const db = getDb();
    const existing = await db.query.heldOrders.findFirst({
      where: and(eq(schema.heldOrders.id, id), eq(schema.heldOrders.merchantId, merchantId)),
    });
    if (!existing) throw new Error("Held order not found");
    await db.delete(schema.heldOrders).where(eq(schema.heldOrders.id, id));
    return existing;
  }
}
