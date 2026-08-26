import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureSignageAddonColumn } from "@/lib/ensure-merchant-schema";

/** Paid digital signage (Reborn Screens) addon — merchant-level, not edition-gated. */
export function isSignageAddonEnabled(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true" || value === "t";
}

export function normalizeSignageScreenLimit(value: unknown): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1) return 2;
  return Math.min(99, n);
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
  return isSignageAddonEnabled(row.signage_addon_enabled ?? row.signageAddonEnabled);
}

function limitFromRow(row: Record<string, unknown> | undefined): number {
  if (!row) return 2;
  return normalizeSignageScreenLimit(row.signage_screen_limit ?? row.signageScreenLimit);
}

export async function readSignageAddon(merchantId: string): Promise<{
  enabled: boolean;
  screenLimit: number;
}> {
  await ensureSignageAddonColumn();
  const db = getDb();
  const result = await db.execute(
    sql`SELECT signage_addon_enabled, signage_screen_limit FROM merchants WHERE id = ${merchantId} LIMIT 1`
  );
  const row = firstRow(result);
  if (!row) throw new Error("Merchant not found");
  return { enabled: flagFromRow(row), screenLimit: limitFromRow(row) };
}

export async function readSignageAddonEnabled(merchantId: string): Promise<boolean> {
  const row = await readSignageAddon(merchantId);
  return row.enabled;
}

export async function writeSignageAddonEnabled(merchantId: string, enabled: boolean): Promise<boolean> {
  await ensureSignageAddonColumn();
  const db = getDb();
  const on = isSignageAddonEnabled(enabled);
  await db.execute(
    sql`UPDATE merchants SET signage_addon_enabled = ${on}, updated_at = NOW() WHERE id = ${merchantId}`
  );
  try {
    const { EditionEntitlementsService } = await import("@/services/edition-entitlements.service");
    EditionEntitlementsService.invalidate(merchantId);
  } catch {
    /* cache module may not be loaded yet */
  }
  return readSignageAddonEnabled(merchantId);
}

export async function writeSignageScreenLimit(merchantId: string, limit: number): Promise<number> {
  await ensureSignageAddonColumn();
  const db = getDb();
  const n = normalizeSignageScreenLimit(limit);
  await db.execute(
    sql`UPDATE merchants SET signage_screen_limit = ${n}, updated_at = NOW() WHERE id = ${merchantId}`
  );
  const row = await readSignageAddon(merchantId);
  return row.screenLimit;
}

export async function readSignageAddonMap(
  merchantIds: string[]
): Promise<Map<string, { enabled: boolean; screenLimit: number }>> {
  const out = new Map<string, { enabled: boolean; screenLimit: number }>();
  if (merchantIds.length === 0) return out;
  await ensureSignageAddonColumn();
  const db = getDb();
  const result = await db.execute(
    sql`SELECT id, signage_addon_enabled, signage_screen_limit FROM merchants WHERE id IN (${sql.join(
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
    if (id) out.set(id, { enabled: flagFromRow(row), screenLimit: limitFromRow(row) });
  }
  return out;
}
