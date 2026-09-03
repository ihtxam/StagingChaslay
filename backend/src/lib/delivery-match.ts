import { and, asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { pointInPolygon } from "@/lib/geo";

export type DeliveryMode = "zones" | "zipcode";

export type DeliveryMatch = {
  id: string;
  name: string;
  minOrderAmount: string | number | null;
  deliveryFee: string | number | null;
  estimatedMinutes: number | null;
};

export function normalizeDeliveryMode(value: unknown): DeliveryMode {
  const mode = String(value || "")
    .trim()
    .toLowerCase();
  return mode === "zipcode" ? "zipcode" : "zones";
}

export function normalizeZipCode(value: unknown): string {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "");
}

function zipInRange(zip: string, from: string | null | undefined, to: string | null | undefined): boolean {
  const zipNum = Number(zip);
  const fromNum = Number(String(from || "").trim());
  const toNum = Number(String(to || "").trim());
  if (!Number.isFinite(zipNum) || !Number.isFinite(fromNum) || !Number.isFinite(toNum)) return false;
  return zipNum >= fromNum && zipNum <= toNum;
}

function matchesZipRule(
  zip: string,
  rule: {
    zipCode?: string | null;
    zipFrom?: string | null;
    zipTo?: string | null;
  }
): boolean {
  const normalized = normalizeZipCode(zip).toLowerCase();
  if (!normalized) return false;
  const exact = normalizeZipCode(rule.zipCode || "").toLowerCase();
  if (exact && exact === normalized) return true;
  if (rule.zipFrom && rule.zipTo) {
    return zipInRange(normalized, rule.zipFrom, rule.zipTo);
  }
  return false;
}

async function findMatchingZoneRule(
  merchantId: string,
  lng?: number,
  lat?: number,
  zip?: string
): Promise<DeliveryMatch | null> {
  const db = getDb();
  const zones = await db.query.deliveryZones.findMany({
    where: and(eq(schema.deliveryZones.merchantId, merchantId), eq(schema.deliveryZones.isActive, true)),
    orderBy: [asc(schema.deliveryZones.sortOrder)],
  });

  if (lng != null && lat != null && Number.isFinite(lng) && Number.isFinite(lat)) {
    const hit = zones.find((z) =>
      pointInPolygon(lng, lat, (z.polygon || []) as Array<[number, number]>)
    );
    if (hit) return hit;
  }

  if (zip) {
    const normalized = normalizeZipCode(zip).toLowerCase();
    const hit = zones.find((z) =>
      (z.zipCodes || []).some((c) => normalizeZipCode(c).toLowerCase() === normalized)
    );
    if (hit) return hit;
  }

  return null;
}

async function findMatchingZipRule(merchantId: string, zip?: string): Promise<DeliveryMatch | null> {
  if (!zip) return null;
  const db = getDb();
  const rules = await db.query.deliveryZipRules.findMany({
    where: and(eq(schema.deliveryZipRules.merchantId, merchantId), eq(schema.deliveryZipRules.isActive, true)),
    orderBy: [asc(schema.deliveryZipRules.sortOrder)],
  });
  return rules.find((rule) => matchesZipRule(zip, rule)) || null;
}

export async function findMatchingDeliveryRule(
  merchantId: string,
  modeInput: unknown,
  lng?: number,
  lat?: number,
  zip?: string
): Promise<DeliveryMatch | null> {
  const mode = normalizeDeliveryMode(modeInput);
  if (mode === "zipcode") {
    return findMatchingZipRule(merchantId, zip);
  }
  return findMatchingZoneRule(merchantId, lng, lat, zip);
}
