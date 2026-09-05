import dns from "node:dns/promises";
import { resolveShopPublicHost } from "@/lib/brand";

export type DnsVerifyResult = {
  ok: boolean;
  method?: "cname" | "a";
  value?: string;
  expected?: string;
  reason?: string;
};

const ACCEPTED_CNAME_SUFFIXES = ["rebornsense.com", "chaslay.com", "webprintmedia.swiss"];

function normalizeDnsName(value: string): string {
  return value.replace(/\.$/, "").toLowerCase();
}

function isAcceptedCnameTarget(target: string, shopHost: string): boolean {
  const norm = normalizeDnsName(target);
  if (norm === shopHost) return true;
  if (norm.endsWith(`.${shopHost}`)) return true;
  return ACCEPTED_CNAME_SUFFIXES.some(
    (suffix) => norm === suffix || norm.endsWith(`.${suffix}`)
  );
}

async function resolveCname(host: string): Promise<string[]> {
  try {
    return await dns.resolveCname(host);
  } catch {
    return [];
  }
}

async function resolveIpv4(host: string): Promise<string[]> {
  try {
    return await dns.resolve4(host);
  } catch {
    return [];
  }
}

/**
 * Verify that a hostname points at the platform shop hub (CNAME or flattened A record).
 */
export async function verifyCustomDomainDns(hostname: string): Promise<DnsVerifyResult> {
  const host = hostname.toLowerCase().split(":")[0];
  const shopHost = resolveShopPublicHost().toLowerCase();

  const cnames = await resolveCname(host);
  for (const raw of cnames) {
    const target = normalizeDnsName(raw);
    if (isAcceptedCnameTarget(target, shopHost)) {
      return { ok: true, method: "cname", value: target, expected: shopHost };
    }
  }

  const [hostIps, shopIps] = await Promise.all([resolveIpv4(host), resolveIpv4(shopHost)]);
  const shared = hostIps.find((ip) => shopIps.includes(ip));
  if (shared) {
    return { ok: true, method: "a", value: shared, expected: shopHost };
  }

  return {
    ok: false,
    reason: cnames.length ? "cname_target_mismatch" : "no_matching_dns",
    expected: shopHost,
  };
}
