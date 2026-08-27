import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  ensureJustEatAddonColumn,
  ensureUberEatsAddonColumn,
} from "@/lib/ensure-merchant-schema";

function isAddonFlag(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true" || value === "t";
}

function firstRow(result: unknown): Record<string, unknown> | undefined {
  if (!result) return undefined;
  if (Array.isArray(result)) return result[0] as Record<string, unknown> | undefined;
  const r = result as { rows?: Record<string, unknown>[] };
  if (Array.isArray(r.rows)) return r.rows[0];
  return undefined;
}

export function isJustEatAddonEnabled(value: unknown): boolean {
  return isAddonFlag(value);
}

export function isUberEatsAddonEnabled(value: unknown): boolean {
  return isAddonFlag(value);
}

export async function readJustEatAddonEnabled(merchantId: string): Promise<boolean> {
  await ensureJustEatAddonColumn();
  const db = getDb();
  const result = await db.execute(
    sql`SELECT just_eat_addon_enabled FROM merchants WHERE id = ${merchantId} LIMIT 1`
  );
  const row = firstRow(result);
  if (!row) throw new Error("Merchant not found");
  return isJustEatAddonEnabled(row.just_eat_addon_enabled ?? row.justEatAddonEnabled);
}

export async function readUberEatsAddonEnabled(merchantId: string): Promise<boolean> {
  await ensureUberEatsAddonColumn();
  const db = getDb();
  const result = await db.execute(
    sql`SELECT uber_eats_addon_enabled FROM merchants WHERE id = ${merchantId} LIMIT 1`
  );
  const row = firstRow(result);
  if (!row) throw new Error("Merchant not found");
  return isUberEatsAddonEnabled(row.uber_eats_addon_enabled ?? row.uberEatsAddonEnabled);
}

export async function writeJustEatAddonEnabled(
  merchantId: string,
  enabled: boolean
): Promise<boolean> {
  await ensureJustEatAddonColumn();
  const db = getDb();
  const on = isJustEatAddonEnabled(enabled);
  await db.execute(
    sql`UPDATE merchants SET just_eat_addon_enabled = ${on}, updated_at = NOW() WHERE id = ${merchantId}`
  );
  return readJustEatAddonEnabled(merchantId);
}

export async function writeUberEatsAddonEnabled(
  merchantId: string,
  enabled: boolean
): Promise<boolean> {
  await ensureUberEatsAddonColumn();
  const db = getDb();
  const on = isUberEatsAddonEnabled(enabled);
  await db.execute(
    sql`UPDATE merchants SET uber_eats_addon_enabled = ${on}, updated_at = NOW() WHERE id = ${merchantId}`
  );
  return readUberEatsAddonEnabled(merchantId);
}
