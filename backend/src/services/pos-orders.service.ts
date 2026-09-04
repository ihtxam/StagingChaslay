import { getDb, schema } from "@/db";
import { and, desc, eq, gte, ilike, lte, inArray, or } from "drizzle-orm";
import {
  POS_CANCEL_REASONS,
  POS_REFUND_REASONS,
  resolvePosCancelReason,
  resolvePosRefundReason,
} from "@/lib/pos-print-settings";
import { roundMoney2 } from "@/lib/money";
import { zurichDayBounds } from "@/lib/vacation";
import { resolveOrderItemName } from "@/lib/order-item-name";
import {
  parsePaymentBreakdown,
  refundDeltaGiftFirst,
} from "@/lib/payment-breakdown";
import { GiftCardService } from "@/services/gift-card.service";
import { AdyenTerminalPoiService } from "@/services/adyen-terminal-poi.service";
import { AdyenService } from "@/services/adyen.service";
import { withMerchantSchemaRetry } from "@/lib/ensure-merchant-schema";


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
  "invoice",
  "bank_transfer",
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

function resolveOrderCustomerName(
  order: {
    customerName?: string | null;
    tableLabel?: string | null;
    fulfillmentChannel?: string | null;
    notes?: string | null;
    customer?: { firstName?: string | null; lastName?: string | null } | null;
  }
): string | null {
  const direct = String(order.customerName || "").trim();
  if (direct) return direct;
  const linked = order.customer;
  if (linked) {
    const name = [linked.firstName, linked.lastName].filter(Boolean).join(" ").trim();
    if (name) return name;
  }
  const memberMatch = String(order.notes || "").match(/\[member:([^\]]+)\]/i);
  if (memberMatch?.[1]?.trim()) return memberMatch[1].trim();
  const ch = String(order.fulfillmentChannel || "takeaway").toLowerCase();
  const table = String(order.tableLabel || "").trim();
  if (table && ch !== "dine_in") return table;
  return null;
}

function parseHeldCart(cartJson: unknown): {
  lines: HeldCartLine[];
  channel: string;
  tableLabel: string | null;
  notes: string | null;
} {
  const data = normalizeHeldCartJson(cartJson);
  const lines = Array.isArray(data) ? data : data?.cart || [];
  const channel = (!Array.isArray(data) && data?.channel) || "takeaway";
  const tableLabel = (!Array.isArray(data) && data?.tableLabel) || null;
  const notes = (!Array.isArray(data) && data?.orderNote) || null;
  return { lines, channel: String(channel), tableLabel, notes };
}

function normalizeHeldCartJson(cartJson: unknown): {
  cart?: HeldCartLine[];
  channel?: string;
  tableId?: string | null;
  tableLabel?: string | null;
  tabNumber?: string | null;
  ticketDisplay?: string | null;
  orderNote?: string;
} | HeldCartLine[] | null {
  let data: unknown = cartJson;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (Array.isArray(data) || (data && typeof data === "object")) {
    return data as
      | HeldCartLine[]
      | {
          cart?: HeldCartLine[];
          channel?: string;
          tableId?: string | null;
          tableLabel?: string | null;
          tabNumber?: string | null;
          ticketDisplay?: string | null;
          orderNote?: string;
        };
  }
  return null;
}

function heldIdentity(cartJson: unknown): {
  ticketDisplay: string | null;
  tableId: string | null;
  tabNumber: string | null;
} {
  const data = normalizeHeldCartJson(cartJson);
  if (!data || Array.isArray(data)) {
    return { ticketDisplay: null, tableId: null, tabNumber: null };
  }
  const ticket = typeof data.ticketDisplay === "string" ? data.ticketDisplay.trim() : "";
  const tableId = typeof data.tableId === "string" ? data.tableId.trim() : "";
  const tab = data.tabNumber != null ? String(data.tabNumber).trim() : "";
  return {
    ticketDisplay: ticket || null,
    tableId: tableId || null,
    tabNumber: tab || null,
  };
}

function sameHeldIdentity(
  a: ReturnType<typeof heldIdentity>,
  b: ReturnType<typeof heldIdentity>
): boolean {
  if (a.ticketDisplay && b.ticketDisplay && a.ticketDisplay === b.ticketDisplay) return true;
  if (a.tableId && b.tableId && a.tableId === b.tableId) {
    if (a.ticketDisplay && b.ticketDisplay) return a.ticketDisplay === b.ticketDisplay;
    if (a.ticketDisplay || b.ticketDisplay) return false;
    return true;
  }
  if (!a.tableId && !b.tableId && a.tabNumber && b.tabNumber && a.tabNumber === b.tabNumber) {
    return true;
  }
  return false;
}

export class PosOrdersService {
  static cancelReasons() {
    return POS_CANCEL_REASONS;
  }

  static refundReasons() {
    return POS_REFUND_REASONS;
  }

  static async listPosOrders(
    merchantId: string,
    opts: {
      status?: string;
      from?: string;
      to?: string;
      limit?: number;
      q?: string;
    } = {}
  ) {
    return withMerchantSchemaRetry(async () => {
    const db = getDb();
    const limit = Math.min(Math.max(Number(opts.limit) || 50, 1), 200);
    const conditions = [
      eq(schema.orders.merchantId, merchantId),
      // POS register sales + online shop orders (web_shop + legacy online) for the Orders board
      inArray(schema.orders.orderType, ["pos", "web_shop", "online"]),
    ];

    if (opts.status && opts.status !== "all") {
      if (opts.status === "completed") {
        // Unpaid invoice POS sales stay in history (status may still be preparing).
        conditions.push(
          or(
            eq(schema.orders.status, "completed"),
            and(
              eq(schema.orders.paymentMethod, "invoice"),
              eq(schema.orders.paymentStatus, "awaiting_payment")
            )
          )!
        );
      } else {
        conditions.push(eq(schema.orders.status, opts.status));
      }
    }

    const q = String(opts.q || "").trim();
    const bareQ = q.replace(/^#/, "");
    const searchParts = q
      ? [
          ilike(schema.orders.orderNumber, `%${q}%`),
          ilike(schema.orders.clientId, `%${q}%`),
          ilike(schema.orders.invoiceNumber, `%${q}%`),
          ilike(schema.orders.customerName, `%${q}%`),
          ilike(schema.orders.paymentMethod, `%${q}%`),
          ilike(schema.orders.tableLabel, `%${q}%`),
          ilike(schema.orders.notes, `%${q}%`),
        ]
      : [];
    if (bareQ && bareQ !== q) {
      searchParts.push(
        ilike(schema.orders.orderNumber, `%${bareQ}%`),
        ilike(schema.orders.notes, `%${bareQ}%`)
      );
    }
    if (/^\d{1,6}$/.test(bareQ)) {
      const guestNum = Number(bareQ);
      searchParts.push(
        ilike(schema.orders.notes, `%[ticket:${bareQ}]%`),
        ilike(schema.orders.notes, `%[tab:${bareQ}]%`),
        ilike(schema.orders.notes, `%[ticket:#${bareQ}]%`),
        ilike(schema.orders.notes, `%[tab:#${bareQ}]%`),
        ilike(schema.orders.orderNumber, `%WEB%-${bareQ}%`)
      );
      if (Number.isFinite(guestNum)) {
        searchParts.push(eq(schema.orders.guestCount, guestNum));
      }
    }
    const searchCond = searchParts.length ? or(...searchParts) : null;

    // Include orders created in range OR scheduled (pickup/delivery) in range so a
    // future delivery time does not hide a ticket from today's history.
    // A ref search (WP-… / INV-… / kitchen #1001) also matches outside the date window.
    if (opts.from || opts.to) {
      const start = opts.from ? zurichDayBounds(opts.from).start : new Date(0);
      const end = opts.to ? zurichDayBounds(opts.to).end : new Date("9999-12-31T23:59:59.999Z");
      const createdInRange = and(
        gte(schema.orders.createdAt, start),
        lte(schema.orders.createdAt, end)
      );
      const scheduledInRange = and(
        gte(schema.orders.scheduledFor, start),
        lte(schema.orders.scheduledFor, end)
      );
      const inRange = or(createdInRange, scheduledInRange)!;
      const looksLikeRef =
        /^(WP-|INV-|ORD-|TX-|WEB-|DI-|#)/i.test(q) ||
        /^\d{1,6}$/.test(bareQ) ||
        q.replace(/[^A-Za-z0-9-]/g, "").length >= 8;
      if (searchCond && looksLikeRef) {
        conditions.push(or(inRange, searchCond)!);
      } else if (searchCond) {
        conditions.push(and(inRange, searchCond)!);
      } else {
        conditions.push(inRange);
      }
    } else if (searchCond) {
      conditions.push(searchCond);
    }

    const rows = await db.query.orders.findMany({
      where: and(...conditions),
      with: {
        items: {
          with: { product: true },
        },
        customer: true,
      },
      orderBy: [desc(schema.orders.createdAt)],
      limit,
    });

    const orderIds = rows.map((o) => o.id);
    const assignedIds = [
      ...new Set(rows.map((r) => r.assignedDeliveryStaffId).filter(Boolean) as string[]),
    ];
    const driverNameById = new Map<string, string>();
    if (assignedIds.length) {
      const drivers = await db.query.merchantStaff.findMany({
        where: and(
          eq(schema.merchantStaff.merchantId, merchantId),
          inArray(schema.merchantStaff.id, assignedIds)
        ),
        columns: { id: true, name: true },
      });
      for (const d of drivers) driverNameById.set(d.id, d.name);
    }
    const refundsByOrder = new Map<string, Array<Record<string, unknown>>>();
    if (orderIds.length) {
      try {
        const refundRows = await db.query.orderRefunds.findMany({
          where: and(
            eq(schema.orderRefunds.merchantId, merchantId),
            inArray(schema.orderRefunds.orderId, orderIds)
          ),
          orderBy: [desc(schema.orderRefunds.createdAt)],
        });
        for (const rf of refundRows) {
          const list = refundsByOrder.get(rf.orderId) || [];
          list.push({
            id: rf.id,
            kind: rf.kind,
            amount: Number(rf.amount),
            reason: rf.reason || null,
            staffName: rf.staffName || null,
            items: rf.itemsJson || [],
            allocation: rf.allocationJson || null,
            createdAt: rf.createdAt?.toISOString?.() ?? null,
          });
          refundsByOrder.set(rf.orderId, list);
        }
      } catch {
        /* table may not exist yet on older DBs */
      }
    }

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
      orderType: o.orderType,
      orderSource: o.orderSource,
      externalOrderId: o.externalOrderId,
      status: o.status,
      channel: o.fulfillmentChannel,
      paymentMethod: o.paymentMethod,
      paymentBreakdown: o.paymentBreakdown ?? null,
      paymentStatus: o.paymentStatus,
      invoiceNumber: (o as { invoiceNumber?: string | null }).invoiceNumber || null,
      invoiceIssuedAt: (o as { invoiceIssuedAt?: Date | null }).invoiceIssuedAt || null,
      invoiceDueAt: (o as { invoiceDueAt?: Date | null }).invoiceDueAt || null,
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
      refundReason: o.refundReason || null,
      refundHistory: refundsByOrder.get(o.id) || [],
      notes: o.notes,
      tableLabel: o.tableLabel,
      guestCount: o.guestCount,
      ticketDisplay,
      tabNumber,
      staffName: o.staffName,
      assignedDeliveryStaffId: o.assignedDeliveryStaffId || null,
      assignedDriverName: o.assignedDeliveryStaffId
        ? driverNameById.get(o.assignedDeliveryStaffId) || null
        : null,
      masterOrderId: o.masterOrderId,
      splitCheckNumber: o.splitCheckNumber,
      customerName: resolveOrderCustomerName(o),
      pointsEarned: o.pointsEarned ?? 0,
      pointsRedeemed: o.pointsRedeemed ?? 0,
      customerPhone: o.customerPhone,
      shippingAddress: o.shippingAddress,
      deliveryLatitude:
        o.deliveryLatitude != null && o.deliveryLatitude !== ""
          ? Number(o.deliveryLatitude)
          : null,
      deliveryLongitude:
        o.deliveryLongitude != null && o.deliveryLongitude !== ""
          ? Number(o.deliveryLongitude)
          : null,
      deliveryTrackingToken: o.deliveryTrackingToken || null,
      scheduledFor: o.scheduledFor,
      createdAt: o.createdAt,
      completedAt: o.completedAt,
      adyenReference: o.adyenReference ?? null,
      adyenCustomerReceiptJson: o.adyenCustomerReceiptJson ?? null,
      adyenCashierReceiptJson: o.adyenCashierReceiptJson ?? null,
      items: (o.items || []).map((i) => {
        const name = resolveOrderItemName(i.productName, i.product?.name);
        return {
          id: i.id,
          productId: i.productId,
          categoryId: i.product?.categoryId || null,
          name,
          productName: name,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
          totalPrice: Number(i.totalPrice),
          refundedQuantity: Number(i.refundedQuantity || 0),
          selectedExtras: i.selectedExtras || [],
          comboSelections: i.comboSelections || [],
        };
      }),
    };
    });
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
    const payStatus = String(order.paymentStatus || "").toLowerCase();
    const awaitingPayment =
      payStatus === "awaiting_payment" ||
      String(order.paymentMethod || "").toLowerCase().replace(/-/g, "_") === "pay_later";
    if (
      !awaitingPayment &&
      (BLOCKED_CANCEL_STATUSES.has(String(order.status)) ||
        COMPLETED_STATUSES.has(payStatus))
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

    void import("@/services/ods.service")
      .then(({ OdsService }) =>
        OdsService.syncFromOrder(merchantId, {
          orderNumber: updated.orderNumber,
          notes: updated.notes,
          status: "cancelled",
        })
      )
      .catch(() => {});

    return updated;
  }

  static async updatePaymentMethod(
    merchantId: string,
    orderId: string,
    paymentMethod: string
  ) {
    const db = getDb();
    let method = String(paymentMethod || "")
      .trim()
      .toLowerCase()
      .replace(/-/g, "_");
    if (!ALLOWED_PAYMENT_METHODS.has(method)) {
      throw new Error("Invalid payment method");
    }

    const order = await db.query.orders.findFirst({
      where: and(eq(schema.orders.id, orderId), eq(schema.orders.merchantId, merchantId)),
    });
    if (!order) throw new Error("Order not found");
    const existingMethod = String(order.paymentMethod || "")
      .toLowerCase()
      .replace(/-/g, "_");
    if (existingMethod === "invoice" || order.invoiceNumber) {
      if (method !== "invoice" && method !== "bank_transfer" && method !== "bank") {
        throw new Error("Invoice orders can only be paid by invoice / bank transfer");
      }
      method = "invoice";
    }
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

    const orderTotal = roundMoney2(Number(order.total) || 0);
    const [updated] = await db
      .update(schema.orders)
      .set({
        paymentMethod: method,
        paymentBreakdown: [{ method, amount: orderTotal }],
      })
      .where(eq(schema.orders.id, orderId))
      .returning();

    return updated;
  }

  static async refundOrder(
    merchantId: string,
    orderId: string,
    opts: {
      amount?: number;
      reason?: string;
      /** When set, refund selected line quantities (amount derived from lines). */
      items?: Array<{ orderItemId: string; quantity: number }>;
      /** true = refund entire remaining ticket */
      fullTicket?: boolean;
    } = {}
  ) {
    const db = getDb();
    const reasonText = resolvePosRefundReason(String(opts.reason || ""));
    if (!reasonText) throw new Error("Refund reason is required");

    const order = await db.query.orders.findFirst({
      where: and(eq(schema.orders.id, orderId), eq(schema.orders.merchantId, merchantId)),
      with: { items: true },
    });
    if (!order) throw new Error("Order not found");
    if (order.status === "cancelled") throw new Error("Cannot refund a cancelled order");

    const total = Number(order.total) || 0;
    const already = Number(order.refundAmount || 0) || 0;
    const remaining = roundMoney2(total - already);
    if (remaining <= 0) throw new Error("Nothing left to refund");

    let refund = 0;
    const itemUpdates: Array<{ id: string; refundedQuantity: string }> = [];

    if (opts.fullTicket || (!opts.items?.length && opts.amount == null)) {
      refund = remaining;
      for (const item of order.items || []) {
        const qty = Number(item.quantity) || 0;
        itemUpdates.push({ id: item.id, refundedQuantity: qty.toFixed(3) });
      }
    } else if (opts.items?.length) {
      const byId = new Map((order.items || []).map((i) => [i.id, i]));
      for (const sel of opts.items) {
        const item = byId.get(String(sel.orderItemId || ""));
        if (!item) throw new Error("Refund item not found on this order");
        const qty = Number(item.quantity) || 0;
        const alreadyQty = Number(item.refundedQuantity || 0) || 0;
        const left = Math.max(0, qty - alreadyQty);
        const take = roundMoney2(Number(sel.quantity));
        if (!Number.isFinite(take) || take <= 0) throw new Error("Invalid refund item quantity");
        if (take > left + 0.0005) throw new Error("Refund quantity exceeds remaining item quantity");
        const unit = qty > 0 ? Number(item.totalPrice) / qty : 0;
        refund = roundMoney2(refund + unit * take);
        itemUpdates.push({
          id: item.id,
          refundedQuantity: (alreadyQty + take).toFixed(3),
        });
      }
      if (refund > remaining + 0.001) refund = remaining;
    } else {
      refund = roundMoney2(Number(opts.amount));
      if (!Number.isFinite(refund) || refund <= 0) throw new Error("Invalid refund amount");
    }

    if (refund > remaining + 0.001) throw new Error("Refund exceeds remaining amount");
    if (refund <= 0) throw new Error("Invalid refund amount");

    const tenders = parsePaymentBreakdown(
      order.paymentBreakdown,
      order.paymentMethod,
      total
    );
    const refundDelta = refundDeltaGiftFirst(already, refund, tenders);
    const terminalRefundAmount = refundDelta.terminal;

    let terminalRefundRef: string | null = null;
    if (terminalRefundAmount > 0.001) {
      let poiTxId = String(order.adyenReference || "").trim();
      let poiTs =
        order.adyenPoiTransactionTs instanceof Date
          ? order.adyenPoiTransactionTs.toISOString()
          : order.adyenPoiTransactionTs
            ? String(order.adyenPoiTransactionTs)
            : "";

      if (!poiTxId || !poiTs) {
        const captureTx = await db.query.paymentTransactions.findFirst({
          where: and(
            eq(schema.paymentTransactions.orderId, orderId),
            eq(schema.paymentTransactions.merchantId, merchantId)
          ),
          orderBy: [desc(schema.paymentTransactions.createdAt)],
        });
        poiTxId = String(captureTx?.adyenReference || poiTxId).trim();
        poiTs =
          captureTx?.adyenPoiTransactionTs instanceof Date
            ? captureTx.adyenPoiTransactionTs.toISOString()
            : captureTx?.adyenPoiTransactionTs
              ? String(captureTx.adyenPoiTransactionTs)
              : poiTs;
      }

      if (!poiTxId || !poiTs) {
        throw new Error(
          "Cannot refund to card: original Adyen terminal transaction reference is missing on this order."
        );
      }

      const terminalResult = await AdyenTerminalPoiService.processTerminalRefund(
        merchantId,
        terminalRefundAmount,
        {
          originalPoiTransactionId: poiTxId,
          originalPoiTransactionTimestamp: poiTs,
          currency: "CHF",
        }
      );
      if (terminalResult.status !== "approved") {
        throw new Error(
          terminalResult.message || `Adyen terminal refund failed (${terminalResult.status})`
        );
      }
      terminalRefundRef = terminalResult.reference || poiTxId;

      try {
        await AdyenService.recordPaymentTransaction(
          merchantId,
          orderId,
          -terminalRefundAmount,
          "refund",
          terminalRefundRef || `refund-${Date.now()}`,
          "completed"
        );
      } catch (logErr) {
        console.warn("Terminal refund approved but transaction log failed:", logErr);
      }
    }

    const newRefundTotal = roundMoney2(already + refund);
    const fully = newRefundTotal >= total - 0.001;

    for (const u of itemUpdates) {
      await db
        .update(schema.orderItems)
        .set({ refundedQuantity: u.refundedQuantity })
        .where(eq(schema.orderItems.id, u.id));
    }

    const giftRestore = refundDelta.giftCard;
    if (giftRestore > 0.001) {
      const redeemTx = await db.query.giftCardTransactions.findMany({
        where: and(
          eq(schema.giftCardTransactions.merchantId, merchantId),
          eq(schema.giftCardTransactions.orderId, orderId),
          eq(schema.giftCardTransactions.transactionType, "redeem")
        ),
      });
      if (redeemTx.length) {
        let left = giftRestore;
        for (const tx of redeemTx) {
          if (left <= 0.001) break;
          const redeemed = Number(tx.amount) || 0;
          if (redeemed <= 0) continue;
          const restore = roundMoney2(Math.min(left, redeemed));
          if (restore <= 0) continue;
          try {
            await GiftCardService.refundToCard(merchantId, {
              cardId: tx.cardId,
              amount: restore,
              orderId,
            });
            left = roundMoney2(left - restore);
          } catch (gcErr) {
            console.warn("Gift card balance restore on refund failed:", gcErr);
          }
        }
      }
    }

    const [updated] = await db
      .update(schema.orders)
      .set({
        refundAmount: newRefundTotal.toFixed(2),
        refundedAt: new Date(),
        refundReason: reasonText,
        status: fully ? "refunded" : "partially_refunded",
        paymentStatus: fully ? "refunded" : "partially_refunded",
      })
      .where(eq(schema.orders.id, orderId))
      .returning();

    const refundItemsLog = itemUpdates
      .map((u) => {
        const item = (order.items || []).find((i) => i.id === u.id);
        const prevQty = Number(item?.refundedQuantity || 0) || 0;
        const nextQty = Number(u.refundedQuantity) || 0;
        const delta = roundMoney2(nextQty - prevQty);
        if (delta <= 0) return null;
        return {
          orderItemId: u.id,
          productName: resolveOrderItemName(item?.productName),
          quantity: delta,
        };
      })
      .filter(Boolean) as Array<{ orderItemId: string; productName?: string; quantity: number }>;

    try {
      await db.insert(schema.orderRefunds).values({
        merchantId,
        orderId,
        kind: "referenced",
        amount: refund.toFixed(2),
        reason: reasonText,
        staffId: order.staffId || null,
        staffName: order.staffName || null,
        itemsJson: refundItemsLog.length ? refundItemsLog : null,
        allocationJson: {
          giftCard: refundDelta.giftCard,
          cash: refundDelta.cash,
          terminal: refundDelta.terminal,
          other: refundDelta.other,
        },
      });
    } catch (logErr) {
      console.warn("Refund recorded on order but history log failed:", logErr);
    }

    return {
      order: updated,
      refunded: refund,
      refundTotal: newRefundTotal,
      reason: reasonText,
      allocation: {
        giftCard: refundDelta.giftCard,
        cash: refundDelta.cash,
        terminal: refundDelta.terminal,
        other: refundDelta.other,
      },
      terminalRefund:
        terminalRefundAmount > 0.001
          ? { approved: true, reference: terminalRefundRef, amount: terminalRefundAmount }
          : undefined,
    };
  }

  /**
   * Goodwill / unreferenced compensation — open amount not capped by order total.
   * May be paid as cash (record only) or via terminal unreferenced refund.
   */
  static async goodwillCompensation(
    merchantId: string,
    orderId: string,
    opts: {
      amount: number;
      reason: string;
      method: "cash" | "terminal";
    }
  ) {
    const db = getDb();
    const reasonText = resolvePosRefundReason(String(opts.reason || ""));
    if (!reasonText) throw new Error("Compensation reason is required");

    const amount = roundMoney2(Number(opts.amount));
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid compensation amount");

    const method = String(opts.method || "cash").toLowerCase();
    if (method !== "cash" && method !== "terminal") {
      throw new Error("Compensation method must be cash or terminal");
    }

    const order = await db.query.orders.findFirst({
      where: and(eq(schema.orders.id, orderId), eq(schema.orders.merchantId, merchantId)),
    });
    if (!order) throw new Error("Order not found");

    let terminalRef: string | null = null;
    if (method === "terminal") {
      const terminalResult = await AdyenTerminalPoiService.processUnreferencedTerminalRefund(
        merchantId,
        amount,
        { currency: "CHF" }
      );
      if (terminalResult.status !== "approved") {
        throw new Error(
          terminalResult.message || `Adyen terminal compensation failed (${terminalResult.status})`
        );
      }
      terminalRef = terminalResult.reference || null;
      try {
        await AdyenService.recordPaymentTransaction(
          merchantId,
          orderId,
          -amount,
          "goodwill",
          terminalRef || `goodwill-${Date.now()}`,
          "completed"
        );
      } catch (logErr) {
        console.warn("Goodwill terminal approved but transaction log failed:", logErr);
      }
    }

    const already = Number(order.goodwillAmount || 0) || 0;
    const newGoodwillTotal = roundMoney2(already + amount);

    const [updated] = await db
      .update(schema.orders)
      .set({
        goodwillAmount: newGoodwillTotal.toFixed(2),
        refundReason: reasonText,
      })
      .where(eq(schema.orders.id, orderId))
      .returning();

    try {
      await db.insert(schema.orderRefunds).values({
        merchantId,
        orderId,
        kind: "goodwill",
        amount: amount.toFixed(2),
        reason: reasonText,
        staffId: order.staffId || null,
        staffName: order.staffName || null,
        itemsJson: null,
        allocationJson:
          method === "terminal"
            ? { terminal: amount }
            : { cash: amount },
      });
    } catch (logErr) {
      console.warn("Goodwill recorded but history log failed:", logErr);
    }

    return {
      order: updated,
      compensated: amount,
      goodwillTotal: newGoodwillTotal,
      reason: reasonText,
      method,
      terminalReference: terminalRef,
    };
  }

  static async listHeld(merchantId: string) {
    const db = getDb();
    const rows = await db.query.heldOrders.findMany({
      where: and(
        eq(schema.heldOrders.merchantId, merchantId),
        inArray(schema.heldOrders.status, ["held", "sent_to_kitchen"])
      ),
      orderBy: [desc(schema.heldOrders.updatedAt)],
    });
    console.info("[pos-held] list", {
      merchantId,
      count: rows.length,
      tickets: rows.map((r) => {
        const ident = heldIdentity(r.cartJson);
        return {
          id: r.id,
          status: r.status,
          channel: r.channel,
          ticket: ident.ticketDisplay,
          tableId: ident.tableId,
          tab: ident.tabNumber,
        };
      }),
    });
    return rows;
  }

  static async holdOrder(
    merchantId: string,
    body: {
      id?: string;
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
    const ident = heldIdentity(body.cartJson);
    const requested = String(body.channel || "").toLowerCase();
    const persistChannel =
      ident.tableId
        ? "dine_in"
        : requested === "dine_in" || requested === "delivery" || requested === "takeaway"
          ? requested
          : "takeaway";
    const status = body.sendToKitchen ? "sent_to_kitchen" : "held";
    const values = {
      label: (body.label || "").trim().slice(0, 120) || null,
      status,
      channel: persistChannel,
      cartJson: body.cartJson,
      notes: body.notes || null,
      staffId: body.staffId || null,
      staffName: body.staffName || null,
      updatedAt: new Date(),
    };

    const open = await db.query.heldOrders.findMany({
      where: and(
        eq(schema.heldOrders.merchantId, merchantId),
        inArray(schema.heldOrders.status, ["held", "sent_to_kitchen"])
      ),
    });
    const existing =
      (body.id && open.find((r) => r.id === body.id)) ||
      open.find((r) => sameHeldIdentity(heldIdentity(r.cartJson), ident));

    if (existing) {
      const [row] = await db
        .update(schema.heldOrders)
        .set(values)
        .where(eq(schema.heldOrders.id, existing.id))
        .returning();
      console.info("[pos-held] upsert-update", {
        merchantId,
        id: existing.id,
        status,
        channel: persistChannel,
        ticket: ident.ticketDisplay,
        tableId: ident.tableId,
      });
      return row;
    }

    const [row] = await db
      .insert(schema.heldOrders)
      .values({
        merchantId,
        ...values,
      })
      .returning();
    console.info("[pos-held] upsert-insert", {
      merchantId,
      id: row.id,
      status,
      channel: persistChannel,
      ticket: ident.ticketDisplay,
      tableId: ident.tableId,
    });
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
   * Remove open held rows after payment — matches ticket #, table, or tab identity.
   * Used by POS checkout (staff may lack CANCEL_ORDERS) and server-side sale sync.
   */
  static async releaseHeldByIdentity(
    merchantId: string,
    opts: {
      heldId?: string | null;
      ticketDisplay?: string | null;
      tableId?: string | null;
      tabNumber?: string | null;
    }
  ) {
    const db = getDb();
    const target = heldIdentity({
      ticketDisplay: opts.ticketDisplay,
      tableId: opts.tableId,
      tabNumber: opts.tabNumber,
    });
    const hasTarget =
      !!target.ticketDisplay || !!target.tableId || !!target.tabNumber || !!opts.heldId;
    if (!hasTarget) return { released: 0 };

    const open = await db.query.heldOrders.findMany({
      where: and(
        eq(schema.heldOrders.merchantId, merchantId),
        inArray(schema.heldOrders.status, ["held", "sent_to_kitchen"])
      ),
    });

    const toDelete = new Set<string>();
    if (opts.heldId) toDelete.add(opts.heldId);
    for (const row of open) {
      if (sameHeldIdentity(heldIdentity(row.cartJson), target)) {
        toDelete.add(row.id);
      }
    }

    for (const id of toDelete) {
      await db
        .delete(schema.heldOrders)
        .where(and(eq(schema.heldOrders.id, id), eq(schema.heldOrders.merchantId, merchantId)));
    }

    if (toDelete.size) {
      console.info("[pos-held] release", {
        merchantId,
        released: toDelete.size,
        ticket: target.ticketDisplay,
        tableId: target.tableId,
        tab: target.tabNumber,
      });
    }
    return { released: toDelete.size };
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
