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
