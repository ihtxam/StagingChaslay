/** Normalize merchant custom domain (hostname only, lowercase, no scheme/path). */
export function normalizeCustomDomain(raw?: string | null): string | null {
  if (raw == null) return null;
  let host = String(raw).trim().toLowerCase();
  if (!host) return null;
  host = host.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  host = host.split(":")[0].replace(/^www\./, "");
  return host || null;
}
