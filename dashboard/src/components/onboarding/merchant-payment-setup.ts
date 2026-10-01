/** True when merchant settings show at least one enabled POS/online payment path. */
export function isMerchantPaymentSetupComplete(
  settings: Record<string, unknown> | null | undefined
): boolean {
  const s = settings || {};
  if (s.adyenMerchantAccount || s.stripeAccountId || s.paymentProvider) return true;
  if (s.acceptCardPayments === true || s.cashPaymentsEnabled === true) return true;
  if (s.webposCashEnabled !== false) return true;
  if (s.webposCardEnabled !== false) return true;
  if (s.webposTerminalEnabled !== false) return true;
  if (s.webposInvoiceEnabled !== false) return true;
  if (s.webposGiftCardEnabled === true) return true;
  return false;
}
