import type { AutoPrintOrderPayload } from '@/lib/external-order-auto-print';

export type OrderCenterKitchenRoute = 'local' | 'till';

export type OrderCenterPrintPrefs = {
  /** Kitchen ticket so staff can prepare the order. */
  kitchen: boolean;
  /** Customer receipt (itemised sale receipt). */
  customerReceipt: boolean;
  /** Delivery address slip — only used for delivery orders. */
  deliverySlip: boolean;
  /**
   * `local` — print kitchen on this device's Print Bridge printer (shop-only / autonomous).
   * `till` — use Settings → Printers kitchen stations; queue to main till when needed.
   */
  kitchenRoute: OrderCenterKitchenRoute;
};

const STORAGE_KEY = 'manupos_order_center_print_prefs';

export const DEFAULT_ORDER_CENTER_PRINT_PREFS: OrderCenterPrintPrefs = {
  kitchen: true,
  customerReceipt: false,
  deliverySlip: true,
  kitchenRoute: 'local',
};

export function readOrderCenterPrintPrefs(): OrderCenterPrintPrefs {
  if (typeof window === 'undefined') return { ...DEFAULT_ORDER_CENTER_PRINT_PREFS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_ORDER_CENTER_PRINT_PREFS };
    const parsed = JSON.parse(raw) as Partial<OrderCenterPrintPrefs>;
    return {
      kitchen: parsed.kitchen !== false,
      customerReceipt: parsed.customerReceipt === true,
      deliverySlip: parsed.deliverySlip !== false,
      kitchenRoute: parsed.kitchenRoute === 'till' ? 'till' : 'local',
    };
  } catch {
    return { ...DEFAULT_ORDER_CENTER_PRINT_PREFS };
  }
}

export function saveOrderCenterPrintPrefs(prefs: OrderCenterPrintPrefs): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export function buildOrderCenterPrintJob(
  orderId: string,
  orderSource?: string | null,
  fulfillmentChannel?: string | null,
  prefs: OrderCenterPrintPrefs = readOrderCenterPrintPrefs()
): AutoPrintOrderPayload {
  const delivery = String(fulfillmentChannel || '').toLowerCase() === 'delivery';
  return {
    kind: 'auto_print_order',
    orderId,
    orderSource: orderSource || undefined,
    printKitchen: prefs.kitchen,
    printReceipt: prefs.customerReceipt,
    printDeliveryReceipt: delivery && prefs.deliverySlip,
    printNotification: false,
    force: true,
    kitchenLocalOnly: prefs.kitchenRoute === 'local',
  };
}
