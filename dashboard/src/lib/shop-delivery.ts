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
