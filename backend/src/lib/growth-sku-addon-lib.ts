import { sql } from "drizzle-orm";
import { getDb } from "@/db";

export function isGrowthSkuAddonEnabled(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true" || value === "t";
}

function firstRow(result: unknown): Record<string, unknown> | undefined {
  if (!result) return undefined;
  if (Array.isArray(result)) return result[0] as Record<string, unknown> | undefined;
  const r = result as { rows?: Record<string, unknown>[] };
  if (Array.isArray(r.rows)) return r.rows[0];
  return undefined;
}

export type GrowthSkuAddonApi = {
  readEnabled: (merchantId: string) => Promise<boolean>;
  writeEnabled: (merchantId: string, enabled: boolean) => Promise<boolean>;
  merchantHasLicense: (merchantId: string) => Promise<boolean>;
};

export function createGrowthSkuAddon(config: {
  columnSnake: string;
  columnCamel: string;
  ensureColumn: () => Promise<void>;
}): GrowthSkuAddonApi {
  const { columnSnake, columnCamel, ensureColumn } = config;

  function flagFromRow(row: Record<string, unknown> | undefined): boolean {
    if (!row) return false;
    return isGrowthSkuAddonEnabled(row[columnSnake] ?? row[columnCamel]);
  }

  async function readEnabled(merchantId: string): Promise<boolean> {
    await ensureColumn();
    const db = getDb();
    const result = await db.execute(
      sql`SELECT ${sql.raw(columnSnake)} FROM merchants WHERE id = ${merchantId} LIMIT 1`
    );
    const row = firstRow(result);
    if (!row) throw new Error("Merchant not found");
    return flagFromRow(row);
  }

  async function writeEnabled(merchantId: string, enabled: boolean): Promise<boolean> {
    await ensureColumn();
    const db = getDb();
    const on = isGrowthSkuAddonEnabled(enabled);
    await db.execute(
      sql`UPDATE merchants SET ${sql.raw(columnSnake)} = ${on}, updated_at = NOW() WHERE id = ${merchantId}`
    );
    try {
      const { EditionEntitlementsService } = await import("@/services/edition-entitlements.service");
      EditionEntitlementsService.invalidate(merchantId);
    } catch {
      /* optional cache */
    }
    return readEnabled(merchantId);
  }

  return {
    readEnabled,
    writeEnabled,
    merchantHasLicense: readEnabled,
  };
}
