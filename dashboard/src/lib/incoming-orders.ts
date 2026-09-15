/** Statuses polled by Order Hub and Web POS for active online / QR / kiosk orders. */
export const INCOMING_ONLINE_ORDER_STATUSES = [
  'pending',
  'pending_approval',
  'accepted',
  'preparing',
  'ready',
  'out_for_delivery',
] as const;

export const INCOMING_ONLINE_ORDER_STATUSES_PARAM = INCOMING_ONLINE_ORDER_STATUSES.join(',');

/** Completed / cancelled history for POS Online Orders Completed + Archives tabs. */
export const ONLINE_ORDER_HISTORY_STATUSES = [
  'completed',
  'cancelled',
  'refunded',
  'partially_refunded',
] as const;

export const ONLINE_ORDER_HISTORY_STATUSES_PARAM = ONLINE_ORDER_HISTORY_STATUSES.join(',');
