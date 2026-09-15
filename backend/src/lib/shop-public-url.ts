import type { merchants } from "@/db/schema";
import { resolveShopPublicHost } from "@/lib/brand";

type MerchantShopUrl = Pick<
  typeof merchants.$inferSelect,
  "slug" | "subdomain" | "customDomain"
>;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Public shop base URL (custom domain → subdomain → shop hub /{slug}). */
export function shopPublicBaseUrl(merchant: MerchantShopUrl): string {
  const shopHost = resolveShopPublicHost();
  const apex = shopHost.replace(/^shop\./, "").replace(/^app\./, "").replace(/^order\./, "");
  const custom = String(merchant.customDomain || "")
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
  if (custom) return `https://${custom}`;
  const sub = String(merchant.subdomain || "").trim();
  if (sub) return `https://${sub}.${apex}`;
  const slug = String(merchant.slug || "").trim();
  if (slug) return `https://${shopHost}/${encodeURIComponent(slug)}`;
  return `https://${shopHost}`;
}

/** Adyen return URL after online gift-card payment. */
export function shopGiftCardPaymentReturnUrl(
  merchant: MerchantShopUrl,
  purchaseId: string
): string {
  const base = shopPublicBaseUrl(merchant).replace(/\/+$/, "");
  return `${base}/gift-cards/confirm/${encodeURIComponent(purchaseId)}?paid=1`;
}

/** Session reference is `{merchantId}-{purchaseId}`. */
export function giftCardPurchaseIdFromAdyenReference(
  merchantId: string,
  merchantReference: string
): string | null {
  const mid = String(merchantId || "").trim();
  const ref = String(merchantReference || "").trim();
  if (!mid || !ref.startsWith(`${mid}-`)) return null;
  const purchaseId = ref.slice(mid.length + 1);
  return UUID_RE.test(purchaseId) ? purchaseId : null;
}

/** True when merchant Adyen client key looks like a Drop-in client key (not API key). */
export function isValidAdyenClientKey(clientKey: string | null | undefined): boolean {
  const k = String(clientKey || "").trim();
  return k.startsWith("test_") || k.startsWith("live_");
}

/** Shop card payments ready when merchant account, API key, and valid client key are set. */
export function shopAdyenCardReady(merchant: {
  adyenMerchantAccount?: string | null;
  adyenApiKey?: string | null;
  adyenClientId?: string | null;
}): boolean {
  return !!(
    merchant.adyenMerchantAccount &&
    merchant.adyenApiKey &&
    isValidAdyenClientKey(merchant.adyenClientId)
  );
}
