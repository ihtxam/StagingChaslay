import { isDeliveryOrPickupShopOrder, isUnconfirmedCardOnlineOrder } from '@/lib/order-management';

/** Whether delivery portal / online shop auto-accept is enabled. */
export function readDeliveryAutoAccept(settings: unknown): boolean {
  const root = settings as {
    deliveryPlatformSettings?: Record<string, unknown>;
    settings?: { deliveryPlatformSettings?: Record<string, unknown> };
  };
  const dp = root.deliveryPlatformSettings || root.settings?.deliveryPlatformSettings || {};
  const justEat = dp.justEat as { autoAccept?: boolean } | undefined;
  const uberEats = dp.uberEats as { autoAccept?: boolean } | undefined;
  return !!(justEat?.autoAccept || uberEats?.autoAccept || dp.onlineShopAutoAccept);
}

export function onlineOrderAlertStatuses(autoAccept: boolean): Set<string> {
  if (autoAccept) {
    return new Set(['pending', 'pending_approval', 'preparing']);
  }
  return new Set(['pending', 'pending_approval']);
}

/** Whether an online order should trigger POS / panel arrival alerts. */
export function shouldAlertForOnlineOrder(
  o: {
    status?: string | null;
    paymentStatus?: string | null;
    paymentMethod?: string | null;
    orderType?: string | null;
    orderSource?: string | null;
    channel?: string | null;
    fulfillmentChannel?: string | null;
  },
  autoAccept: boolean
): boolean {
  if (isUnconfirmedCardOnlineOrder(o)) return false;
  return onlineOrderAlertStatuses(autoAccept).has(String(o.status || '').toLowerCase());
}

/**
 * Auto-accept on arrival applies to third-party delivery platforms only.
 * Online shop delivery/pickup must use the ETA accept modal (accept/reject + prep time).
 */
export function shouldAutoAcceptOrderOnArrival(o: {
  orderSource?: string | null;
  orderType?: string | null;
  channel?: string | null;
  fulfillmentChannel?: string | null;
}): boolean {
  if (isDeliveryOrPickupShopOrder(o)) return false;
  const src = String(o.orderSource || '').toLowerCase();
  return src === 'justeat' || src === 'ubereats';
}
