export function isJustEatLicensed(input: {
  justEatAddonEnabled?: boolean;
} | null | undefined): boolean {
  return input?.justEatAddonEnabled === true;
}

export function isUberEatsLicensed(input: {
  uberEatsAddonEnabled?: boolean;
} | null | undefined): boolean {
  return input?.uberEatsAddonEnabled === true;
}

/** Just Eat + Uber Eats module — one paid addon, like KDS/ODS. */
export function isDeliveryPlatformsLicensed(input: {
  justEatAddonEnabled?: boolean;
  uberEatsAddonEnabled?: boolean;
  deliveryPlatformsAddonEnabled?: boolean;
} | null | undefined): boolean {
  if (!input) return false;
  return (
    input.deliveryPlatformsAddonEnabled === true ||
    isJustEatLicensed(input) ||
    isUberEatsLicensed(input)
  );
}
