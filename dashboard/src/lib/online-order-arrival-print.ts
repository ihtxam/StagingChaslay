import { processAutoPrintOrderJob } from '@/lib/external-order-auto-print';
import { readDeliveryAutoAccept } from '@/lib/delivery-auto-accept';
import { isAwaitingApproval } from '@/lib/order-management';

const printedOnArrivalIds = new Set<string>();

type ArrivalOrder = {
  id: string;
  orderSource?: string | null;
  fulfillmentChannel?: string | null;
  status?: string;
};

/** Client-side kitchen / notification print when an online order first arrives (before accept). */
export async function maybePrintOnlineOrderOnArrival(
  order: ArrivalOrder,
  settings: Record<string, unknown>
): Promise<void> {
  const orderId = String(order.id || '').trim();
  if (!orderId || printedOnArrivalIds.has(orderId)) return;
  if (!isAwaitingApproval(order.status)) return;
  if (readDeliveryAutoAccept(settings)) return;

  const ps = (settings.posPrintSettings || {}) as { autoPrintOnlineOrdersOnArrival?: boolean };
  if (ps.autoPrintOnlineOrdersOnArrival !== true) return;

  printedOnArrivalIds.add(orderId);
  const delivery = String(order.fulfillmentChannel || '').toLowerCase() === 'delivery';

  try {
    await processAutoPrintOrderJob({
      kind: 'auto_print_order',
      orderId,
      orderSource: order.orderSource || undefined,
      printKitchen: true,
      printDeliveryReceipt: delivery,
      printReceipt: false,
      printNotification: !delivery,
    });
  } catch {
    printedOnArrivalIds.delete(orderId);
  }
}
