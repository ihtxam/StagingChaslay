import type { merchants } from "@/db/schema";
import { resolveShopPublicHost } from "@/lib/brand";
import { isValidAdyenClientKey, shopAdyenCardReady } from "@/lib/adyen-checkout-env";

export type MerchantShopUrl = Pick<
  typeof merchants.$inferSelect,
  "slug" | "subdomain" | "customDomain"
>;

const PLATFORM_HOST_RE = /(^|\.)(chaslay\.com|rebornsense\.com|webprintmedia\.swiss)$/i;

function brandApex(): string {
  return resolveShopPublicHost()
    .toLowerCase()
    .replace(/^shop\./, "")
    .replace(/^app\./, "");
}

function normalizeHostname(value: string): string {
  return String(value || "")
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "")
    .split("/")[0]
    ?.split(":")[0]
    ?.toLowerCase() || "";
}

/** Public shop base URL (custom domain → subdomain → shop hub /{slug}). */
export function shopPublicBaseUrl(merchant: MerchantShopUrl): string {
  const shopHost = resolveShopPublicHost();
  const custom = normalizeHostname(String(merchant.customDomain || ""));
  if (custom) return `https://${custom}`;
  const sub = String(merchant.subdomain || "").trim();
  if (sub) return `https://${sub}.${brandApex()}`;
  const slug = String(merchant.slug || "").trim();
  if (slug) return `https://${shopHost}/${encodeURIComponent(slug)}`;
  return `https://${shopHost}`;
}

export function shopPublicOrigin(merchant: MerchantShopUrl): string {
  try {
    return new URL(shopPublicBaseUrl(merchant)).origin;
  } catch {
    return `https://${resolveShopPublicHost()}`;
  }
}

export function parseOriginCandidate(raw: string | null | undefined): string | null {
  const value = String(raw || "").trim();
  if (!value) return null;
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    const host = url.hostname.toLowerCase();
    const isLocal = host === "localhost" || host === "127.0.0.1";
    if (url.protocol === "https:" || (url.protocol === "http:" && isLocal)) {
      return `${url.protocol}//${url.host}`;
    }
    return null;
  } catch {
    return null;
  }
}

export function isAllowedShopOrigin(origin: string, merchant: MerchantShopUrl): boolean {
  const parsed = parseOriginCandidate(origin);
  if (!parsed) return false;
  const host = new URL(parsed).hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1") return true;
  if (PLATFORM_HOST_RE.test(host)) return true;

  const custom = normalizeHostname(String(merchant.customDomain || ""));
  if (custom && (host === custom || host === `www.${custom}` || `www.${host}` === custom)) {
    return true;
  }

  const sub = String(merchant.subdomain || "").trim().toLowerCase();
  if (sub && host === `${sub}.${brandApex()}`) return true;

  return false;
}

export function resolveShopCheckoutOrigin(
  merchant: MerchantShopUrl,
  ...candidates: Array<string | null | undefined>
): string {
  for (const candidate of candidates) {
    const parsed = parseOriginCandidate(candidate);
    if (parsed && isAllowedShopOrigin(parsed, merchant)) return parsed;
  }
  return shopPublicOrigin(merchant);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Client-provided shopBasePath (`''`, `/{slug}`, `/shop/{slug}`, plus optional `/l/{loc}`). */
export function sanitizeShopPathPrefix(
  raw: string | null | undefined,
  merchant: MerchantShopUrl
): string | null {
  const slug = String(merchant.slug || "").trim();
  const value = String(raw || "").trim().replace(/\/+$/, "");
  if (!value) return "";
  if (!slug) return /^\/(?:shop)?(?:\/l\/[-a-z0-9]+)?$/i.test(value) ? value : null;
  const re = new RegExp(
    `^(?:/shop)?(?:/${escapeRegex(slug)})?(?:/l/[-a-z0-9]+)?$`,
    "i"
  );
  return re.test(value) ? value : null;
}

export function shopPathPrefixForOrigin(merchant: MerchantShopUrl, origin: string): string {
  const parsed = parseOriginCandidate(origin);
  const host = parsed ? new URL(parsed).hostname.toLowerCase() : "";
  const slug = String(merchant.slug || "").trim();
  const custom = normalizeHostname(String(merchant.customDomain || ""));
  if (custom && (host === custom || host === `www.${custom}` || `www.${host}` === custom)) {
    return "";
  }
  const sub = String(merchant.subdomain || "").trim().toLowerCase();
  if (sub && host === `${sub}.${brandApex()}`) return "";

  const shopHost = resolveShopPublicHost().toLowerCase();
  if (host === shopHost || host.startsWith("shop.")) {
    return slug ? `/${encodeURIComponent(slug)}` : "";
  }
  return slug ? `/shop/${encodeURIComponent(slug)}` : "/shop";
}

export function buildShopPaymentReturnUrl(opts: {
  merchant: MerchantShopUrl;
  suffix: string;
  origin?: string | null;
  shopPath?: string | null;
  extraCandidates?: Array<string | null | undefined>;
}): string {
  const origin = resolveShopCheckoutOrigin(
    opts.merchant,
    opts.origin,
    ...(opts.extraCandidates || [])
  );
  const rawPath = opts.shopPath;
  const fromClient =
    rawPath == null || String(rawPath).trim() === ""
      ? null
      : sanitizeShopPathPrefix(rawPath, opts.merchant);
  const prefix = fromClient != null ? fromClient : shopPathPrefixForOrigin(opts.merchant, origin);
  const suffix = opts.suffix.startsWith("/") ? opts.suffix : `/${opts.suffix}`;
  return `${origin}${prefix}${suffix}`;
}

export function shopOrderPaymentReturnUrl(
  merchant: MerchantShopUrl,
  orderId: string,
  opts: {
    origin?: string | null;
    shopPath?: string | null;
    extraCandidates?: Array<string | null | undefined>;
    query?: Record<string, string>;
  } = {}
): string {
  const params = new URLSearchParams(opts.query || { paid: "1" });
  return buildShopPaymentReturnUrl({
    merchant,
    origin: opts.origin,
    shopPath: opts.shopPath,
    extraCandidates: opts.extraCandidates,
    suffix: `/order/${encodeURIComponent(orderId)}?${params.toString()}`,
  });
}

export function shopGiftCardPaymentReturnUrl(
  merchant: MerchantShopUrl,
  purchaseId: string,
  opts: {
    origin?: string | null;
    shopPath?: string | null;
    extraCandidates?: Array<string | null | undefined>;
  } = {}
): string {
  return buildShopPaymentReturnUrl({
    merchant,
    origin: opts.origin,
    shopPath: opts.shopPath,
    extraCandidates: opts.extraCandidates,
    suffix: `/gift-cards/confirm/${encodeURIComponent(purchaseId)}`,
  });
}

export function shopTablePaymentReturnUrl(
  merchant: MerchantShopUrl,
  tableId: string,
  opts: {
    origin?: string | null;
    shopPath?: string | null;
    sessionToken?: string | null;
    extraCandidates?: Array<string | null | undefined>;
  } = {}
): string {
  const params = new URLSearchParams({ paid: "1" });
  if (opts.sessionToken) params.set("s", opts.sessionToken);
  return buildShopPaymentReturnUrl({
    merchant,
    origin: opts.origin,
    shopPath: opts.shopPath,
    extraCandidates: opts.extraCandidates,
    suffix: `/table/${encodeURIComponent(tableId)}?${params.toString()}`,
  });
}

export { isValidAdyenClientKey, shopAdyenCardReady };
