import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { isMissingSchemaError, missingColumnFromError } from "@/lib/db-schema-errors";

/**
 * Idempotent ALTER statements for merchant columns added after initial deploy.
 * Keeps GET /merchant/settings working when drizzle-kit push lags behind code.
 */
const MERCHANT_COLUMN_PATCHES: Record<string, string> = {
  vat_after_discount:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS vat_after_discount boolean NOT NULL DEFAULT true",
  delivery_platform_settings:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS delivery_platform_settings jsonb",
  shifts_enabled:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS shifts_enabled boolean NOT NULL DEFAULT false",
  pos_color_theme:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS pos_color_theme varchar(20) NOT NULL DEFAULT 'teal'",
  edition_id: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS edition_id uuid",
  reseller_id: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS reseller_id uuid",
  report_email_settings:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS report_email_settings jsonb",
  email_brevo_settings:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS email_brevo_settings jsonb",
  gift_card_settings:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS gift_card_settings jsonb",
  pos_checkout_settings:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS pos_checkout_settings jsonb",
  pos_print_settings:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS pos_print_settings jsonb",
  tax_included_in_price:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS tax_included_in_price boolean NOT NULL DEFAULT false",
  tax_takeaway_rate:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS tax_takeaway_rate numeric(5,2) DEFAULT 0",
  tax_dine_in_rate:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS tax_dine_in_rate numeric(5,2) DEFAULT 0",
  tax_delivery_rate:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS tax_delivery_rate numeric(5,2) DEFAULT 0",
  accepting_orders:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS accepting_orders boolean NOT NULL DEFAULT true",
  accepting_reservations:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS accepting_reservations boolean NOT NULL DEFAULT true",
  cms_homepage_enabled:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS cms_homepage_enabled boolean NOT NULL DEFAULT false",
  channel_select_mode:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS channel_select_mode varchar(20) NOT NULL DEFAULT 'checkout'",
  scheduled_orders_enabled:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS scheduled_orders_enabled boolean NOT NULL DEFAULT true",
  menu_show_product_images:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS menu_show_product_images boolean NOT NULL DEFAULT true",
  menu_show_category_banners:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS menu_show_category_banners boolean NOT NULL DEFAULT true",
  delivery_menu_markup:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS delivery_menu_markup numeric(10,2) DEFAULT 0",
  webpos_gift_card_enabled:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS webpos_gift_card_enabled boolean NOT NULL DEFAULT false",
  adyen_use_legacy_endpoint:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS adyen_use_legacy_endpoint boolean NOT NULL DEFAULT false",
  courses_enabled:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS courses_enabled boolean NOT NULL DEFAULT false",
};

let startupPatchPromise: Promise<void> | null = null;
let patchedColumns = new Set<string>();

async function runPatch(column: string): Promise<boolean> {
  const statement = MERCHANT_COLUMN_PATCHES[column];
  if (!statement || patchedColumns.has(column)) return false;
  const db = getDb();
  try {
    await db.execute(sql.raw(statement));
    patchedColumns.add(column);
    console.info(`[schema] patched merchants.${column}`);
    return true;
  } catch (err) {
    console.warn(`[schema] failed to patch merchants.${column}:`, err);
    return false;
  }
}

/** Apply all known optional merchant columns once at startup (non-blocking). */
export function ensureMerchantSchemaAtStartup(): void {
  if (startupPatchPromise) return;
  startupPatchPromise = (async () => {
    for (const column of Object.keys(MERCHANT_COLUMN_PATCHES)) {
      await runPatch(column);
    }
  })().catch((err) => {
    console.warn("[schema] merchant startup patch failed:", err);
  });
}

/**
 * On a missing-column error, apply the matching patch (if known) so the caller can retry.
 * Returns true when a patch was applied.
 */
export async function patchMerchantSchemaFromError(error: unknown): Promise<boolean> {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  if (!isMissingSchemaError(raw)) return false;
  const col = missingColumnFromError(raw);
  if (!col) return false;
  return runPatch(col);
}
