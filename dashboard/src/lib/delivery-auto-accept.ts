import {
  isAwaitingApproval,
  isDeliveryOrPickupShopOrder,
  isOnlineShopOrder,
  isTerminalOrderStatus,
  isUnconfirmedCardOnlineOrder,
} from '@/lib/order-management';

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
 * Client should POST accept when the merchant auto-accept toggle is on
 * and the ticket is still awaiting approval. Kiosk / QR table use their own settings.
 */
export function shouldAutoAcceptOrderOnArrival(o: {
  orderSource?: string | null;
  orderType?: string | null;
  channel?: string | null;
  fulfillmentChannel?: string | null;
}): boolean {
  const src = String(o.orderSource || '').toLowerCase();
  if (src === 'kiosk' || src === 'qr_table') return false;
  if (src === 'justeat' || src === 'ubereats') return true;
  return isOnlineShopOrder(o) || isDeliveryOrPickupShopOrder(o);
}

/** ETA Accept & print modal — only when auto-accept is off. */
export function shouldUseEtaAcceptModal(
  o: {
    status?: string | null;
    orderSource?: string | null;
    orderType?: string | null;
    channel?: string | null;
    fulfillmentChannel?: string | null;
  },
  autoAccept: boolean
): boolean {
  if (autoAccept) return false;
  return isAwaitingApproval(String(o.status || '')) && isDeliveryOrPickupShopOrder(o);
}

/**
 * Keep the incoming-order popup / beep until staff acknowledges (auto-accept)
 * or until the ticket leaves pending (manual Accept & print / Reject).
 */
export function keepIncomingOrderAlert(
  o: { status?: string | null },
  autoAccept: boolean
): boolean {
  if (isTerminalOrderStatus(o.status)) return false;
  if (autoAccept) return true;
  return isAwaitingApproval(String(o.status || ''));
}

/** First poll after settings load — do not resurrect already-accepted tickets. */
export function shouldSeedUnactionedAlert(
  o: { status?: string | null },
  autoAccept: boolean
): boolean {
  if (autoAccept && !isAwaitingApproval(String(o.status || ''))) return false;
  return true;
}
