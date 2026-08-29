import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureKioskAddonColumn } from "@/lib/ensure-merchant-schema";

/** Paid self-order kiosk addon — merchant-level. */
export function isKioskAddonEnabled(value: unknown): boolean {
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
  return isKioskAddonEnabled(row.kiosk_addon_enabled ?? row.kioskAddonEnabled);
}

export async function readKioskAddonEnabled(merchantId: string): Promise<boolean> {
  await ensureKioskAddonColumn();
  const db = getDb();
  const result = await db.execute(
    sql`SELECT kiosk_addon_enabled FROM merchants WHERE id = ${merchantId} LIMIT 1`
  );
  const row = firstRow(result);
  if (!row) throw new Error("Merchant not found");
  return flagFromRow(row);
}

export async function writeKioskAddonEnabled(
  merchantId: string,
  enabled: boolean
): Promise<boolean> {
  await ensureKioskAddonColumn();
  const db = getDb();
  const on = isKioskAddonEnabled(enabled);
  await db.execute(
    sql`UPDATE merchants SET kiosk_addon_enabled = ${on}, updated_at = NOW() WHERE id = ${merchantId}`
  );
  try {
    const { EditionEntitlementsService } = await import("@/services/edition-entitlements.service");
    EditionEntitlementsService.invalidate(merchantId);
  } catch {
    /* cache optional */
  }
  return readKioskAddonEnabled(merchantId);
}
