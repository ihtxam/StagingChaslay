const PANEL_PREFIXES = ["app.", "admin."];
const PLATFORM_SUBDOMAINS = new Set(["app", "admin", "api", "order", "shop", "pay", "status"]);

function hostFromRequest(headers: Record<string, unknown>): string {
  const raw = String(headers["x-forwarded-host"] || headers.host || "")
    .split(",")[0]
    ?.trim()
    .toLowerCase();
  return raw?.split(":")[0] || "";
}

export function isPanelAppHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return PANEL_PREFIXES.some((prefix) => host.startsWith(prefix));
}

export function isShopPathHubHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  const shopPublic = String(process.env.SHOP_PUBLIC_HOST || "")
    .trim()
    .toLowerCase();
  if (shopPublic && host === shopPublic) return true;
  if (host === "order.rebornsense.com" || host === "shop.chaslay.com") return true;
  if (host.startsWith("shop.")) return true;
  return false;
}

/** True when this host serves customer shops (path, subdomain, or custom domain). */
export function isShopRequestHost(headers: Record<string, unknown>): boolean {
  const host = hostFromRequest(headers);
  if (!host || host === "localhost" || host === "127.0.0.1") return false;
  if (isPanelAppHost(host)) return false;
  if (host === "api.rebornsense.com" || host.startsWith("api.")) return false;
  if (host === "pay.rebornsense.com" || host.startsWith("pay.")) return false;
  if (isShopPathHubHost(host)) return true;

  const domain = String(process.env.DOMAIN || "rebornsense.com").toLowerCase();
  if (host.endsWith(`.${domain}`)) {
    const sub = host.slice(0, -(domain.length + 1));
    if (sub && !PLATFORM_SUBDOMAINS.has(sub)) return true;
  }
  // Custom domains terminate TLS via on_demand — anything else is treated as a shop host.
  if (!host.endsWith(`.${domain}`) && host !== domain && !host.endsWith(".rebornsense.com") && !host.endsWith(".chaslay.com")) {
    return true;
  }
  return false;
}

export function shopSlugFromPath(path: string): string | null {
  const segment = String(path || "")
    .split("?")[0]
    .split("#")[0]
    .split("/")
    .filter(Boolean)[0];
  if (!segment) return null;
  const reserved = new Set([
    "api",
    "assets",
    "openpage",
    "downloads",
    "health",
    "merchant",
    "kds",
    "kiosk",
    "tv",
    "cds",
    "receipt",
    "receipts",
  ]);
  if (reserved.has(segment.toLowerCase())) return null;
  return segment;
}

export function requestLooksLikeSpaDocument(path: string, accept: string): boolean {
  const lowerPath = String(path || "").split("?")[0];
  if (/\.[a-z0-9]{2,8}$/i.test(lowerPath)) return false;
  const acceptHeader = String(accept || "").toLowerCase();
  if (acceptHeader.includes("text/html")) return true;
  if (!acceptHeader || acceptHeader === "*/*") return true;
  return false;
}

export { hostFromRequest };
