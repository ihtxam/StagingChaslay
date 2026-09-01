import { processAutoPrintOrderJob } from '@/lib/external-order-auto-print';
import { readDeliveryAutoAccept } from '@/lib/delivery-auto-accept';
import { isAwaitingApproval } from '@/lib/order-management';
import { buildOrderCenterPrintJob } from '@/lib/order-center-print-prefs';

const printedOnArrivalIds = new Set<string>();

type ArrivalOrder = {
  id: string;
  orderSource?: string | null;
  fulfillmentChannel?: string | null;
  status?: string;
};

/** Client-side print when an online order first arrives (before accept). */
export async function maybePrintOnlineOrderOnArrival(
  order: ArrivalOrder,
  settings: Record<string, unknown>,
  opts?: { useOrderCenterPrefs?: boolean }
): Promise<void> {
  const orderId = String(order.id || '').trim();
  if (!orderId || printedOnArrivalIds.has(orderId)) return;
  if (!isAwaitingApproval(order.status)) return;
  if (readDeliveryAutoAccept(settings)) return;

  const ps = (settings.posPrintSettings || {}) as { autoPrintOnlineOrdersOnArrival?: boolean };
  if (ps.autoPrintOnlineOrdersOnArrival !== true) return;

  printedOnArrivalIds.add(orderId);

  try {
    const job = opts?.useOrderCenterPrefs
      ? buildOrderCenterPrintJob(orderId, order.orderSource, order.fulfillmentChannel)
      : (() => {
          const delivery = String(order.fulfillmentChannel || '').toLowerCase() === 'delivery';
          return {
            kind: 'auto_print_order' as const,
            orderId,
            orderSource: order.orderSource || undefined,
            printKitchen: true,
            printDeliveryReceipt: delivery,
            printReceipt: false,
            printNotification: !delivery,
          };
        })();
    if (!job.printKitchen && !job.printReceipt && !job.printDeliveryReceipt) return;
    await processAutoPrintOrderJob({ ...job, force: true });
  } catch {
    printedOnArrivalIds.delete(orderId);
  }
}
