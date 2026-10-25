/** Paid Esendex SMS (OTP, transactional alerts, marketing) — off unless enabled on the merchant. */
export function isSmsLicensed(input?: { smsAddonEnabled?: boolean } | null): boolean {
  return input?.smsAddonEnabled === true;
}
