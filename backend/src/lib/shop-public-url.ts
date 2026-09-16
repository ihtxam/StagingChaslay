import type { merchants } from "@/db/schema";
import { resolveShopPublicHost } from "@/lib/brand";

type MerchantShopUrl = Pick<
  typeof merchants.$inferSelect,
  "slug" | "subdomain" | "customDomain"
>;

/** Public shop base URL (custom domain → subdomain → shop hub /{slug}). */
export function shopPublicBaseUrl(merchant: MerchantShopUrl): string {
  const shopHost = resolveShopPublicHost();
  const apex = shopHost.replace(/^shop\./, "").replace(/^app\./, "");
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

/** Adyen return URL for guest shop order payment confirmation. */
export function shopOrderPaymentReturnUrl(
  merchant: MerchantShopUrl,
  orderId: string,
  query: Record<string, string> = { paid: "1" }
): string {
  const base = shopPublicBaseUrl(merchant).replace(/\/+$/, "");
  const params = new URLSearchParams(query);
  const qs = params.toString();
  return `${base}/order/${encodeURIComponent(orderId)}${qs ? `?${qs}` : ""}`;
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
