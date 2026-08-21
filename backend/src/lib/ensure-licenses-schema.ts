import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { isMissingSchemaError } from "@/lib/db-schema-errors";

/**
 * Idempotent devices/licenses patches. Production often has the core tables
 * but is missing later columns (issued_by_reseller_id), which makes every
 * Drizzle SELECT on licenses 500.
 */
const LICENSE_SCHEMA_PATCHES: string[] = [
  `CREATE TABLE IF NOT EXISTS devices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    device_id varchar(255) NOT NULL UNIQUE,
    device_name varchar(255) NOT NULL,
    device_type varchar(50) NOT NULL,
    os_version varchar(50),
    app_version varchar(50),
    last_sync timestamp,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS devices_merchant_id_idx ON devices (merchant_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS devices_device_id_idx ON devices (device_id)`,
  `CREATE TABLE IF NOT EXISTS licenses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    device_id uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    license_key varchar(255) NOT NULL UNIQUE,
    license_type varchar(50) NOT NULL,
    trial_days integer DEFAULT 7,
    starts_at timestamp NOT NULL,
    expires_at timestamp NOT NULL,
    renewal_notified_at timestamp,
    status varchar(50) NOT NULL DEFAULT 'active',
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS licenses_merchant_id_idx ON licenses (merchant_id)`,
  `CREATE INDEX IF NOT EXISTS licenses_device_id_idx ON licenses (device_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS licenses_license_key_idx ON licenses (license_key)`,
  `CREATE INDEX IF NOT EXISTS licenses_status_idx ON licenses (status)`,
  `CREATE INDEX IF NOT EXISTS licenses_expires_at_idx ON licenses (expires_at)`,
  // Column only — FK to resellers is optional so a missing resellers table cannot block licenses
  `ALTER TABLE licenses ADD COLUMN IF NOT EXISTS issued_by_reseller_id uuid`,
  `CREATE INDEX IF NOT EXISTS licenses_issued_by_reseller_idx ON licenses (issued_by_reseller_id)`,
  `ALTER TABLE resellers ADD COLUMN IF NOT EXISTS license_seats integer NOT NULL DEFAULT 0`,
];

let patchPromise: Promise<void> | null = null;

export async function ensureLicensesSchema(): Promise<boolean> {
  const db = getDb();
  let applied = false;
  for (const statement of LICENSE_SCHEMA_PATCHES) {
    try {
      await db.execute(sql.raw(statement));
      applied = true;
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err ?? "");
      // resellers.license_seats is optional; devices/licenses patches are required
      if (/resellers/i.test(statement) && /does not exist|undefined table/i.test(raw)) {
        continue;
      }
      console.warn("[schema] license patch failed:", statement.slice(0, 80), err);
    }
  }
  if (applied) {
    console.info("[schema] devices/licenses tables ensured");
  }
  return applied;
}

export function ensureLicensesSchemaAtStartup(): void {
  if (patchPromise) return;
  patchPromise = ensureLicensesSchema().catch((err) => {
    console.warn("[schema] licenses startup patch failed:", err);
  });
}

/** Retry a licenses query after applying missing-column/table patches. */
export async function withLicenseSchemaRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error ?? "");
    if (!isMissingSchemaError(raw) && !/relation ["']?(licenses|devices)["']? does not exist/i.test(raw)) {
      throw error;
    }
    await ensureLicensesSchema();
    return fn();
  }
}
