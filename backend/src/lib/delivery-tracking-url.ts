import { randomBytes } from "crypto";
import type { merchants } from "@/db/schema";

type MerchantSlug = Pick<
  typeof merchants.$inferSelect,
  "slug" | "subdomain" | "customDomain"
>;

/** Guest tracking URL (no login) for shop order confirmation page. */
export function buildGuestOrderTrackingUrl(
  merchant: MerchantSlug,
  orderId: string,
  token: string
): string {
  const base = (
    process.env.PUBLIC_APP_URL ||
    process.env.MERCHANT_DASHBOARD_URL ||
    process.env.WEB_SHOP_URL ||
    "http://localhost:5173"
  ).replace(/\/$/, "");
  const slug = merchant.slug || merchant.subdomain || "shop";
  const params = new URLSearchParams({ track: token });
  return `${base}/shop/${encodeURIComponent(slug)}/order/${orderId}?${params.toString()}`;
}

export function generateDeliveryTrackingToken(): string {
  return randomBytes(24).toString("hex");
}

function appBaseUrl(): string {
  return (
    process.env.PUBLIC_APP_URL ||
    process.env.MERCHANT_DASHBOARD_URL ||
    process.env.WEB_SHOP_URL ||
    "http://localhost:5173"
  ).replace(/\/$/, "");
}

/** QR on delivery slip — driver scans to claim the order. */
export function buildDriverClaimUrl(orderId: string, token: string): string {
  const params = new URLSearchParams({ claim: orderId, token });
  return `${appBaseUrl()}/merchant/delivery/driver?${params.toString()}`;
}
