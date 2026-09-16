/** Recompute delivery minimum-order status from live cart subtotal. */
export function withDeliveryMinOrderStatus<T extends {
  deliverable?: boolean;
  zone?: { minOrderAmount?: number | string | null };
  meetsMinOrder?: boolean;
  message?: string;
} | null | undefined>(
  deliveryInfo: T,
  subtotal: number
): T {
  if (!deliveryInfo?.deliverable) return deliveryInfo;
  const minOrder = Number(deliveryInfo.zone?.minOrderAmount ?? 0);
  const meetsMinOrder = subtotal >= minOrder;
  return {
    ...deliveryInfo,
    meetsMinOrder,
    message: meetsMinOrder
      ? undefined
      : `Minimum order for this zone is CHF ${minOrder.toFixed(2)}`,
  };
}

/** Amount still needed to meet the active delivery zone minimum (0 when met or N/A). */
export function deliveryMinOrderShortfall(
  deliveryInfo: { deliverable?: boolean; zone?: { minOrderAmount?: number | string | null } } | null | undefined,
  subtotal: number
): number {
  if (!deliveryInfo?.deliverable) return 0;
  const minOrder = Number(deliveryInfo.zone?.minOrderAmount ?? 0);
  if (minOrder <= 0 || subtotal >= minOrder) return 0;
  return Math.max(0, Math.round((minOrder - subtotal) * 100) / 100);
}
