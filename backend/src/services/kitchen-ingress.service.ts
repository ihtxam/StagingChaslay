import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { OrderSource } from "@/lib/delivery-platform-settings";

/** Push a persisted order to KDS + ODS (idempotent). Optional kitchen print enqueue. */
export async function enterKitchenFromOrder(
  merchantId: string,
  orderId: string,
  opts?: {
    printKitchen?: boolean;
    orderSource?: OrderSource;
  }
): Promise<void> {
  const db = getDb();
  const order = await db.query.orders.findFirst({
    where: and(eq(schema.orders.id, orderId), eq(schema.orders.merchantId, merchantId)),
    columns: {
      id: true,
      orderNumber: true,
      notes: true,
      status: true,
      orderSource: true,
      fulfillmentChannel: true,
    },
  });
  if (!order) return;

  void import("@/services/kds.service")
    .then(({ KdsService, KdsLicenseError }) =>
      KdsService.pushOrderToKitchen(merchantId, orderId).catch((err) => {
        if (err instanceof KdsLicenseError) return;
        console.warn("Kitchen ingress KDS push failed:", err);
      })
    )
    .catch(() => {});

  void import("@/services/ods.service")
    .then(({ OdsService }) => OdsService.syncFromOrder(merchantId, order).catch(() => {}))
    .catch(() => {});

  if (opts?.printKitchen) {
    const src =
      opts.orderSource ||
      (order.orderSource === "justeat" || order.orderSource === "ubereats"
        ? order.orderSource
        : "online_shop");
    void import("@/services/delivery-platform.service")
      .then(({ DeliveryPlatformService }) =>
        DeliveryPlatformService.enqueueAutoPrint(merchantId, orderId, src as OrderSource, {
          printKitchen: true,
          printDeliveryReceipt: false,
          printReceipt: false,
          printNotification: false,
        }).catch((err) => console.warn("Kitchen ingress print enqueue failed:", err))
      )
      .catch(() => {});
  }
}
