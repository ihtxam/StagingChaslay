import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  ensureBexioAddonColumn,
  ensureOdooAddonColumn,
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

export function isBexioAddonEnabled(value: unknown): boolean {
  return isAddonFlag(value);
}

export function isOdooAddonEnabled(value: unknown): boolean {
  return isAddonFlag(value);
}

export async function readBexioAddonEnabled(merchantId: string): Promise<boolean> {
  await ensureBexioAddonColumn();
  const db = getDb();
  const result = await db.execute(
    sql`SELECT bexio_addon_enabled FROM merchants WHERE id = ${merchantId} LIMIT 1`
  );
  const row = firstRow(result);
  if (!row) throw new Error("Merchant not found");
  return isBexioAddonEnabled(row.bexio_addon_enabled ?? row.bexioAddonEnabled);
}

export async function readOdooAddonEnabled(merchantId: string): Promise<boolean> {
  await ensureOdooAddonColumn();
  const db = getDb();
  const result = await db.execute(
    sql`SELECT odoo_addon_enabled FROM merchants WHERE id = ${merchantId} LIMIT 1`
  );
  const row = firstRow(result);
  if (!row) throw new Error("Merchant not found");
  return isOdooAddonEnabled(row.odoo_addon_enabled ?? row.odooAddonEnabled);
}

export async function writeBexioAddonEnabled(
  merchantId: string,
  enabled: boolean
): Promise<boolean> {
  await ensureBexioAddonColumn();
  const db = getDb();
  const on = isBexioAddonEnabled(enabled);
  await db.execute(
    sql`UPDATE merchants SET bexio_addon_enabled = ${on}, updated_at = NOW() WHERE id = ${merchantId}`
  );
  return readBexioAddonEnabled(merchantId);
}

export async function writeOdooAddonEnabled(
  merchantId: string,
  enabled: boolean
): Promise<boolean> {
  await ensureOdooAddonColumn();
  const db = getDb();
  const on = isOdooAddonEnabled(enabled);
  await db.execute(
    sql`UPDATE merchants SET odoo_addon_enabled = ${on}, updated_at = NOW() WHERE id = ${merchantId}`
  );
  return readOdooAddonEnabled(merchantId);
}
