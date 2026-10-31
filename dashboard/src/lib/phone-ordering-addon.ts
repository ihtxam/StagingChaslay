/** Paid phone ordering desk + SMS/voice webhooks — off unless reseller/superadmin enables it. */
export function isPhoneOrderingLicensed(input?: {
  phoneOrderingAddonEnabled?: boolean;
} | null): boolean {
  return input?.phoneOrderingAddonEnabled === true;
}
