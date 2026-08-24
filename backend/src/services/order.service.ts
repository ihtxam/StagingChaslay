import { getDb, schema } from "@/db";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { roundMoney2, roundTo005 } from "@/lib/money";
import { adjustTaxForOrderDiscount } from "@/lib/tax-discount";
import { resolveOrderItemName } from "@/lib/order-item-name";
import { resolvePosCancelReason } from "@/lib/pos-print-settings";

function computeEstimatedReadyAt(
  order: { fulfillmentChannel?: string | null; scheduledFor?: Date | null },
  merchant: { pickupEtaMinutes?: number | null; deliveryEtaMinutes?: number | null }
): Date {
  if (order.scheduledFor) {
    return new Date(order.scheduledFor);
  }
  const channel = order.fulfillmentChannel || "takeaway";
  const prepMinutes =
    channel === "delivery"
      ? Number(merchant.deliveryEtaMinutes ?? 45)
      : Number(merchant.pickupEtaMinutes ?? 25);
  return new Date(Date.now() + prepMinutes * 60 * 1000);
}

function isInvoiceOrderRecord(order: {
  paymentMethod?: string | null;
  invoiceNumber?: string | null;
}): boolean {
  const method = String(order.paymentMethod || "")
    .toLowerCase()
    .replace(/-/g, "_");
  return method === "invoice" || !!order.invoiceNumber;
}

function resolveCollectPaymentMethod(
  requested: string | null | undefined,
  order: { paymentMethod?: string | null; invoiceNumber?: string | null }
): string {
  if (isInvoiceOrderRecord(order)) return "invoice";
  const requestedRaw = String(requested || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
  const requestedLater = requestedRaw.match(/^pay_later[:_](.+)$/);
  const existingRaw = String(order.paymentMethod || "cash")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
  const wasPayLater =
    existingRaw === "pay_later" ||
    existingRaw === "pay-later" ||
    existingRaw.startsWith("pay_later:");
  const tender = requestedLater?.[1]
    || (["cash", "card", "terminal", "bank_transfer"].includes(requestedRaw) ? requestedRaw : "")
    || (wasPayLater ? "cash" : "")
    || (["cash", "card", "terminal", "bank_transfer"].includes(existingRaw) ? existingRaw : "")
    || "cash";
  if (wasPayLater && tender !== "bank_transfer") {
    return `pay_later:${tender}`;
  }
  return tender;
}

function usesExternalKitchenLifecycle(order: {
  orderType?: string | null;
  orderSource?: string | null;
  fulfillmentChannel?: string | null;
}): boolean {
  const t = String(order.orderType || "").toLowerCase();
  const src = String(order.orderSource || "").toLowerCase();
  const ch = String(order.fulfillmentChannel || "").toLowerCase();
  return (
    t === "web_shop" ||
    t === "online" ||
    src === "online_shop" ||
    src === "justeat" ||
    src === "ubereats" ||
    ch.includes("uber") ||
    ch.includes("justeat") ||
    ch.includes("just-eat") ||
    ch.includes("doordash") ||
    ch.includes("deliveroo") ||
    ch === "web_shop" ||
    ch === "online"
  );
}

async function enqueueOnlineOrderReceiptPrint(
  merchantId: string,
  orderId: string,
  order: { orderSource?: string | null; fulfillmentChannel?: string | null }
) {
  const { DeliveryPlatformService } = await import("@/services/delivery-platform.service");
  const source =
    order.orderSource === "justeat" || order.orderSource === "ubereats"
      ? order.orderSource
      : "online_shop";
  const isDelivery = order.fulfillmentChannel === "delivery";
  await DeliveryPlatformService.enqueueAutoPrint(merchantId, orderId, source, {
    printKitchen: false,
    printNotification: !isDelivery,
    printDeliveryReceipt: isDelivery,
    printReceipt: !isDelivery,
  });
}

async function sendOrderRejectedEmail(
  merchantId: string,
  order: {
    customerEmail?: string | null;
    customerName?: string | null;
    orderNumber?: string | null;
    cancelReason?: string | null;
  },
  merchantName: string
) {
  const email = String(order.customerEmail || "").trim();
  if (!email) return;
  try {
    const { EmailService } = await import("@/services/email.service");
    const reason = String(order.cancelReason || "").trim();
    await EmailService.send({
      merchantId,
      to: email,
      subject: `Order ${order.orderNumber || ""} — update from ${merchantName}`,
      html: `<p>Hello${order.customerName ? ` ${order.customerName}` : ""},</p>
<p>We regret to inform you that your order <strong>${order.orderNumber || ""}</strong> could not be accepted.</p>
${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
<p>Please contact us if you have questions.</p>
<p>— ${merchantName}</p>`,
      text: `Your order ${order.orderNumber || ""} could not be accepted.${reason ? ` Reason: ${reason}` : ""} — ${merchantName}`,
      emailType: "shop_order",
    });
  } catch (err) {
    console.warn("Order rejection email failed:", err);
  }
}

async function sendGuestShopOrderEmail(
  merchantId: string,
  orderId: string,
  kind: "confirmed" | "ready" | "out_for_delivery" | "cancelled" | "received",
  order: { orderType?: string | null; customerEmail?: string | null }
) {
  if (String(order.orderType || "").toLowerCase() !== "web_shop" || !order.customerEmail) return;
  try {
    const { ShopOrderEmailService } = await import("@/services/shop-order-email.service");
    await ShopOrderEmailService.sendGuestOrderEmail(merchantId, orderId, kind);
  } catch (err) {
    console.warn(`Shop order ${kind} email failed:`, err);
  }
}

function withResolvedItemNames<
  T extends {
    items?: Array<{
      productName?: string | null;
      product?: { name?: string | null } | null;
      comboSelections?: Array<{ productName?: string | null }> | null;
    }>;
  },
>(order: T): T {
  if (!order?.items?.length) return order;
  return {
    ...order,
    items: order.items.map((item) => ({
      ...item,
      productName: resolveOrderItemName(item.productName, item.product?.name),
      comboSelections: Array.isArray(item.comboSelections)
        ? item.comboSelections.map((c) => ({
            ...c,
            productName: resolveOrderItemName(c.productName),
          }))
        : item.comboSelections,
    })),
  };
}

async function withGiftCardRemainingBalance<
  T extends { id: string; notes?: string | null },
>(order: T): Promise<T & { giftCardRemainingBalance?: number | null }> {
  const db = getDb();
  const redeemTx = await db.query.giftCardTransactions.findFirst({
    where: and(
      eq(schema.giftCardTransactions.orderId, order.id),
      eq(schema.giftCardTransactions.transactionType, "redeem")
    ),
    orderBy: [desc(schema.giftCardTransactions.createdAt)],
    columns: { balanceAfter: true },
  });
  const fromTx =
    redeemTx?.balanceAfter != null ? Number(redeemTx.balanceAfter) : null;
  const fromNotes = String(order.notes || "").match(
    /Gift card remaining:\s*([\d.]+)/i
  )?.[1];
  const parsedNotes =
    fromNotes != null && Number.isFinite(Number(fromNotes))
      ? Number(fromNotes)
      : null;
  const giftCardRemainingBalance =
    fromTx != null && Number.isFinite(fromTx)
      ? fromTx
      : parsedNotes != null
        ? parsedNotes
        : null;
  return {
    ...order,
    giftCardRemainingBalance,
  };
}

export class OrderService {
  /**
   * Create order
   */
  static async createOrder(
    merchantId: string,
    items: Array<{ productId: string; quantity: number; unitPrice: number }>,
    customerId?: string,
    orderType: "pos" | "web_shop" = "pos",
    paymentMethod?: string,
    discountAmount: number = 0,
    notes?: string
  ) {
    const db = getDb();

    try {
      const merchant = await db.query.merchants.findFirst({
        where: eq(schema.merchants.id, merchantId),
      });
      const vatRate = merchant?.vatRate ? parseFloat(merchant.vatRate.toString()) : 0;
      const taxDiscountOpts = {
        taxIncludedInPrice: merchant?.taxIncludedInPrice === true,
        vatAfterDiscount: merchant?.vatAfterDiscount !== false,
      };

      // Calculate totals
      let subtotal = 0;
      let taxAmount = 0;

      for (const item of items) {
        const product = await db.query.products.findFirst({
          where: eq(schema.products.id, item.productId),
        });

        if (!product) {
          throw new Error(`Product ${item.productId} not found`);
        }

        const itemTotal = roundMoney2(item.unitPrice * item.quantity);
        subtotal += itemTotal;

        if (product.isTaxable) {
          taxAmount += roundMoney2((itemTotal * vatRate) / 100);
        }
      }

      subtotal = roundMoney2(subtotal);
      taxAmount = roundMoney2(taxAmount);
      discountAmount = roundMoney2(discountAmount);
      taxAmount = adjustTaxForOrderDiscount(taxAmount, subtotal, discountAmount, taxDiscountOpts);
      const total = roundTo005(subtotal + taxAmount - discountAmount);

      // Create order
      const orderNumber = `ORD-${Date.now()}-${uuidv4().substring(0, 8).toUpperCase()}`;

      const order = await db
        .insert(schema.orders)
        .values({
          merchantId,
          orderNumber,
          customerId,
          orderType,
          status: "pending",
          subtotal: subtotal.toFixed(2),
          taxAmount: taxAmount.toFixed(2),
          discountAmount: discountAmount.toFixed(2),
          total: total.toFixed(2),
          paymentMethod,
          paymentStatus: "pending",
          notes,
        })
        .returning();

      // Create order items
      for (const item of items) {
        const itemTotal = item.unitPrice * item.quantity;

        const product = await db.query.products.findFirst({
          where: eq(schema.products.id, item.productId),
        });

        await db.insert(schema.orderItems).values({
          orderId: order[0].id,
          productId: item.productId,
          productName: resolveOrderItemName(
            product?.name,
            (item as { productName?: string }).productName
          ),
          quantity: item.quantity.toString(),
          unitPrice: item.unitPrice.toString(),
          totalPrice: itemTotal.toString(),
          taxAmount: (itemTotal * 0.1).toString(), // Simplified tax
        });

        // Update product stock
        if (product) {
          await db
            .update(schema.products)
            .set({ stock: product.stock - item.quantity })
            .where(eq(schema.products.id, item.productId));
        }
      }

      return order[0];
    } catch (error) {
      console.error("Error creating order:", error);
      throw error;
    }
  }

  /**
   * Get all orders for merchant
   */
  static async getOrders(
    merchantId: string,
    page: number = 1,
    limit: number = 20,
    status?: string,
    startDate?: Date,
    endDate?: Date
  ) {
    const db = getDb();

    try {
      const offset = (page - 1) * limit;
      let whereConditions: any[] = [eq(schema.orders.merchantId, merchantId)];

      if (status) {
        whereConditions.push(eq(schema.orders.status, status));
      }

      if (startDate && endDate) {
        whereConditions.push(gte(schema.orders.createdAt, startDate));
        whereConditions.push(lte(schema.orders.createdAt, endDate));
      }

      const orders = await db.query.orders.findMany({
        where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
        with: {
          items: {
            with: {
              product: true,
            },
          },
          customer: true,
        },
        limit,
        offset,
        orderBy: desc(schema.orders.createdAt),
      });

      return orders.map((order) => withResolvedItemNames(order));
    } catch (error) {
      console.error("Error getting orders:", error);
      throw error;
    }
  }

  /**
   * Get order by ID
   */
  static async getOrderById(merchantId: string, orderId: string) {
    const db = getDb();

    try {
      const order = await db.query.orders.findFirst({
        where: and(
          eq(schema.orders.id, orderId),
          eq(schema.orders.merchantId, merchantId)
        ),
        with: {
          items: {
            with: {
              product: true,
            },
          },
          customer: true,
          paymentTransactions: true,
        },
      });

      if (!order) {
        throw new Error("Order not found");
      }

      const resolved = withResolvedItemNames(order);
      return await withGiftCardRemainingBalance(resolved);
    } catch (error) {
      console.error("Error getting order:", error);
      throw error;
    }
  }

  /**
   * Update order status
   */
  static async updateOrderStatus(
    merchantId: string,
    orderId: string,
    status: string
  ) {
    const db = getDb();

    try {
      const updates: Record<string, unknown> = { status };

      if (status === "completed") {
        updates.completedAt = new Date();
      }

      const order = await db
        .update(schema.orders)
        .set(updates)
        .where(
          and(
            eq(schema.orders.id, orderId),
            eq(schema.orders.merchantId, merchantId)
          )
        )
        .returning();

      if (order.length === 0) {
        throw new Error("Order not found");
      }

      return order[0];
    } catch (error) {
      console.error("Error updating order:", error);
      throw error;
    }
  }

  /**
   * Online / POS lifecycle actions for web_shop (and optionally POS) orders.
   *
   * Flow:
   *  pending|pending_approval → accept → accepted
   *  accepted → start_preparing → preparing
   *  preparing → mark_ready → ready
   *  ready + delivery → out_for_delivery
   *  collect_payment → paymentStatus completed
   *  complete → completed (pickup/dine_in from ready; delivery from out_for_delivery)
   *  reject → cancelled
   */
  static async applyOrderAction(
    merchantId: string,
    orderId: string,
    action: string,
    opts?: {
      paymentMethod?: string | null;
      rejectReason?: string | null;
      estimatedReadyAt?: string | Date | null;
      etaAdjustMinutes?: number | null;
      /** WebPOS already printed the guest receipt locally on collect. */
      skipReceiptPrint?: boolean;
    }
  ) {
    const db = getDb();
    const order = await db.query.orders.findFirst({
      where: and(eq(schema.orders.id, orderId), eq(schema.orders.merchantId, merchantId)),
    });
    if (!order) throw new Error("Order not found");

    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
      columns: {
        name: true,
        pickupEtaMinutes: true,
        deliveryEtaMinutes: true,
      },
    });

    const status = order.status || "pending";
    const channel = order.fulfillmentChannel || "takeaway";
    const awaitingApproval = status === "pending" || status === "pending_approval";
    const paymentDone =
      order.paymentStatus === "completed" || order.paymentStatus === "paid";
    const isCash =
      order.paymentMethod === "cash" ||
      order.paymentMethod === "pay_later" ||
      order.paymentMethod === "pay-later" ||
      order.paymentMethod === "invoice" ||
      order.paymentStatus === "cash" ||
      order.paymentStatus === "awaiting_payment";

    const set = async (patch: Record<string, unknown>) => {
      const [updated] = await db
        .update(schema.orders)
        .set(patch)
        .where(and(eq(schema.orders.id, orderId), eq(schema.orders.merchantId, merchantId)))
        .returning();
      if (updated) {
        void import("@/services/ods.service")
          .then(({ OdsService }) => OdsService.syncFromOrder(merchantId, updated))
          .catch(() => {});
      }
      return updated;
    };

    switch (action) {
      case "accept": {
        if (!awaitingApproval) throw new Error("Order is not awaiting approval");
        const estimatedReadyAt = computeEstimatedReadyAt(order, merchant || {});
        const accepted = await set({
          status: "accepted",
          estimatedReadyAt,
        });
        if (order.orderSource === "justeat" || order.orderSource === "ubereats") {
          const { DeliveryPlatformService } = await import("@/services/delivery-platform.service");
          void DeliveryPlatformService.notifyPartnerOrderAccepted(merchantId, accepted).catch((err) =>
            console.warn("Partner accept callback:", err)
          );
        }
        try {
          const { DeliveryPlatformService } = await import("@/services/delivery-platform.service");
          const source =
            order.orderSource === "justeat" || order.orderSource === "ubereats"
              ? order.orderSource
              : "online_shop";
          await DeliveryPlatformService.enqueueAutoPrint(merchantId, orderId, source, {
            printKitchen: true,
            printDeliveryReceipt: false,
            printReceipt: false,
            printNotification: false,
          });
          await db
            .update(schema.orders)
            .set({ printCount: sql`COALESCE(${schema.orders.printCount}, 0) + 1` })
            .where(eq(schema.orders.id, orderId));
        } catch (printErr) {
          console.warn("Accept auto-print enqueue failed:", printErr);
        }
        void import("@/services/kds.service")
          .then(({ KdsService, KdsLicenseError }) =>
            KdsService.pushOrderToKitchen(merchantId, orderId).catch((err) => {
              if (err instanceof KdsLicenseError) return;
              console.warn("Accept KDS push failed:", err);
            })
          )
          .catch(() => {});
        void sendGuestShopOrderEmail(merchantId, orderId, "confirmed", order);
        return set({ status: "preparing" });
      }
      case "start_preparing": {
        if (status !== "accepted" && !awaitingApproval) {
          throw new Error("Order cannot start preparing from current status");
        }
        return set({ status: "preparing" });
      }
      case "mark_ready": {
        if (status !== "preparing" && status !== "accepted") {
          throw new Error("Order is not being prepared");
        }
        const updated = await set({ status: "ready" });
        void sendGuestShopOrderEmail(merchantId, orderId, "ready", order);
        return updated;
      }
      case "out_for_delivery": {
        if (channel !== "delivery") throw new Error("Only delivery orders can go out for delivery");
        if (status !== "ready") throw new Error("Order must be ready before delivery");
        const updated = await set({ status: "out_for_delivery" });
        if (order.orderType === "web_shop" && order.customerEmail) {
          try {
            const { ShopOrderEmailService } = await import("@/services/shop-order-email.service");
            await ShopOrderEmailService.sendGuestOrderEmail(merchantId, orderId, "out_for_delivery");
          } catch (emailErr) {
            console.warn("Out for delivery email failed:", emailErr);
          }
        }
        return updated;
      }
      case "collect_payment": {
        if (paymentDone) throw new Error("Payment already completed");
        {
          const invoiceOrder = isInvoiceOrderRecord(order);
          const method = resolveCollectPaymentMethod(opts?.paymentMethod, order);
          const closeInternal = !usesExternalKitchenLifecycle(order);
          const updated = await set({
            paymentStatus: "completed",
            paymentMethod: method,
            ...(closeInternal
              ? { status: "completed", completedAt: new Date() }
              : {}),
            ...(invoiceOrder
              ? {
                  paymentBreakdown: [
                    { method, amount: roundMoney2(Number(order.total) || 0) },
                  ],
                }
              : {}),
          });
          try {
            const { InventoryService } = await import("@/services/inventory.service");
            await InventoryService.deductForPaidOrder(merchantId, orderId);
          } catch (invErr) {
            console.warn("Inventory deduct after collect_payment failed:", invErr);
          }
          // Invoice A4 was printed at sale — do not print a second receipt/invoice.
          // POS Pay Later / WebPOS collect: till prints locally (one copy).
          const wasPayLater = /^pay[_-]?later/i.test(String(order.paymentMethod || ""));
          if (!invoiceOrder && !wasPayLater && !opts?.skipReceiptPrint) {
            try {
              await enqueueOnlineOrderReceiptPrint(merchantId, orderId, order);
            } catch (printErr) {
              console.warn("Collect payment receipt print enqueue failed:", printErr);
            }
          }
          return updated;
        }
      }
      case "complete": {
        if (channel === "delivery") {
          if (status !== "out_for_delivery" && status !== "ready") {
            throw new Error("Delivery order must be out for delivery (or ready) to complete");
          }
        } else if (status !== "ready" && status !== "preparing") {
          throw new Error("Order must be ready to complete");
        }
        // Cash / pay-later: require payment collection first (unless already paid)
        if (!paymentDone && isCash) {
          throw new Error("Collect payment before completing this order");
        }
        return set({ status: "completed", completedAt: new Date() });
      }
      case "complete_and_collect": {
        // Ready / out_for_delivery: collect + complete (handoff).
        // Earlier kitchen statuses: staff/admin may collect payment now and
        // leave fulfillment open (POS invoice and online shop pickup).
        const readyToHandoff = status === "ready" || status === "out_for_delivery";
        const collectWhileOpen =
          status === "preparing" ||
          status === "accepted" ||
          status === "sent_to_kitchen" ||
          status === "completed";
        if (!readyToHandoff && !collectWhileOpen) {
          throw new Error("Order is not ready to collect payment");
        }
        {
          const invoiceOrder = isInvoiceOrderRecord(order);
          const method = resolveCollectPaymentMethod(opts?.paymentMethod, order);
          const invoiceBreakdown = invoiceOrder
            ? {
                paymentBreakdown: [
                  { method, amount: roundMoney2(Number(order.total) || 0) },
                ],
              }
            : {};
          const closeNow = readyToHandoff || !usesExternalKitchenLifecycle(order);
          const updated = await set(
            closeNow
              ? {
                  status: "completed",
                  paymentStatus: "completed",
                  paymentMethod: method,
                  completedAt: new Date(),
                  ...invoiceBreakdown,
                }
              : {
                  paymentStatus: "completed",
                  paymentMethod: method,
                  ...invoiceBreakdown,
                }
          );
          try {
            const { InventoryService } = await import("@/services/inventory.service");
            await InventoryService.deductForPaidOrder(merchantId, orderId);
          } catch (invErr) {
            console.warn("Inventory deduct after complete_and_collect failed:", invErr);
          }
          // Invoice A4 was printed at sale — do not print a second receipt/invoice.
          // POS Pay Later / WebPOS collect: till prints locally (one copy).
          const wasPayLater = /^pay[_-]?later/i.test(String(order.paymentMethod || ""));
          if (!invoiceOrder && !wasPayLater && !opts?.skipReceiptPrint) {
            try {
              await enqueueOnlineOrderReceiptPrint(merchantId, orderId, order);
            } catch (printErr) {
              console.warn("Complete-and-collect receipt print enqueue failed:", printErr);
            }
          }
          return updated;
        }
      }
      case "reject":
      case "cancel": {
        if (status === "completed") throw new Error("Cannot cancel a completed order");
        const reasonText = resolvePosCancelReason(String(opts?.rejectReason || ""));
        const updated = await set({
          status: "cancelled",
          cancelReason: reasonText || null,
          cancelledAt: new Date(),
        });
        if (action === "reject") {
          if (order.orderType === "web_shop" && order.customerEmail) {
            void sendGuestShopOrderEmail(merchantId, orderId, "cancelled", order);
          } else {
            void sendOrderRejectedEmail(
              merchantId,
              { ...order, cancelReason: reasonText },
              merchant?.name || "Store"
            );
          }
        } else if (order.orderType === "web_shop" && order.customerEmail) {
          void sendGuestShopOrderEmail(merchantId, orderId, "cancelled", order);
        }
        return updated;
      }
      case "adjust_eta": {
        let next: Date;
        if (opts?.estimatedReadyAt) {
          next = new Date(opts.estimatedReadyAt);
        } else {
          const adjust = Number(opts?.etaAdjustMinutes || 0);
          const base = order.estimatedReadyAt ? new Date(order.estimatedReadyAt) : new Date();
          next = new Date(base.getTime() + adjust * 60 * 1000);
        }
        if (Number.isNaN(next.getTime())) throw new Error("Invalid ETA");
        return set({ estimatedReadyAt: next });
      }
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  /**
   * Update payment status
   */
  static async updatePaymentStatus(
    merchantId: string,
    orderId: string,
    paymentStatus: "pending" | "completed" | "failed"
  ) {
    const db = getDb();

    try {
      const order = await db
        .update(schema.orders)
        .set({ paymentStatus })
        .where(
          and(
            eq(schema.orders.id, orderId),
            eq(schema.orders.merchantId, merchantId)
          )
        )
        .returning();

      if (order.length === 0) {
        throw new Error("Order not found");
      }

      if (paymentStatus === "completed") {
        try {
          const { InventoryService } = await import("@/services/inventory.service");
          await InventoryService.deductForPaidOrder(merchantId, orderId);
        } catch (invErr) {
          console.warn("Inventory deduct after payment status failed:", invErr);
        }
      }

      return order[0];
    } catch (error) {
      console.error("Error updating payment status:", error);
      throw error;
    }
  }

  /**
   * Get daily sales
   */
  static async getDailySales(merchantId: string, date: Date) {
    const db = getDb();

    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const orders = await db.query.orders.findMany({
        where: and(
          eq(schema.orders.merchantId, merchantId),
          eq(schema.orders.status, "completed"),
          gte(schema.orders.createdAt, startOfDay),
          lte(schema.orders.createdAt, endOfDay)
        ),
      });

      const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(order.total.toString()), 0);
      const totalTax = orders.reduce((sum, order) => sum + parseFloat(order.taxAmount.toString()), 0);
      const totalDiscount = orders.reduce((sum, order) => sum + parseFloat(order.discountAmount.toString()), 0);

      return {
        date,
        orderCount: orders.length,
        totalRevenue,
        totalTax,
        totalDiscount,
        netRevenue: totalRevenue - totalDiscount,
      };
    } catch (error) {
      console.error("Error getting daily sales:", error);
      throw error;
    }
  }

  /**
   * Get sales by payment method
   */
  static async getSalesByPaymentMethod(
    merchantId: string,
    startDate?: Date,
    endDate?: Date
  ) {
    const db = getDb();

    try {
      let whereConditions: any[] = [
        eq(schema.orders.merchantId, merchantId),
        eq(schema.orders.status, "completed"),
      ];

      if (startDate && endDate) {
        whereConditions.push(gte(schema.orders.createdAt, startDate));
        whereConditions.push(lte(schema.orders.createdAt, endDate));
      }

      const orders = await db.query.orders.findMany({
        where: and(...whereConditions),
      });

      const breakdown: Record<string, number> = {};

      orders.forEach((order) => {
        const method = order.paymentMethod || "unknown";
        breakdown[method] = (breakdown[method] || 0) + parseFloat(order.total.toString());
      });

      return breakdown;
    } catch (error) {
      console.error("Error getting sales by payment method:", error);
      throw error;
    }
  }

  /**
   * Cancel order and restore stock
   */
  static async cancelOrder(merchantId: string, orderId: string) {
    const db = getDb();

    try {
      const order = await db.query.orders.findFirst({
        where: and(
          eq(schema.orders.id, orderId),
          eq(schema.orders.merchantId, merchantId)
        ),
        with: {
          items: true,
        },
      });

      if (!order) {
        throw new Error("Order not found");
      }

      // Restore stock
      for (const item of order.items) {
        const product = await db.query.products.findFirst({
          where: eq(schema.products.id, item.productId),
        });

        if (product) {
          await db
            .update(schema.products)
            .set({ stock: product.stock + item.quantity })
            .where(eq(schema.products.id, item.productId));
        }
      }

      // Update order status
      const updatedOrder = await db
        .update(schema.orders)
        .set({ status: "cancelled" })
        .where(eq(schema.orders.id, orderId))
        .returning();

      return updatedOrder[0];
    } catch (error) {
      console.error("Error cancelling order:", error);
      throw error;
    }
  }
}
