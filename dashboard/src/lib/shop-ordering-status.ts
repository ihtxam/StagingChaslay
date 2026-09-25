export type ShopOrderingBlockReason = 'vacation' | 'orders_paused';

export type ShopOrderingBlockVariant = 'cart' | 'header';

export type ShopVacationReturn = {
  returnDate?: string | null;
  returnTime?: string | null;
};

export type ShopVacationMessageVariant = ShopOrderingBlockVariant | 'reservations';

function formatReturnDate(ymd: string): string {
  const parts = ymd.trim().split('-');
  if (parts.length !== 3) return ymd;
  const [y, m, d] = parts;
  return `${d}-${m}-${y}`;
}

export function formatShopVacationReturnLine(
  t: (key: string, params?: Record<string, string | number>) => string,
  vacationReturn?: ShopVacationReturn | null
): string | null {
  const ymd = vacationReturn?.returnDate?.trim();
  if (!ymd) return null;
  const date = formatReturnDate(ymd);
  const time = (vacationReturn?.returnTime || '').trim().slice(0, 5);
  if (time) return t('shopVacationReturn', { date, time });
  return t('shopVacationReturnDateOnly', { date });
}

export function formatShopVacationMessage(
  t: (key: string, params?: Record<string, string | number>) => string,
  variant: ShopVacationMessageVariant = 'header',
  vacationReturn?: ShopVacationReturn | null
): string {
  const titleKey =
    variant === 'cart'
      ? 'shopVacationOrdersBlocked'
      : variant === 'reservations'
        ? 'shopVacationReservationsBlocked'
        : 'shopVacationTitle';
  const main = t(titleKey);
  const returnLine = formatShopVacationReturnLine(t, vacationReturn);
  return returnLine ? `${main}. ${returnLine}` : main;
}

export function resolveShopOrderingBlock(input: {
  vacationActive?: boolean;
  vacationReturn?: ShopVacationReturn | null;
  acceptingOrders?: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
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
      message: formatShopVacationMessage(input.t, variant, input.vacationReturn),
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
