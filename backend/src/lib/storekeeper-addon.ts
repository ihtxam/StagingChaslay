import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  ensureInventoryAddonColumn,
  ensureStorekeeperAddonColumn,
} from "@/lib/ensure-merchant-schema";
import { readInventoryAddonEnabled, isInventoryAddonEnabled } from "@/lib/inventory-addon";

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

export function isStorekeeperAddonEnabled(value: unknown): boolean {
  return isAddonFlag(value);
}

export class StorekeeperLicenseError extends Error {
  constructor(message = "Storekeeper addon is not enabled") {
    super(message);
    this.name = "StorekeeperLicenseError";
  }
}

/** Storekeeper mobile app — own addon, or bundled with full inventory addon. */
export async function readStorekeeperAddonEnabled(merchantId: string): Promise<boolean> {
  await ensureStorekeeperAddonColumn();
  await ensureInventoryAddonColumn();
  const db = getDb();
  const result = await db.execute(
    sql`SELECT storekeeper_addon_enabled, inventory_addon_enabled FROM merchants WHERE id = ${merchantId} LIMIT 1`
  );
  const row = firstRow(result);
  if (!row) throw new Error("Merchant not found");
  const storekeeper = isStorekeeperAddonEnabled(
    row.storekeeper_addon_enabled ?? row.storekeeperAddonEnabled
  );
  const inventory = isInventoryAddonEnabled(
    row.inventory_addon_enabled ?? row.inventoryAddonEnabled
  );
  return storekeeper || inventory;
}

export async function writeStorekeeperAddonEnabled(
  merchantId: string,
  enabled: boolean
): Promise<boolean> {
  await ensureStorekeeperAddonColumn();
  const db = getDb();
  const on = isStorekeeperAddonEnabled(enabled);
  await db.execute(
    sql`UPDATE merchants SET storekeeper_addon_enabled = ${on}, updated_at = NOW() WHERE id = ${merchantId}`
  );
  return readStorekeeperAddonEnabled(merchantId);
}

export async function assertStorekeeperLicensed(merchantId: string): Promise<void> {
  const on = await readStorekeeperAddonEnabled(merchantId);
  if (!on) throw new StorekeeperLicenseError();
}
