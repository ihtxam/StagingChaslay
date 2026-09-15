import { eq, like } from "drizzle-orm";
import type { getDb } from "@/db";
import { schema } from "@/db";

type Db = ReturnType<typeof getDb>;

const COUNTRY_PREFIX: Record<string, string> = {
  CH: "CH",
  SWITZERLAND: "CH",
  SUISSE: "CH",
  SCHWEIZ: "CH",
  UK: "UK",
  GB: "UK",
  "UNITED KINGDOM": "UK",
  DE: "DE",
  GERMANY: "DE",
  DEUTSCHLAND: "DE",
  FR: "FR",
  FRANCE: "FR",
  IT: "IT",
  ITALY: "IT",
  ITALIA: "IT",
  AT: "AT",
  AUSTRIA: "AT",
  ÖSTERREICH: "AT",
  OESTERREICH: "AT",
  NL: "NL",
  NETHERLANDS: "NL",
  BE: "BE",
  BELGIUM: "BE",
  ES: "ES",
  SPAIN: "ES",
  ESPAÑA: "ES",
  ESANA: "ES",
  PT: "PT",
  PORTUGAL: "PT",
  US: "US",
  USA: "US",
  "UNITED STATES": "US",
};

/** Normalize merchant country to a short support prefix (CH, UK, DE, …). */
export function normalizeSupportCountryPrefix(country?: string | null): string {
  const raw = String(country || "CH")
    .trim()
    .toUpperCase()
    .replace(/\./g, "");
  if (COUNTRY_PREFIX[raw]) return COUNTRY_PREFIX[raw];
  if (/^[A-Z]{2}$/.test(raw)) return raw;
  const letters = raw.replace(/[^A-Z]/g, "");
  return letters.slice(0, 2) || "XX";
}

export function formatMerchantSupportCode(prefix: string, seq: number): string {
  return `${prefix}-${String(seq).padStart(3, "0")}`;
}

/** Assign the next support code in a country series, e.g. CH-001, UK-042. */
export async function assignMerchantSupportCode(
  db: Db,
  country?: string | null
): Promise<string> {
  const prefix = normalizeSupportCountryPrefix(country);
  const rows = await db
    .select({ supportCode: schema.merchants.supportCode })
    .from(schema.merchants)
    .where(like(schema.merchants.supportCode, `${prefix}-%`));

  let maxSeq = 0;
  const seqRe = new RegExp(`^${prefix}-(\\d+)$`);
  for (const row of rows) {
    const m = String(row.supportCode || "").match(seqRe);
    if (m) maxSeq = Math.max(maxSeq, parseInt(m[1], 10));
  }

  for (let attempt = 0; attempt < 30; attempt++) {
    const candidate = formatMerchantSupportCode(prefix, maxSeq + 1 + attempt);
    const exists = await db.query.merchants.findFirst({
      where: eq(schema.merchants.supportCode, candidate),
      columns: { id: true },
    });
    if (!exists) return candidate;
  }

  throw new Error(`Failed to assign support code for prefix ${prefix}`);
}
