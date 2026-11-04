/** Shared demo showcase merchant login aliases (staging app.chaslay.com + prod demo shop). */

export function demoMerchantSlug(): string {
  return (process.env.SEED_DEMO_SLUG || "demo").trim().toLowerCase();
}

export function demoMerchantOwnerEmailAliases(): string[] {
  const canonical = (process.env.SEED_DEMO_MERCHANT_EMAIL || "demo@rebornsense.com")
    .trim()
    .toLowerCase();
  const extraRaw =
    process.env.SEED_DEMO_MERCHANT_EMAIL_ALIASES || "demo@chaslay.com,demo@rebornsense.com";
  const extra = extraRaw
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set([canonical, ...extra])];
}

export function isDemoMerchantOwnerEmail(email: string): boolean {
  const normalized = String(email || "")
    .trim()
    .toLowerCase();
  if (!normalized) return false;
  return demoMerchantOwnerEmailAliases().includes(normalized);
}
