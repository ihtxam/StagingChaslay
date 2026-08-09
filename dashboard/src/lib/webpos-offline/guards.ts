import {
  OFFLINE_SAFE_PAYMENT_METHODS,
  isBrowserOnline,
  isWebPosOfflineEnabled,
} from './types';

export type OfflineCartLineLike = {
  giftCard?: unknown;
  productId?: string | null;
};

/** True when the cart contains gift-card sell/reload lines (need online credit API). */
export function cartHasOfflineUnsafeLines(lines: OfflineCartLineLike[]): boolean {
  return lines.some(
    (l) =>
      !!l.giftCard ||
      String(l.productId || '').startsWith('__gift_card_')
  );
}

export function isOfflineSafePaymentMethod(method: string): boolean {
  return OFFLINE_SAFE_PAYMENT_METHODS.has(method);
}

/**
 * Whether this tender can be completed without the cloud right now.
 * Terminal / gift card / pay-later always require online APIs.
 */
export function canCompleteSaleOffline(
  method: string,
  lines: OfflineCartLineLike[]
): boolean {
  if (!isWebPosOfflineEnabled()) return false;
  if (!isOfflineSafePaymentMethod(method)) return false;
  if (cartHasOfflineUnsafeLines(lines)) return false;
  return true;
}

/** Active offline mode: feature on and browser reports offline (or forced for tests). */
export function isWebPosCurrentlyOffline(): boolean {
  return isWebPosOfflineEnabled() && !isBrowserOnline();
}

export type OfflineBlockReason =
  | 'offline_disabled'
  | 'payment_method'
  | 'gift_card_lines'
  | 'gift_card_tender'
  | 'ok';

export function offlineSaleBlockReason(
  method: string,
  lines: OfflineCartLineLike[],
  opts?: { hasGiftCardTender?: boolean }
): OfflineBlockReason {
  if (!isWebPosOfflineEnabled()) return 'offline_disabled';
  if (opts?.hasGiftCardTender) return 'gift_card_tender';
  if (cartHasOfflineUnsafeLines(lines)) return 'gift_card_lines';
  if (!isOfflineSafePaymentMethod(method)) return 'payment_method';
  return 'ok';
}
