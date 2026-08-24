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
