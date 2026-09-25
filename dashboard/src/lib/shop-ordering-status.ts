export type ShopOrderingBlockReason = 'vacation' | 'orders_paused';

export type ShopOrderingBlockVariant = 'cart' | 'header';

export function resolveShopOrderingBlock(input: {
  vacationActive?: boolean;
  acceptingOrders?: boolean;
  t: (key: string) => string;
  variant?: ShopOrderingBlockVariant;
}): {
  blocked: boolean;
  reason: ShopOrderingBlockReason | null;
  message: string | null;
} {
  const variant = input.variant ?? 'cart';
  if (input.vacationActive) {
    return {
      blocked: true,
      reason: 'vacation',
      message:
        variant === 'header'
          ? input.t('shopVacationTitle')
          : input.t('shopVacationOrdersBlocked'),
    };
  }
  if (input.acceptingOrders === false) {
    return {
      blocked: true,
      reason: 'orders_paused',
      message: input.t('shopNotAcceptingOrders'),
    };
  }
  return { blocked: false, reason: null, message: null };
}

/** Hide the delivery line when it would repeat the pickup status verbatim. */
export function shouldShowDeliveryChannelStatus(
  pickupStatusText: string,
  deliveryStatusText: string | null
): boolean {
  return deliveryStatusText != null && deliveryStatusText !== pickupStatusText;
}
