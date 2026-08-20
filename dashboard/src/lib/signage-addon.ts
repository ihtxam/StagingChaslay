/** Paid Chaslay Screens (digital signage) addon — accept any of the API field names. */
export function isSignageLicensed(input: {
  enabled?: boolean;
  signageAddonEnabled?: boolean;
  signageEnabled?: boolean;
} | null | undefined): boolean {
  if (!input) return false;
  return !!(input.enabled || input.signageAddonEnabled || input.signageEnabled);
}

export function signageScreenLimitOf(input: { signageScreenLimit?: number } | null | undefined): number {
  const n = Math.floor(Number(input?.signageScreenLimit));
  if (!Number.isFinite(n) || n < 1) return 2;
  return Math.min(99, n);
}
