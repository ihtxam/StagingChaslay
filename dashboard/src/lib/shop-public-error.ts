const SQL_LEAK = /failed query|\bparams\s*:|\bselect\s+["'`]|column ["']?[a-z0-9_]+["']? of relation/i;

export const SHOP_ONLINE_ORDERS_DISABLED = "SHOP_ONLINE_ORDERS_DISABLED";

const LEGACY_SHOP_CLOSED_MESSAGES = new Set([
  "Shop not found or closed",
  SHOP_ONLINE_ORDERS_DISABLED,
]);

export function isShopOnlineOrdersDisabled(raw: unknown): boolean {
  const msg = typeof raw === "string" ? raw.trim() : "";
  return LEGACY_SHOP_CLOSED_MESSAGES.has(msg);
}

/** Hide raw database errors on the public shop. Server logs keep the real message. */
export function customerShopError(
  raw: unknown,
  fallback: string,
  t?: (key: string) => string
): string {
  if (isShopOnlineOrdersDisabled(raw)) {
    return t?.("shopOnlineOrdersDisabled") ?? fallback;
  }
  const msg = typeof raw === "string" ? raw.trim() : "";
  if (!msg || SQL_LEAK.test(msg) || msg.length > 240) return fallback;
  return msg;
}
