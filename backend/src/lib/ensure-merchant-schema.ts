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
  table_qr_settings:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS table_qr_settings jsonb",
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
  cart_layout:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS cart_layout varchar(20) NOT NULL DEFAULT 'hidden_slide'",
  delivery_menu_markup:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS delivery_menu_markup numeric(10,2) DEFAULT 0",
  webpos_gift_card_enabled:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS webpos_gift_card_enabled boolean NOT NULL DEFAULT false",
  adyen_use_legacy_endpoint:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS adyen_use_legacy_endpoint boolean NOT NULL DEFAULT false",
  courses_enabled:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS courses_enabled boolean NOT NULL DEFAULT false",
  max_pos_posts:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS max_pos_posts integer NOT NULL DEFAULT 0",
  max_waiter_posts:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS max_waiter_posts integer NOT NULL DEFAULT 0",
  webpos_invoice_enabled:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS webpos_invoice_enabled boolean NOT NULL DEFAULT true",
  bank_iban: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS bank_iban varchar(34)",
  bank_qr_iban: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS bank_qr_iban varchar(34)",
  bank_name: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS bank_name varchar(255)",
  bank_account_holder: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS bank_account_holder varchar(255)",
  invoice_sequence:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS invoice_sequence integer NOT NULL DEFAULT 0",
  inventory_addon_enabled:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS inventory_addon_enabled boolean NOT NULL DEFAULT false",
  inventory_waste_factor:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS inventory_waste_factor numeric(5,4) NOT NULL DEFAULT 0.20",
  inventory_auto_reorder_email_enabled:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS inventory_auto_reorder_email_enabled boolean NOT NULL DEFAULT false",
};

/** Idempotent CREATE TABLE for features added after initial deploy. */
const TABLE_PATCHES: string[] = [
  `CREATE TABLE IF NOT EXISTS vouchers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    code varchar(64) NOT NULL,
    name varchar(255),
    usage_type varchar(20) NOT NULL DEFAULT 'multi_use',
    max_redemptions integer NOT NULL DEFAULT 1,
    customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
    discount_type varchar(20) NOT NULL DEFAULT 'percent',
    discount_value numeric(10, 2) NOT NULL,
    min_order_amount numeric(10, 2) NOT NULL DEFAULT 0,
    valid_from timestamptz,
    valid_to timestamptz,
    is_active boolean NOT NULL DEFAULT true,
    redemption_count integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS vouchers_merchant_code_idx ON vouchers(merchant_id, code)`,
  `CREATE INDEX IF NOT EXISTS vouchers_merchant_id_idx ON vouchers(merchant_id)`,
  `CREATE INDEX IF NOT EXISTS vouchers_merchant_active_idx ON vouchers(merchant_id, is_active)`,
  `CREATE INDEX IF NOT EXISTS vouchers_customer_id_idx ON vouchers(customer_id)`,
  `CREATE TABLE IF NOT EXISTS voucher_redemptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    voucher_id uuid NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
    order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
    customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
    code varchar(64) NOT NULL,
    discount_amount numeric(10, 2) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS voucher_redemptions_merchant_id_idx ON voucher_redemptions(merchant_id)`,
  `CREATE INDEX IF NOT EXISTS voucher_redemptions_voucher_id_idx ON voucher_redemptions(voucher_id)`,
  `CREATE INDEX IF NOT EXISTS voucher_redemptions_order_id_idx ON voucher_redemptions(order_id)`,
  `CREATE INDEX IF NOT EXISTS voucher_redemptions_customer_id_idx ON voucher_redemptions(customer_id)`,
  `CREATE TABLE IF NOT EXISTS table_qr_codes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    table_id uuid NOT NULL REFERENCES dining_tables(id) ON DELETE CASCADE,
    code_type varchar(20) NOT NULL DEFAULT 'static',
    code varchar(512) NOT NULL,
    expires_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS table_qr_codes_merchant_id_idx ON table_qr_codes(merchant_id)`,
  `CREATE INDEX IF NOT EXISTS table_qr_codes_table_id_idx ON table_qr_codes(table_id)`,
  `CREATE TABLE IF NOT EXISTS gift_card_purchases (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    amount numeric(10, 2) NOT NULL,
    recipient_email varchar(255) NOT NULL,
    recipient_name varchar(255),
    sender_name varchar(255),
    sender_email varchar(255),
    message text,
    payment_method varchar(20) NOT NULL DEFAULT 'card',
    payment_status varchar(30) NOT NULL DEFAULT 'awaiting_payment',
    adyen_reference varchar(255),
    card_id uuid REFERENCES gift_cards(id) ON DELETE SET NULL,
    fulfilled_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS gift_card_purchases_merchant_id_idx ON gift_card_purchases(merchant_id)`,
  `CREATE INDEX IF NOT EXISTS gift_card_purchases_payment_status_idx ON gift_card_purchases(payment_status)`,
  `CREATE TABLE IF NOT EXISTS pos_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    session_kind varchar(20) NOT NULL DEFAULT 'main',
    platform varchar(30) NOT NULL,
    device_id varchar(128) NOT NULL,
    device_label varchar(255),
    staff_id uuid,
    staff_name varchar(255),
    last_heartbeat timestamptz NOT NULL DEFAULT now(),
    revoked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS pos_sessions_merchant_id_idx ON pos_sessions(merchant_id)`,
  `CREATE INDEX IF NOT EXISTS pos_sessions_merchant_device_idx ON pos_sessions(merchant_id, device_id, session_kind)`,
  `CREATE INDEX IF NOT EXISTS pos_sessions_active_idx ON pos_sessions(merchant_id, session_kind, last_heartbeat)`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_number varchar(50)`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_issued_at timestamptz`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_due_at timestamptz`,
  `CREATE UNIQUE INDEX IF NOT EXISTS orders_merchant_invoice_number_idx ON orders (merchant_id, invoice_number) WHERE invoice_number IS NOT NULL`,
  `UPDATE products SET barcode = NULL WHERE barcode IS NOT NULL AND btrim(barcode) = ''`,
  `UPDATE products p SET barcode = NULL
    WHERE p.barcode IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM products o
        WHERE o.merchant_id = p.merchant_id
          AND o.barcode = p.barcode
          AND o.id < p.id
      )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS products_merchant_barcode_uidx ON products (merchant_id, barcode) WHERE barcode IS NOT NULL`,
  `CREATE TABLE IF NOT EXISTS inventory_suppliers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    name varchar(255) NOT NULL,
    email varchar(255),
    phone varchar(40),
    address text,
    contact_person varchar(255),
    notes text,
    archived_at timestamptz,
    last_order_email_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS inventory_suppliers_merchant_idx ON inventory_suppliers(merchant_id)`,
  `CREATE INDEX IF NOT EXISTS inventory_suppliers_merchant_name_idx ON inventory_suppliers(merchant_id, name)`,
  `CREATE TABLE IF NOT EXISTS inventory_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    name varchar(255) NOT NULL,
    unit varchar(20) NOT NULL DEFAULT 'kg',
    cost numeric(12, 4) NOT NULL DEFAULT 0,
    on_hand numeric(14, 4) NOT NULL DEFAULT 0,
    min_stock numeric(14, 4) NOT NULL DEFAULT 0,
    reorder_qty numeric(14, 4) NOT NULL DEFAULT 0,
    supplier_id uuid REFERENCES inventory_suppliers(id) ON DELETE SET NULL,
    perishable boolean NOT NULL DEFAULT false,
    auto_reorder_enabled boolean NOT NULL DEFAULT false,
    last_auto_reorder_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS inventory_items_merchant_idx ON inventory_items(merchant_id)`,
  `CREATE INDEX IF NOT EXISTS inventory_items_supplier_idx ON inventory_items(supplier_id)`,
  `CREATE INDEX IF NOT EXISTS inventory_items_merchant_name_idx ON inventory_items(merchant_id, name)`,
  `CREATE TABLE IF NOT EXISTS inventory_movements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    type varchar(20) NOT NULL,
    qty numeric(14, 4) NOT NULL,
    unit_cost numeric(12, 4),
    note text,
    supplier_name varchar(255),
    order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS inventory_movements_merchant_idx ON inventory_movements(merchant_id)`,
  `CREATE INDEX IF NOT EXISTS inventory_movements_item_idx ON inventory_movements(item_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS inventory_movements_order_idx ON inventory_movements(order_id)`,
  `CREATE INDEX IF NOT EXISTS inventory_movements_type_idx ON inventory_movements(merchant_id, type)`,
  `CREATE TABLE IF NOT EXISTS product_recipes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    qty numeric(14, 4) NOT NULL,
    unit varchar(20) NOT NULL DEFAULT 'kg',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS product_recipes_merchant_idx ON product_recipes(merchant_id)`,
  `CREATE INDEX IF NOT EXISTS product_recipes_product_idx ON product_recipes(product_id)`,
  `CREATE INDEX IF NOT EXISTS product_recipes_item_idx ON product_recipes(item_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS product_recipes_product_item_uidx ON product_recipes(product_id, item_id)`,
];

let startupPatchPromise: Promise<void> | null = null;
let patchedColumns = new Set<string>();
let patchedTables = false;

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
    if (!patchedTables) {
      const db = getDb();
      for (const statement of TABLE_PATCHES) {
        try {
          await db.execute(sql.raw(statement));
        } catch (err) {
          console.warn("[schema] table patch failed:", err);
        }
      }
      patchedTables = true;
      console.info("[schema] voucher tables ensured");
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
