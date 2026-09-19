import { eq, and } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { normalizePosPrintSettings } from "@/lib/pos-print-settings";
import { shouldAutoAcceptOnlineShopOrder } from "@/lib/online-shop-auto-accept";
import { normalizeAdyenEcommerceTender } from "@/lib/shop-adyen-session";
import { ShopLoyaltyService } from "@/services/shop-loyalty.service";

type Merchant = typeof schema.merchants.$inferSelect;
type Order = typeof schema.orders.$inferSelect;

/** Status after card payment is confirmed for an online shop order. */
export function resolvePaidOnlineShopOrderStatus(
  merchant: Merchant,
  order: Order
): string {
  const shopAutoAccept = shouldAutoAcceptOnlineShopOrder(merchant, order);
  return shopAutoAccept ? "preparing" : "pending_approval";
}

/**
 * POS notification, kitchen ingress, guest emails — run when a paid online shop order
 * should appear in the merchant workflow (on create for cash, or after card confirm).
 */
export async function runOnlineShopOrderArrivalSideEffects(
  merchant: Merchant,
  order: Order,
  opts?: {
    guestLocale?: string | null;
    /** Guest receipt on card confirm (pickup); create-time cash flow keeps this false. */
    printGuestReceipt?: boolean;
  }
): Promise<void> {
  if (order.orderType !== "web_shop") return;

  const shopAutoAccept = shouldAutoAcceptOnlineShopOrder(merchant, order);
  const arrivalPrint = normalizePosPrintSettings(merchant.posPrintSettings);
  const kitchenOnArrival =
    !shopAutoAccept && arrivalPrint.autoPrintOnlineOrdersOnArrival === true;

  if (shopAutoAccept) {
    const { enterKitchenFromOrder } = await import("@/services/kitchen-ingress.service");
    void enterKitchenFromOrder(merchant.id, order.id, {
      printKitchen: true,
      orderSource: "online_shop",
    });
  }

  try {
    const { DeliveryPlatformService } = await import("@/services/delivery-platform.service");
    await DeliveryPlatformService.enqueueAutoPrint(merchant.id, order.id, "online_shop", {
      printDeliveryReceipt: order.fulfillmentChannel === "delivery",
      printNotification: order.fulfillmentChannel !== "delivery",
      printKitchen: kitchenOnArrival,
      printReceipt: opts?.printGuestReceipt === true && order.fulfillmentChannel !== "delivery",
      independentOfMasterAutoPrint: kitchenOnArrival,
    });
  } catch (printErr) {
    console.warn("Shop order arrival print enqueue failed:", printErr);
  }

  try {
    const { ShopOrderEmailService } = await import("@/services/shop-order-email.service");
    await ShopOrderEmailService.sendGuestOrderEmail(merchant.id, order.id, "received", {
      guestLocale: opts?.guestLocale || null,
    });
    if (shopAutoAccept) {
      await ShopOrderEmailService.sendGuestOrderEmail(merchant.id, order.id, "confirmed", {
        guestLocale: opts?.guestLocale || null,
      });
    }
  } catch (mailErr) {
    console.warn("Shop order confirmation email failed:", mailErr);
  }
}

/**
 * After Adyen card payment: move order out of awaiting_payment and notify merchant workflow.
 * Idempotent when status is no longer awaiting_payment.
 */
export async function finalizePaidOnlineShopCardOrder(
  merchant: Merchant,
  order: Order,
  opts?: {
    guestLocale?: string | null;
    pspReference?: string | null;
    /** Adyen method type from Drop-in / webhook (twint, scheme, …). Not CardOnFile. */
    adyenPaymentMethod?: unknown;
  }
): Promise<Order> {
  const db = getDb();
  const unpaidShopCard =
    order.orderType === "web_shop" &&
    order.paymentStatus === "awaiting_payment" &&
    String(order.paymentMethod || "").toLowerCase() === "card";

  if (!unpaidShopCard) {
    try {
      return await ShopLoyaltyService.earnForPaidOrder(merchant, order);
    } catch (earnErr) {
      console.error("Loyalty earn on already-paid shop order failed:", earnErr);
      return order;
    }
  }

  const needsArrival =
    order.status === "awaiting_payment" ||
    order.status === "pending" ||
    order.status === "pending_approval";

  const tender = normalizeAdyenEcommerceTender(opts?.adyenPaymentMethod);
  const patch: Record<string, unknown> = {
    paymentStatus: "completed",
    // Keep workflow key `card` (Adyen ecommerce). Surface TWINT via breakdown.
    paymentMethod: "card",
  };
  if (tender && tender !== "card") {
    const amount = parseFloat(order.total?.toString() || "0") || 0;
    patch.paymentBreakdown = [{ method: tender, amount }];
  }
  if (opts?.pspReference) {
    patch.adyenReference = opts.pspReference;
  }
  if (needsArrival) {
    patch.status = resolvePaidOnlineShopOrderStatus(merchant, order);
  }

  const [updated] = await db
    .update(schema.orders)
    .set(patch)
    .where(
      and(
        eq(schema.orders.id, order.id),
        eq(schema.orders.paymentStatus, "awaiting_payment")
      )
    )
    .returning();

  if (!updated) {
    const current = await db.query.orders.findFirst({
      where: eq(schema.orders.id, order.id),
    });
    const latest = current || order;
    try {
      return await ShopLoyaltyService.earnForPaidOrder(merchant, latest);
    } catch (earnErr) {
      console.error("Loyalty earn on paid shop order failed:", earnErr);
      return latest;
    }
  }

  if (needsArrival) {
    await runOnlineShopOrderArrivalSideEffects(merchant, updated, {
      guestLocale: opts?.guestLocale,
      printGuestReceipt: true,
    });
  }

  try {
    return await ShopLoyaltyService.earnForPaidOrder(merchant, updated);
  } catch (earnErr) {
    console.error("Loyalty earn on paid shop order failed:", earnErr);
    return updated;
  }
}
