import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureGuestCrmAddonColumn } from "@/lib/ensure-merchant-schema";

export function isGuestCrmAddonEnabled(value: unknown): boolean {
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
  return isGuestCrmAddonEnabled(row.guest_crm_addon_enabled ?? row.guestCrmAddonEnabled);
}

export async function readGuestCrmAddonEnabled(merchantId: string): Promise<boolean> {
  await ensureGuestCrmAddonColumn();
  const db = getDb();
  const result = await db.execute(
    sql`SELECT guest_crm_addon_enabled FROM merchants WHERE id = ${merchantId} LIMIT 1`
  );
  const row = firstRow(result);
  if (!row) throw new Error("Merchant not found");
  return flagFromRow(row);
}

export async function writeGuestCrmAddonEnabled(
  merchantId: string,
  enabled: boolean
): Promise<boolean> {
  await ensureGuestCrmAddonColumn();
  const db = getDb();
  const on = isGuestCrmAddonEnabled(enabled);
  await db.execute(
    sql`UPDATE merchants SET guest_crm_addon_enabled = ${on}, updated_at = NOW() WHERE id = ${merchantId}`
  );
  try {
    const { EditionEntitlementsService } = await import("@/services/edition-entitlements.service");
    EditionEntitlementsService.invalidate(merchantId);
  } catch {
    /* optional cache */
  }
  return readGuestCrmAddonEnabled(merchantId);
}

export async function merchantHasGuestCrmLicense(merchantId: string): Promise<boolean> {
  return readGuestCrmAddonEnabled(merchantId);
}
