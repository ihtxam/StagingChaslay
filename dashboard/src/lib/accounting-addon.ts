export function isBexioLicensed(input: {
  bexioAddonEnabled?: boolean;
} | null | undefined): boolean {
  return input?.bexioAddonEnabled === true;
}

export function isOdooLicensed(input: {
  odooAddonEnabled?: boolean;
} | null | undefined): boolean {
  return input?.odooAddonEnabled === true;
}

export function isAccountingLicensed(input: {
  bexioAddonEnabled?: boolean;
  odooAddonEnabled?: boolean;
  accountingAddonEnabled?: boolean;
} | null | undefined): boolean {
  if (!input) return false;
  return (
    input.accountingAddonEnabled === true ||
    isBexioLicensed(input) ||
    isOdooLicensed(input)
  );
}
