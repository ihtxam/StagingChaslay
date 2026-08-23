import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureOdsAddonColumn } from "@/lib/ensure-merchant-schema";

/** Paid order display system (ODS) addon — merchant-level, not edition-gated. */
export function isOdsAddonEnabled(value: unknown): boolean {
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
  return isOdsAddonEnabled(row.ods_addon_enabled ?? row.odsAddonEnabled);
}

export async function readOdsAddonEnabled(merchantId: string): Promise<boolean> {
  await ensureOdsAddonColumn();
  const db = getDb();
  const result = await db.execute(
    sql`SELECT ods_addon_enabled FROM merchants WHERE id = ${merchantId} LIMIT 1`
  );
  const row = firstRow(result);
  if (!row) throw new Error("Merchant not found");
  return flagFromRow(row);
}

export async function writeOdsAddonEnabled(
  merchantId: string,
  enabled: boolean
): Promise<boolean> {
  await ensureOdsAddonColumn();
  const db = getDb();
  const on = isOdsAddonEnabled(enabled);
  await db.execute(
    sql`UPDATE merchants SET ods_addon_enabled = ${on}, updated_at = NOW() WHERE id = ${merchantId}`
  );
  try {
    const { EditionEntitlementsService } = await import("@/services/edition-entitlements.service");
    EditionEntitlementsService.invalidate(merchantId);
  } catch {
    /* cache module may not be loaded yet */
  }
  return readOdsAddonEnabled(merchantId);
}

export async function readOdsAddonEnabledMap(
  merchantIds: string[]
): Promise<Map<string, boolean>> {
  const out = new Map<string, boolean>();
  if (merchantIds.length === 0) return out;
  await ensureOdsAddonColumn();
  const db = getDb();
  const result = await db.execute(
    sql`SELECT id, ods_addon_enabled FROM merchants WHERE id IN (${sql.join(
      merchantIds.map((id) => sql`${id}`),
      sql`, `
    )})`
  );
  const rows = Array.isArray(result)
    ? result
    : ((result as { rows?: Record<string, unknown>[] }).rows ?? []);
  for (const raw of rows) {
    const row = raw as Record<string, unknown>;
    const id = String(row.id || "");
    if (id) out.set(id, flagFromRow(row));
  }
  return out;
}
