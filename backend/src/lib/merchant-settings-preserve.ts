/**
 * Settings PATCH/PUT helpers: empty/undefined secrets and tax fields must not
 * clobber existing merchant values (password change, unrelated store push, etc.).
 */

export function isMaskedSecret(value: unknown): boolean {
  return String(value || "").includes("••••");
}

/** True when the incoming value is a real secret the caller intends to write. */
export function shouldWriteCredential(value: unknown): value is string {
  if (value == null) return false;
  const s = String(value).trim();
  if (!s) return false;
  if (isMaskedSecret(s)) return false;
  return true;
}

/**
 * Incoming tax rate for a PATCH. Returns undefined to preserve the existing DB
 * value (empty / omitted). Throws on out-of-range numbers.
 */
export function incomingTaxRateOrPreserve(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    throw new Error(`${field} must be between 0 and 100`);
  }
  return n.toFixed(2);
}
