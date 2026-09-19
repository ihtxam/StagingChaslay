import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { normalizeDeliveryPlatformSettings } from "@/lib/delivery-platform-settings";
import { normalizePosPrintSettings } from "@/lib/pos-print-settings";

type Merchant = typeof schema.merchants.$inferSelect;
type Order = typeof schema.orders.$inferSelect;

/** Status after card payment is confirmed for an online shop order. */
export function resolvePaidOnlineShopOrderStatus(shopAutoAccept: boolean): string {
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

  const deliverySettings = normalizeDeliveryPlatformSettings(merchant.deliveryPlatformSettings);
  const shopAutoAccept = deliverySettings.onlineShopAutoAccept === true;
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
      printNotification: !shopAutoAccept && order.fulfillmentChannel !== "delivery",
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
  }
): Promise<Order> {
  const db = getDb();
  const deliverySettings = normalizeDeliveryPlatformSettings(merchant.deliveryPlatformSettings);
  const shopAutoAccept = deliverySettings.onlineShopAutoAccept === true;
  const unpaidShopCard =
    order.orderType === "web_shop" &&
    order.paymentStatus === "awaiting_payment" &&
    String(order.paymentMethod || "").toLowerCase() === "card";
  const needsArrival =
    order.status === "awaiting_payment" ||
    (unpaidShopCard && (order.status === "pending" || order.status === "pending_approval"));

  const patch: Record<string, unknown> = {
    paymentStatus: "completed",
    paymentMethod: "card",
  };
  if (opts?.pspReference) {
    patch.adyenReference = opts.pspReference;
  }
  if (needsArrival) {
    patch.status = resolvePaidOnlineShopOrderStatus(shopAutoAccept);
  }

  const [updated] = await db
    .update(schema.orders)
    .set(patch)
    .where(eq(schema.orders.id, order.id))
    .returning();

  const finalOrder = updated || order;

  if (needsArrival) {
    await runOnlineShopOrderArrivalSideEffects(merchant, finalOrder, {
      guestLocale: opts?.guestLocale,
      printGuestReceipt: true,
    });
  }

  return finalOrder;
}
