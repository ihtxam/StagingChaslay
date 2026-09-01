import { processAutoPrintOrderJob } from '@/lib/external-order-auto-print';
import {
  buildOrderCenterPrintJob,
  readOrderCenterPrintPrefs,
  type OrderCenterPrintPrefs,
} from '@/lib/order-center-print-prefs';

/** Print selected tickets for an order via Print Bridge on this device (or till queue). */
export async function printOrderCenterTickets(
  orderId: string,
  orderSource?: string | null,
  fulfillmentChannel?: string | null,
  prefs?: OrderCenterPrintPrefs
): Promise<void> {
  const job = buildOrderCenterPrintJob(
    orderId,
    orderSource,
    fulfillmentChannel,
    prefs ?? readOrderCenterPrintPrefs()
  );
  if (!job.printKitchen && !job.printReceipt && !job.printDeliveryReceipt) {
    return;
  }
  await processAutoPrintOrderJob(job);
}
