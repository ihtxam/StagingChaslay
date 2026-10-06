import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureGrowthAnalyticsAddonColumn } from "@/lib/ensure-merchant-schema";

export function isGrowthAnalyticsAddonEnabled(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true" || value === "t";
}

function firstRow(result: unknown): Record<string, unknown> | undefined {
  if (!result) return undefined;
  if (Array.isArray(result)) return result[0] as Record<string, unknown> | undefined;
  const r = result as { rows?: Record<string, unknown>[] };
  if (Array.isArray(r.rows)) return r.rows[0];
  return undefined;
}

function flagFromRow(row: Record<string, unknown> | undefined): boolean {
  if (!row) return false;
  return isGrowthAnalyticsAddonEnabled(
    row.growth_analytics_addon_enabled ?? row.growthAnalyticsAddonEnabled
  );
}

export async function readGrowthAnalyticsAddonEnabled(merchantId: string): Promise<boolean> {
  await ensureGrowthAnalyticsAddonColumn();
  const db = getDb();
  const result = await db.execute(
    sql`SELECT growth_analytics_addon_enabled FROM merchants WHERE id = ${merchantId} LIMIT 1`
  );
  const row = firstRow(result);
  if (!row) throw new Error("Merchant not found");
  return flagFromRow(row);
}

export async function writeGrowthAnalyticsAddonEnabled(
  merchantId: string,
  enabled: boolean
): Promise<boolean> {
  await ensureGrowthAnalyticsAddonColumn();
  const db = getDb();
  const on = isGrowthAnalyticsAddonEnabled(enabled);
  await db.execute(
    sql`UPDATE merchants SET growth_analytics_addon_enabled = ${on}, updated_at = NOW() WHERE id = ${merchantId}`
  );
  try {
    const { EditionEntitlementsService } = await import("@/services/edition-entitlements.service");
    EditionEntitlementsService.invalidate(merchantId);
  } catch {
    /* optional cache */
  }
  return readGrowthAnalyticsAddonEnabled(merchantId);
}

export async function merchantHasGrowthAnalyticsLicense(merchantId: string): Promise<boolean> {
  return readGrowthAnalyticsAddonEnabled(merchantId);
}
