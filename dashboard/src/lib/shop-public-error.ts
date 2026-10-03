const SQL_LEAK = /failed query|\bparams\s*:|\bselect\s+["'`]|column ["']?[a-z0-9_]+["']? of relation/i;

/** Hide raw database errors on the public shop. Server logs keep the real message. */
export function customerShopError(raw: unknown, fallback: string): string {
  const msg = typeof raw === "string" ? raw.trim() : "";
  if (!msg || SQL_LEAK.test(msg) || msg.length > 240) return fallback;
  return msg;
}
