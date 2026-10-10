import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureSmsAddonColumns } from "@/lib/ensure-merchant-schema";
import { isGrowthSkuAddonEnabled } from "@/lib/growth-sku-addon-lib";
import { normalizeSmsTier, type SmsTierKey } from "@/lib/sms-tiers";

export const isSmsAddonEnabled = isGrowthSkuAddonEnabled;

function firstRow(result: unknown): Record<string, unknown> | undefined {
  if (!result) return undefined;
  if (Array.isArray(result)) return result[0] as Record<string, unknown> | undefined;
  const r = result as { rows?: Record<string, unknown>[] };
  if (Array.isArray(r.rows)) return r.rows[0];
  return undefined;
}

export async function readSmsAddonEnabled(merchantId: string): Promise<boolean> {
  await ensureSmsAddonColumns();
  const db = getDb();
  const result = await db.execute(
    sql`SELECT sms_addon_enabled FROM merchants WHERE id = ${merchantId} LIMIT 1`
  );
  const row = firstRow(result);
  if (!row) throw new Error("Merchant not found");
  return isSmsAddonEnabled(row.sms_addon_enabled ?? row.smsAddonEnabled);
}

export async function readSmsAddonState(merchantId: string): Promise<{
  enabled: boolean;
  tier: SmsTierKey;
}> {
  await ensureSmsAddonColumns();
  const db = getDb();
  const result = await db.execute(
    sql`SELECT sms_addon_enabled, sms_tier FROM merchants WHERE id = ${merchantId} LIMIT 1`
  );
  const row = firstRow(result);
  if (!row) throw new Error("Merchant not found");
  return {
    enabled: isSmsAddonEnabled(row.sms_addon_enabled ?? row.smsAddonEnabled),
    tier: normalizeSmsTier(row.sms_tier ?? row.smsTier),
  };
}

export async function writeSmsAddonEnabled(merchantId: string, enabled: boolean): Promise<boolean> {
  await ensureSmsAddonColumns();
  const db = getDb();
  const on = isSmsAddonEnabled(enabled);
  await db.execute(
    sql`UPDATE merchants SET sms_addon_enabled = ${on}, updated_at = NOW() WHERE id = ${merchantId}`
  );
  try {
    const { EditionEntitlementsService } = await import("@/services/edition-entitlements.service");
    EditionEntitlementsService.invalidate(merchantId);
  } catch {
    /* cache optional */
  }
  return readSmsAddonEnabled(merchantId);
}

export async function writeSmsTier(merchantId: string, tier: string): Promise<SmsTierKey> {
  await ensureSmsAddonColumns();
  const db = getDb();
  const next = normalizeSmsTier(tier);
  await db.execute(
    sql`UPDATE merchants SET sms_tier = ${next}, updated_at = NOW() WHERE id = ${merchantId}`
  );
  return next;
}

export async function merchantHasSmsLicense(merchantId: string): Promise<boolean> {
  return readSmsAddonEnabled(merchantId).catch(() => false);
}
