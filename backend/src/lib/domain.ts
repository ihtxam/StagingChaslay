/** Strip scheme/port and lowercase — keeps www when present. */
export function parseHostname(raw?: string | null): string | null {
  if (raw == null) return null;
  let host = String(raw).trim().toLowerCase();
  if (!host) return null;
  host = host.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  host = host.split(":")[0];
  return host || null;
}

/** Normalize merchant custom domain (hostname only, lowercase, no scheme/path). */
export function normalizeCustomDomain(raw?: string | null): string | null {
  const host = parseHostname(raw);
  if (!host) return null;
  return host.replace(/^www\./, "") || null;
}

/** Host labels to match stored custom_domain against incoming Host (apex ↔ www). */
export function customDomainHostVariants(rawHost: string): string[] {
  const host = parseHostname(rawHost);
  if (!host) return [];
  const apex = host.replace(/^www\./, "");
  return [...new Set([host, apex, `www.${apex}`])];
}

/** True when request Host matches stored custom domain (ignores www prefix). */
export function customDomainMatches(
  storedDomain: string | null | undefined,
  requestHost: string
): boolean {
  const stored = normalizeCustomDomain(storedDomain);
  const host = normalizeCustomDomain(requestHost);
  return !!stored && !!host && stored === host;
}

/** Preserve www (and other host labels) — used by the custom-domain wizard. */
export function normalizeCustomDomainHost(raw?: string | null): string | null {
  if (raw == null) return null;
  let host = String(raw).trim().toLowerCase();
  if (!host) return null;
  host = host.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  host = host.split(":")[0];
  return host || null;
}

const DOMAIN_LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;

/** Basic hostname validation for merchant-entered domains. */
export function isValidCustomDomainHost(host: string): boolean {
  if (!host || host.length > 253) return false;
  if (host.includes("..") || host.startsWith(".") || host.endsWith(".")) return false;
  return DOMAIN_LABEL.test(host);
}
