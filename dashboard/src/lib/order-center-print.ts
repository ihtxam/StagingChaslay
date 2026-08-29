import { processAutoPrintOrderJob } from '@/lib/external-order-auto-print';

/** Print kitchen + receipt tickets for an order via local Print Bridge (Sunmi / Bluetooth). */
export async function printOrderCenterTickets(
  orderId: string,
  orderSource?: string | null
): Promise<void> {
  await processAutoPrintOrderJob({
    kind: 'auto_print_order',
    orderId,
    orderSource: orderSource || undefined,
    printKitchen: true,
    printReceipt: true,
    printDeliveryReceipt: true,
    printNotification: false,
    force: true,
  });
}
