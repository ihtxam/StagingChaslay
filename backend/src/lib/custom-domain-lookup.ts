import { inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { customDomainHostVariants, customDomainMatches } from "@/lib/domain";

type MerchantRow = typeof schema.merchants.$inferSelect;

function customDomainDnsAllowsShop(dnsStatus: string | null | undefined): boolean {
  const dns = String(dnsStatus || "none").toLowerCase();
  return dns === "none" || dns === "verified";
}

/** Resolve merchant by custom domain Host, matching apex and www interchangeably. */
export async function findMerchantByCustomDomainHost(
  hostOrSlug: string
): Promise<MerchantRow | null> {
  const variants = customDomainHostVariants(hostOrSlug);
  if (!variants.length) return null;

  const db = getDb();
  const rows = await db.query.merchants.findMany({
    where: inArray(schema.merchants.customDomain, variants),
  });

  for (const merchant of rows) {
    if (!customDomainMatches(merchant.customDomain, hostOrSlug)) continue;
    if (!customDomainDnsAllowsShop(merchant.customDomainDnsStatus)) continue;
    return merchant;
  }
  return null;
}

/** Same as findMerchantByCustomDomainHost but for TLS ask (verified/pending rules). */
export async function findMerchantForTlsAsk(host: string): Promise<MerchantRow | null> {
  const variants = customDomainHostVariants(host);
  if (!variants.length) return null;

  const db = getDb();
  const rows = await db.query.merchants.findMany({
    where: inArray(schema.merchants.customDomain, variants),
  });

  for (const merchant of rows) {
    if (!customDomainMatches(merchant.customDomain, host)) continue;
    const dns = String(merchant.customDomainDnsStatus || "none").toLowerCase();
    if (dns !== "none" && dns !== "verified") continue;
    return merchant;
  }
  return null;
}
