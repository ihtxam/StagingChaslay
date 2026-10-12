import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureCateringAddonColumn } from "@/lib/ensure-merchant-schema";

/** Paid catering module — merchant-level, off by default. */
export function isCateringAddonEnabled(value: unknown): boolean {
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
  return isCateringAddonEnabled(
    row.catering_enabled ?? row.cateringEnabled ?? row.catering_addon_enabled ?? row.cateringAddonEnabled
  );
}

export function isCateringLicensed(
  input:
    | {
        cateringEnabled?: unknown;
        cateringAddonEnabled?: unknown;
      }
    | null
    | undefined
): boolean {
  if (!input) return false;
  return (
    isCateringAddonEnabled(input.cateringEnabled) || isCateringAddonEnabled(input.cateringAddonEnabled)
  );
}

export async function readCateringAddonEnabled(merchantId: string): Promise<boolean> {
  await ensureCateringAddonColumn();
  const db = getDb();
  const result = await db.execute(
    sql`SELECT catering_enabled FROM merchants WHERE id = ${merchantId} LIMIT 1`
  );
  const row = firstRow(result);
  if (!row) throw new Error("Merchant not found");
  return flagFromRow(row);
}

export async function writeCateringAddonEnabled(
  merchantId: string,
  enabled: boolean
): Promise<boolean> {
  await ensureCateringAddonColumn();
  const db = getDb();
  const on = isCateringAddonEnabled(enabled);
  await db.execute(
    sql`UPDATE merchants SET catering_enabled = ${on}, updated_at = NOW() WHERE id = ${merchantId}`
  );
  try {
    const { EditionEntitlementsService } = await import("@/services/edition-entitlements.service");
    EditionEntitlementsService.invalidate(merchantId);
  } catch {
    /* cache optional */
  }
  return readCateringAddonEnabled(merchantId);
}

export async function readCateringAddonEnabledMap(
  merchantIds: string[]
): Promise<Map<string, boolean>> {
  const out = new Map<string, boolean>();
  if (merchantIds.length === 0) return out;
  await ensureCateringAddonColumn();
  const db = getDb();
  const result = await db.execute(
    sql`SELECT id, catering_enabled FROM merchants WHERE id IN (${sql.join(
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
