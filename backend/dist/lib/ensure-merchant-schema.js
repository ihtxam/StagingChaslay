"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureMerchantTables = ensureMerchantTables;
exports.ensureInventoryAddonColumn = ensureInventoryAddonColumn;
exports.ensureInventoryDemoColumns = ensureInventoryDemoColumns;
exports.ensureSignageAddonColumn = ensureSignageAddonColumn;
exports.ensureKdsAddonColumn = ensureKdsAddonColumn;
exports.ensureOdsAddonColumn = ensureOdsAddonColumn;
exports.ensureMerchantSchemaAtStartup = ensureMerchantSchemaAtStartup;
exports.withMerchantSchemaRetry = withMerchantSchemaRetry;
exports.patchMerchantSchemaFromError = patchMerchantSchemaFromError;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const db_schema_errors_1 = require("@/lib/db-schema-errors");
/**
 * Idempotent ALTER statements for merchant columns added after initial deploy.
 * Keeps GET /merchant/settings working when drizzle-kit push lags behind code.
 */
const MERCHANT_COLUMN_PATCHES = {
    vat_after_discount: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS vat_after_discount boolean NOT NULL DEFAULT true",
    delivery_platform_settings: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS delivery_platform_settings jsonb",
    shifts_enabled: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS shifts_enabled boolean NOT NULL DEFAULT false",
    pos_color_theme: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS pos_color_theme varchar(20) NOT NULL DEFAULT 'teal'",
    edition_id: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS edition_id uuid",
    business_category: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS business_category varchar(20)",
    plan_billing_paid: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS plan_billing_paid boolean NOT NULL DEFAULT true",
    reseller_id: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS reseller_id uuid",
    report_email_settings: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS report_email_settings jsonb",
    email_brevo_settings: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS email_brevo_settings jsonb",
    email_smtp_settings: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS email_smtp_settings jsonb",
    email_delivery_mode: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS email_delivery_mode varchar(20) NOT NULL DEFAULT 'platform'",
    gift_card_settings: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS gift_card_settings jsonb",
    pos_checkout_settings: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS pos_checkout_settings jsonb",
    pos_print_settings: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS pos_print_settings jsonb",
    table_qr_settings: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS table_qr_settings jsonb",
    tax_included_in_price: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS tax_included_in_price boolean NOT NULL DEFAULT false",
    tax_takeaway_rate: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS tax_takeaway_rate numeric(5,2) DEFAULT 0",
    tax_dine_in_rate: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS tax_dine_in_rate numeric(5,2) DEFAULT 0",
    tax_delivery_rate: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS tax_delivery_rate numeric(5,2) DEFAULT 0",
    accepting_orders: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS accepting_orders boolean NOT NULL DEFAULT true",
    accepting_reservations: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS accepting_reservations boolean NOT NULL DEFAULT true",
    cms_homepage_enabled: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS cms_homepage_enabled boolean NOT NULL DEFAULT false",
    channel_select_mode: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS channel_select_mode varchar(20) NOT NULL DEFAULT 'checkout'",
    scheduled_orders_enabled: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS scheduled_orders_enabled boolean NOT NULL DEFAULT true",
    menu_show_product_images: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS menu_show_product_images boolean NOT NULL DEFAULT true",
    menu_show_category_banners: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS menu_show_category_banners boolean NOT NULL DEFAULT true",
    cart_layout: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS cart_layout varchar(20) NOT NULL DEFAULT 'hidden_slide'",
    delivery_menu_markup: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS delivery_menu_markup numeric(10,2) DEFAULT 0",
    webpos_gift_card_enabled: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS webpos_gift_card_enabled boolean NOT NULL DEFAULT false",
    adyen_use_legacy_endpoint: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS adyen_use_legacy_endpoint boolean NOT NULL DEFAULT false",
    courses_enabled: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS courses_enabled boolean NOT NULL DEFAULT false",
    max_pos_posts: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS max_pos_posts integer NOT NULL DEFAULT 0",
    max_waiter_posts: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS max_waiter_posts integer NOT NULL DEFAULT 0",
    max_staff: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS max_staff integer NOT NULL DEFAULT 0",
    webpos_invoice_enabled: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS webpos_invoice_enabled boolean NOT NULL DEFAULT true",
    bank_iban: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS bank_iban varchar(34)",
    bank_qr_iban: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS bank_qr_iban varchar(34)",
    bank_name: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS bank_name varchar(255)",
    bank_account_holder: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS bank_account_holder varchar(255)",
    invoice_sequence: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS invoice_sequence integer NOT NULL DEFAULT 0",
    /** Paid addon flag — default false for every merchant; Superadmin/reseller toggle it. */
    inventory_addon_enabled: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS inventory_addon_enabled boolean NOT NULL DEFAULT false",
    inventory_waste_factor: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS inventory_waste_factor numeric(5,4) NOT NULL DEFAULT 0.20",
    inventory_auto_reorder_email_enabled: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS inventory_auto_reorder_email_enabled boolean NOT NULL DEFAULT false",
    inventory_expiry_alert_days: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS inventory_expiry_alert_days integer NOT NULL DEFAULT 30",
    signage_addon_enabled: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS signage_addon_enabled boolean NOT NULL DEFAULT false",
    signage_screen_limit: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS signage_screen_limit integer NOT NULL DEFAULT 2",
    kds_addon_enabled: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS kds_addon_enabled boolean NOT NULL DEFAULT false",
    ods_addon_enabled: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS ods_addon_enabled boolean NOT NULL DEFAULT false",
};
/** Non-merchant columns added with the inventory cookbook v1 follow-up. */
const EXTRA_COLUMN_PATCHES = {
    recipe_yield: "ALTER TABLE products ADD COLUMN IF NOT EXISTS recipe_yield numeric(12,4) NOT NULL DEFAULT 1",
    products_barcode: "ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode varchar(255)",
    inventory_item_id: "ALTER TABLE modifier_options ADD COLUMN IF NOT EXISTS inventory_item_id uuid",
    inventory_qty: "ALTER TABLE modifier_options ADD COLUMN IF NOT EXISTS inventory_qty numeric(14,4) NOT NULL DEFAULT 0",
    category_id: "ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS category_id uuid",
    inventory_items_barcode: "ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS barcode varchar(255)",
    inventory_items_is_demo: "ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false",
    inventory_categories_is_demo: "ALTER TABLE inventory_categories ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false",
    inventory_suppliers_is_demo: "ALTER TABLE inventory_suppliers ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false",
    inventory_units_is_demo: "ALTER TABLE inventory_units ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false",
    inventory_unit_ratios_is_demo: "ALTER TABLE inventory_unit_ratios ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false",
    product_recipes_is_demo: "ALTER TABLE product_recipes ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false",
    preferred_terminal_id: "ALTER TABLE merchant_staff ADD COLUMN IF NOT EXISTS preferred_terminal_id varchar(255)",
    assigned_delivery_staff_id: "ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_delivery_staff_id uuid REFERENCES merchant_staff(id) ON DELETE SET NULL",
    delivery_latitude: "ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_latitude numeric(10,7)",
    delivery_longitude: "ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_longitude numeric(10,7)",
    delivery_tracking_token: "ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_tracking_token varchar(64)",
    delivery_driver_pay_mode: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS delivery_driver_pay_mode varchar(20) NOT NULL DEFAULT 'both'",
    delivery_driver_hourly_rate: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS delivery_driver_hourly_rate numeric(10,2) DEFAULT 0",
    delivery_per_order_fee: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS delivery_per_order_fee numeric(10,2) DEFAULT 0",
    delivery_hourly_rate_override: "ALTER TABLE merchant_staff ADD COLUMN IF NOT EXISTS delivery_hourly_rate_override numeric(10,2)",
    delivery_per_order_fee_override: "ALTER TABLE merchant_staff ADD COLUMN IF NOT EXISTS delivery_per_order_fee_override numeric(10,2)",
};
/** Idempotent CREATE TABLE for features added after initial deploy. */
const TABLE_PATCHES = [
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
    `CREATE TABLE IF NOT EXISTS delivery_driver_locations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    staff_id uuid NOT NULL REFERENCES merchant_staff(id) ON DELETE CASCADE,
    latitude numeric(10,7) NOT NULL,
    longitude numeric(10,7) NOT NULL,
    accuracy_m numeric(10,2),
    heading numeric(6,2),
    speed_mps numeric(8,3),
    recorded_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS delivery_driver_locations_merchant_staff_uidx ON delivery_driver_locations (merchant_id, staff_id)`,
    `CREATE INDEX IF NOT EXISTS delivery_driver_locations_merchant_recorded_idx ON delivery_driver_locations (merchant_id, recorded_at DESC)`,
    `CREATE TABLE IF NOT EXISTS delivery_driver_shifts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    staff_id uuid NOT NULL REFERENCES merchant_staff(id) ON DELETE CASCADE,
    started_at timestamptz NOT NULL DEFAULT now(),
    ended_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
    `CREATE INDEX IF NOT EXISTS delivery_driver_shifts_merchant_staff_idx ON delivery_driver_shifts (merchant_id, staff_id, started_at DESC)`,
    `CREATE INDEX IF NOT EXISTS pos_sessions_merchant_id_idx ON pos_sessions(merchant_id)`,
    `CREATE INDEX IF NOT EXISTS pos_sessions_merchant_device_idx ON pos_sessions(merchant_id, device_id, session_kind)`,
    `CREATE INDEX IF NOT EXISTS pos_sessions_active_idx ON pos_sessions(merchant_id, session_kind, last_heartbeat)`,
    `CREATE TABLE IF NOT EXISTS kds_stations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    name varchar(255) NOT NULL,
    token varchar(128) NOT NULL,
    order_types jsonb NOT NULL DEFAULT '[]',
    category_ids jsonb NOT NULL DEFAULT '[]',
    product_ids jsonb NOT NULL DEFAULT '[]',
    is_active boolean NOT NULL DEFAULT true,
    theme varchar(32) NOT NULL DEFAULT 'dark',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
    `ALTER TABLE kds_stations ADD COLUMN IF NOT EXISTS theme varchar(32) NOT NULL DEFAULT 'dark'`,
    `ALTER TABLE kds_stations ADD COLUMN IF NOT EXISTS layout_mode varchar(16) NOT NULL DEFAULT 'grid'`,
    `ALTER TABLE kds_stations ADD COLUMN IF NOT EXISTS grid_columns integer NOT NULL DEFAULT 3`,
    `ALTER TABLE kds_stations ADD COLUMN IF NOT EXISTS overdue_minutes integer NOT NULL DEFAULT 20`,
    `ALTER TABLE kds_stations ADD COLUMN IF NOT EXISTS short_code varchar(8)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS kds_stations_short_code_uidx ON kds_stations(short_code) WHERE short_code IS NOT NULL`,
    `CREATE UNIQUE INDEX IF NOT EXISTS kds_stations_token_uidx ON kds_stations(token)`,
    `CREATE INDEX IF NOT EXISTS kds_stations_merchant_id_idx ON kds_stations(merchant_id)`,
    `CREATE TABLE IF NOT EXISTS kds_tickets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    ticket_key varchar(255) NOT NULL,
    order_number varchar(64),
    table_label varchar(120),
    tab_number varchar(64),
    channel varchar(50),
    status varchar(30) NOT NULL DEFAULT 'pending',
    completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
    `CREATE INDEX IF NOT EXISTS kds_tickets_merchant_id_idx ON kds_tickets(merchant_id)`,
    `CREATE INDEX IF NOT EXISTS kds_tickets_merchant_ticket_key_idx ON kds_tickets(merchant_id, ticket_key)`,
    `CREATE TABLE IF NOT EXISTS kds_ticket_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id uuid NOT NULL REFERENCES kds_tickets(id) ON DELETE CASCADE,
    line_id varchar(128) NOT NULL,
    product_id uuid,
    category_id uuid,
    name varchar(255) NOT NULL,
    quantity numeric(12,3) NOT NULL DEFAULT 1,
    line_note text,
    course_number integer,
    modifiers_json jsonb NOT NULL DEFAULT '{}',
    status varchar(30) NOT NULL DEFAULT 'pending',
    ready_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
    `CREATE INDEX IF NOT EXISTS kds_ticket_items_ticket_id_idx ON kds_ticket_items(ticket_id)`,
    `CREATE INDEX IF NOT EXISTS kds_ticket_items_line_id_idx ON kds_ticket_items(ticket_id, line_id)`,
    `CREATE TABLE IF NOT EXISTS ods_displays (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    name varchar(255) NOT NULL,
    token varchar(128) NOT NULL,
    theme varchar(32) NOT NULL DEFAULT 'light',
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS ods_displays_token_uidx ON ods_displays(token)`,
    `CREATE INDEX IF NOT EXISTS ods_displays_merchant_id_idx ON ods_displays(merchant_id)`,
    `ALTER TABLE ods_displays ADD COLUMN IF NOT EXISTS short_code varchar(8)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS ods_displays_short_code_uidx ON ods_displays(short_code) WHERE short_code IS NOT NULL`,
    `CREATE TABLE IF NOT EXISTS ods_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    order_number varchar(64) NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'preparing',
    ready_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
    `CREATE INDEX IF NOT EXISTS ods_orders_merchant_id_idx ON ods_orders(merchant_id)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS ods_orders_merchant_order_uidx ON ods_orders(merchant_id, order_number)`,
    `CREATE TABLE IF NOT EXISTS ods_dismissed_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    order_number varchar(64) NOT NULL,
    dismissed_at timestamptz NOT NULL DEFAULT now()
  )`,
    `CREATE INDEX IF NOT EXISTS ods_dismissed_merchant_id_idx ON ods_dismissed_orders(merchant_id)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS ods_dismissed_merchant_order_uidx ON ods_dismissed_orders(merchant_id, order_number)`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_number varchar(50)`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_issued_at timestamptz`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_due_at timestamptz`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS staff_id uuid`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS estimated_ready_at timestamptz`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS print_count integer DEFAULT 0`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS rounding_amount numeric(10,2) DEFAULT 0`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS points_earned integer DEFAULT 0`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS adyen_customer_receipt_json text`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS adyen_cashier_receipt_json text`,
    `ALTER TABLE order_items ADD COLUMN IF NOT EXISTS combo_selections jsonb DEFAULT '[]'::jsonb`,
    `ALTER TABLE order_items ADD COLUMN IF NOT EXISTS selected_extras jsonb DEFAULT '[]'::jsonb`,
    `ALTER TABLE order_items ADD COLUMN IF NOT EXISTS seat_number integer`,
    `ALTER TABLE order_items ADD COLUMN IF NOT EXISTS refunded_quantity numeric(12,3) DEFAULT 0`,
    `ALTER TABLE merchants ADD COLUMN IF NOT EXISTS min_pre_order_delay_minutes integer DEFAULT 30`,
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
    `CREATE TABLE IF NOT EXISTS inventory_stock_lots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    movement_id uuid REFERENCES inventory_movements(id) ON DELETE SET NULL,
    qty numeric(14, 4) NOT NULL,
    remaining_qty numeric(14, 4) NOT NULL,
    expiry_date timestamptz,
    note text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
    `CREATE INDEX IF NOT EXISTS inventory_stock_lots_merchant_idx ON inventory_stock_lots(merchant_id)`,
    `CREATE INDEX IF NOT EXISTS inventory_stock_lots_item_idx ON inventory_stock_lots(item_id, expiry_date)`,
    `CREATE INDEX IF NOT EXISTS inventory_stock_lots_expiry_idx ON inventory_stock_lots(merchant_id, expiry_date)`,
    `ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS barcode varchar(255)`,
    `CREATE INDEX IF NOT EXISTS inventory_items_merchant_barcode_idx ON inventory_items(merchant_id, barcode)`,
    `ALTER TABLE merchants ADD COLUMN IF NOT EXISTS inventory_expiry_alert_days integer NOT NULL DEFAULT 30`,
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
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS recipe_yield numeric(12,4) NOT NULL DEFAULT 1`,
    `ALTER TABLE modifier_options ADD COLUMN IF NOT EXISTS inventory_item_id uuid`,
    `ALTER TABLE modifier_options ADD COLUMN IF NOT EXISTS inventory_qty numeric(14,4) NOT NULL DEFAULT 0`,
    `CREATE INDEX IF NOT EXISTS modifier_options_inventory_item_idx ON modifier_options(inventory_item_id)`,
    `CREATE TABLE IF NOT EXISTS inventory_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    name varchar(100) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
    `CREATE INDEX IF NOT EXISTS inventory_categories_merchant_idx ON inventory_categories(merchant_id)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS inventory_categories_merchant_name_uidx ON inventory_categories(merchant_id, name)`,
    `ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS category_id uuid`,
    `CREATE INDEX IF NOT EXISTS inventory_items_category_idx ON inventory_items(category_id)`,
    `CREATE TABLE IF NOT EXISTS inventory_units (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    code varchar(20) NOT NULL,
    name varchar(80) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
    `CREATE INDEX IF NOT EXISTS inventory_units_merchant_idx ON inventory_units(merchant_id)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS inventory_units_merchant_code_uidx ON inventory_units(merchant_id, code)`,
    `CREATE TABLE IF NOT EXISTS inventory_unit_ratios (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    from_code varchar(20) NOT NULL,
    to_code varchar(20) NOT NULL,
    factor numeric(16, 6) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
    `CREATE INDEX IF NOT EXISTS inventory_unit_ratios_merchant_idx ON inventory_unit_ratios(merchant_id)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS inventory_unit_ratios_pair_uidx ON inventory_unit_ratios(merchant_id, from_code, to_code)`,
    `CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email varchar(255) NOT NULL,
    role varchar(20) NOT NULL,
    account_id uuid NOT NULL,
    token_hash varchar(64) NOT NULL,
    expires_at timestamptz NOT NULL,
    used_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS password_reset_tokens_token_hash_idx ON password_reset_tokens(token_hash)`,
    `CREATE INDEX IF NOT EXISTS password_reset_tokens_email_idx ON password_reset_tokens(email)`,
    `CREATE INDEX IF NOT EXISTS password_reset_tokens_expires_idx ON password_reset_tokens(expires_at)`,
    `CREATE TABLE IF NOT EXISTS signage_playlists (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    name varchar(255) NOT NULL,
    template varchar(40) NOT NULL DEFAULT 'dark_pizza',
    schedule jsonb NOT NULL DEFAULT '{"type":"always"}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
    `CREATE INDEX IF NOT EXISTS signage_playlists_merchant_id_idx ON signage_playlists(merchant_id)`,
    `CREATE TABLE IF NOT EXISTS signage_screens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    name varchar(255) NOT NULL,
    token varchar(128) NOT NULL,
    orientation varchar(20) NOT NULL DEFAULT 'landscape',
    template varchar(40) NOT NULL DEFAULT 'dark_pizza',
    playlist_id uuid REFERENCES signage_playlists(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS signage_screens_token_uidx ON signage_screens(token)`,
    `CREATE INDEX IF NOT EXISTS signage_screens_merchant_id_idx ON signage_screens(merchant_id)`,
    `CREATE TABLE IF NOT EXISTS signage_slides (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    playlist_id uuid NOT NULL REFERENCES signage_playlists(id) ON DELETE CASCADE,
    type varchar(30) NOT NULL DEFAULT 'menu',
    duration_sec integer NOT NULL DEFAULT 10,
    sort_order integer NOT NULL DEFAULT 0,
    category_ids jsonb NOT NULL DEFAULT '[]',
    headline varchar(255),
    body text,
    image_url varchar(500),
    show_prices boolean NOT NULL DEFAULT true,
    show_photos boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
    `CREATE INDEX IF NOT EXISTS signage_slides_playlist_id_idx ON signage_slides(playlist_id)`,
    `CREATE TABLE IF NOT EXISTS order_refunds (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    kind varchar(20) NOT NULL DEFAULT 'referenced',
    amount numeric(10, 2) NOT NULL,
    reason text,
    staff_id uuid,
    staff_name varchar(255),
    items_json jsonb,
    allocation_json jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
    `CREATE INDEX IF NOT EXISTS order_refunds_merchant_id_idx ON order_refunds(merchant_id)`,
    `CREATE INDEX IF NOT EXISTS order_refunds_order_id_idx ON order_refunds(order_id)`,
    `CREATE INDEX IF NOT EXISTS order_refunds_created_at_idx ON order_refunds(created_at)`,
    `CREATE TABLE IF NOT EXISTS platform_shop_products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(255) NOT NULL,
    description text,
    price numeric(10, 2) NOT NULL DEFAULT 0,
    discount_percent integer,
    image_url varchar(500),
    is_active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
    `CREATE INDEX IF NOT EXISTS platform_shop_products_active_idx ON platform_shop_products(is_active)`,
    `CREATE INDEX IF NOT EXISTS platform_shop_products_sort_idx ON platform_shop_products(sort_order)`,
    `CREATE TABLE IF NOT EXISTS platform_shop_vouchers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) NOT NULL UNIQUE,
    label varchar(255),
    discount_percent integer,
    discount_amount numeric(10, 2),
    is_active boolean NOT NULL DEFAULT true,
    max_uses integer,
    used_count integer NOT NULL DEFAULT 0,
    expires_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS platform_shop_vouchers_code_idx ON platform_shop_vouchers(code)`,
    `CREATE INDEX IF NOT EXISTS platform_shop_vouchers_active_idx ON platform_shop_vouchers(is_active)`,
    `CREATE TABLE IF NOT EXISTS platform_shop_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    status varchar(30) NOT NULL DEFAULT 'pending',
    payment_status varchar(30) NOT NULL DEFAULT 'pending',
    subtotal numeric(10, 2) NOT NULL DEFAULT 0,
    discount_amount numeric(10, 2) NOT NULL DEFAULT 0,
    total numeric(10, 2) NOT NULL DEFAULT 0,
    currency varchar(3) NOT NULL DEFAULT 'CHF',
    voucher_code varchar(50),
    items jsonb NOT NULL DEFAULT '[]',
    notes text,
    adyen_session_id varchar(255),
    adyen_psp_reference varchar(255),
    adyen_result_code varchar(50),
    paid_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
    `CREATE INDEX IF NOT EXISTS platform_shop_orders_merchant_idx ON platform_shop_orders(merchant_id)`,
    `CREATE INDEX IF NOT EXISTS platform_shop_orders_status_idx ON platform_shop_orders(status)`,
    `CREATE INDEX IF NOT EXISTS platform_shop_orders_created_idx ON platform_shop_orders(created_at)`,
    `CREATE TABLE IF NOT EXISTS platform_event_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    level varchar(10) NOT NULL DEFAULT 'info',
    category varchar(80) NOT NULL DEFAULT 'system',
    message text NOT NULL,
    metadata jsonb,
    actor_role varchar(20),
    actor_id uuid,
    merchant_id uuid,
    reseller_id uuid,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
    `CREATE INDEX IF NOT EXISTS platform_event_logs_level_idx ON platform_event_logs(level)`,
    `CREATE INDEX IF NOT EXISTS platform_event_logs_category_idx ON platform_event_logs(category)`,
    `CREATE INDEX IF NOT EXISTS platform_event_logs_created_idx ON platform_event_logs(created_at)`,
    `CREATE TABLE IF NOT EXISTS platform_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kind varchar(20) NOT NULL DEFAULT 'announcement',
    audience varchar(30) NOT NULL DEFAULT 'all_merchants',
    target_merchant_id uuid,
    target_reseller_id uuid,
    title varchar(255) NOT NULL,
    body text NOT NULL,
    severity varchar(20) NOT NULL DEFAULT 'info',
    external_url varchar(500),
    external_label varchar(120),
    show_on_login boolean NOT NULL DEFAULT true,
    show_in_banner boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    starts_at timestamptz,
    ends_at timestamptz,
    created_by_superadmin_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
    `CREATE INDEX IF NOT EXISTS platform_messages_kind_idx ON platform_messages(kind)`,
    `CREATE INDEX IF NOT EXISTS platform_messages_audience_idx ON platform_messages(audience)`,
    `CREATE INDEX IF NOT EXISTS platform_messages_active_idx ON platform_messages(is_active)`,
    `CREATE INDEX IF NOT EXISTS platform_messages_created_idx ON platform_messages(created_at)`,
    `CREATE TABLE IF NOT EXISTS platform_message_dismissals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id uuid NOT NULL REFERENCES platform_messages(id) ON DELETE CASCADE,
    viewer_role varchar(20) NOT NULL,
    viewer_id uuid NOT NULL,
    dismissed_at timestamptz NOT NULL DEFAULT now()
  )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS platform_message_dismissals_unique ON platform_message_dismissals(message_id, viewer_role, viewer_id)`,
    `CREATE INDEX IF NOT EXISTS platform_message_dismissals_viewer_idx ON platform_message_dismissals(viewer_role, viewer_id)`,
    `ALTER TABLE superadmins ADD COLUMN IF NOT EXISTS handles_support boolean NOT NULL DEFAULT false`,
    `CREATE TABLE IF NOT EXISTS support_tickets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number varchar(20) NOT NULL UNIQUE,
    merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    reseller_id uuid REFERENCES resellers(id) ON DELETE SET NULL,
    category varchar(30) NOT NULL DEFAULT 'technical',
    subcategory varchar(80),
    subject varchar(255) NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'open',
    assigned_to_superadmin_id uuid,
    last_message_at timestamptz NOT NULL DEFAULT now(),
    closed_at timestamptz,
    auto_close_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
    `CREATE INDEX IF NOT EXISTS support_tickets_merchant_idx ON support_tickets(merchant_id)`,
    `CREATE INDEX IF NOT EXISTS support_tickets_reseller_idx ON support_tickets(reseller_id)`,
    `CREATE INDEX IF NOT EXISTS support_tickets_status_idx ON support_tickets(status)`,
    `CREATE INDEX IF NOT EXISTS support_tickets_created_idx ON support_tickets(created_at)`,
    `CREATE TABLE IF NOT EXISTS support_ticket_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    author_role varchar(20) NOT NULL,
    author_id uuid,
    author_name varchar(255),
    body text NOT NULL,
    attachment_url varchar(500),
    attachment_name varchar(255),
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
    `CREATE INDEX IF NOT EXISTS support_ticket_messages_ticket_idx ON support_ticket_messages(ticket_id)`,
    `CREATE INDEX IF NOT EXISTS support_ticket_messages_created_idx ON support_ticket_messages(created_at)`,
    `ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS merchant_visible boolean NOT NULL DEFAULT true`,
    `CREATE TABLE IF NOT EXISTS email_send_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id uuid REFERENCES merchants(id) ON DELETE SET NULL,
    provider varchar(20) NOT NULL,
    source varchar(30) NOT NULL,
    email_type varchar(50) NOT NULL DEFAULT 'general',
    recipient varchar(255) NOT NULL,
    subject varchar(500),
    status varchar(20) NOT NULL DEFAULT 'sent',
    error text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
    `CREATE INDEX IF NOT EXISTS email_send_log_merchant_idx ON email_send_log(merchant_id)`,
    `CREATE INDEX IF NOT EXISTS email_send_log_type_idx ON email_send_log(email_type)`,
    `CREATE INDEX IF NOT EXISTS email_send_log_created_idx ON email_send_log(created_at)`,
    `CREATE INDEX IF NOT EXISTS email_send_log_merchant_created_idx ON email_send_log(merchant_id, created_at)`,
    `ALTER TABLE signage_screens ADD COLUMN IF NOT EXISTS short_code varchar(8)`,
    `ALTER TABLE signage_screens ADD COLUMN IF NOT EXISTS screen_size_in integer NOT NULL DEFAULT 32`,
    `CREATE UNIQUE INDEX IF NOT EXISTS signage_screens_short_code_uidx ON signage_screens(short_code) WHERE short_code IS NOT NULL`,
];
let startupPatchPromise = null;
let patchedColumns = new Set();
let patchedTables = false;
async function runPatch(column) {
    const statement = MERCHANT_COLUMN_PATCHES[column] || EXTRA_COLUMN_PATCHES[column];
    if (!statement || patchedColumns.has(column))
        return false;
    const db = (0, db_1.getDb)();
    try {
        await db.execute(drizzle_orm_1.sql.raw(statement));
        patchedColumns.add(column);
        console.info(`[schema] patched column ${column}`);
        return true;
    }
    catch (err) {
        console.warn(`[schema] failed to patch column ${column}:`, err);
        return false;
    }
}
async function ensureMerchantTables() {
    if (patchedTables)
        return false;
    const db = (0, db_1.getDb)();
    let applied = false;
    for (const statement of TABLE_PATCHES) {
        try {
            await db.execute(drizzle_orm_1.sql.raw(statement));
            applied = true;
        }
        catch (err) {
            console.warn("[schema] table patch failed:", err);
        }
    }
    patchedTables = true;
    if (applied)
        console.info("[schema] voucher/inventory tables ensured");
    try {
        await db.execute(drizzle_orm_1.sql.raw(`
      UPDATE merchants SET email_delivery_mode = 'own'
      WHERE email_delivery_mode = 'platform'
      AND (
        COALESCE((email_smtp_settings->>'enabled')::boolean, false) = true
        OR COALESCE((email_brevo_settings->>'enabled')::boolean, false) = true
      )
    `));
    }
    catch {
        /* column may not exist yet */
    }
    return applied;
}
async function ensureInventoryAddonColumn() {
    await runPatch("inventory_addon_enabled");
    await runPatch("inventory_waste_factor");
    await runPatch("inventory_auto_reorder_email_enabled");
    await ensureMerchantTables();
    await runPatch("recipe_yield");
    await runPatch("inventory_item_id");
    await runPatch("inventory_qty");
    await runPatch("category_id");
    await runPatch("inventory_suppliers_is_demo");
    await runPatch("inventory_items_is_demo");
    await runPatch("inventory_categories_is_demo");
    await runPatch("inventory_units_is_demo");
    await runPatch("inventory_unit_ratios_is_demo");
    await runPatch("product_recipes_is_demo");
}
/** Ensure is_demo columns exist on inventory tables (demo import/delete). */
async function ensureInventoryDemoColumns() {
    await ensureInventoryAddonColumn();
}
async function ensureSignageAddonColumn() {
    await runPatch("signage_addon_enabled");
    await runPatch("signage_screen_limit");
    await ensureMerchantTables();
}
async function ensureKdsAddonColumn() {
    await runPatch("kds_addon_enabled");
    await ensureMerchantTables();
}
async function ensureOdsAddonColumn() {
    await runPatch("ods_addon_enabled");
    await ensureMerchantTables();
}
/** Apply all known optional merchant columns once at startup (non-blocking). */
function ensureMerchantSchemaAtStartup() {
    if (startupPatchPromise)
        return;
    startupPatchPromise = (async () => {
        for (const column of [
            ...Object.keys(MERCHANT_COLUMN_PATCHES),
            ...Object.keys(EXTRA_COLUMN_PATCHES),
        ]) {
            await runPatch(column);
        }
        await ensureMerchantTables();
    })().catch((err) => {
        console.warn("[schema] merchant startup patch failed:", err);
    });
}
/** Retry a merchants query after applying missing-column/table patches. */
async function withMerchantSchemaRetry(fn) {
    try {
        return await fn();
    }
    catch (error) {
        const raw = error instanceof Error ? error.message : String(error ?? "");
        const patched = await patchMerchantSchemaFromError(error);
        const inventoryTableMissing = /relation ["']?(inventory_|product_recipes|signage_)/i.test(raw);
        if (inventoryTableMissing) {
            patchedTables = false;
            await ensureMerchantTables();
        }
        if (!patched && !inventoryTableMissing)
            throw error;
        return fn();
    }
}
/**
 * On a missing-column error, apply the matching patch (if known) so the caller can retry.
 * Returns true when a patch was applied.
 */
async function patchMerchantSchemaFromError(error) {
    const raw = error instanceof Error ? error.message : String(error ?? "");
    if (!(0, db_schema_errors_1.isMissingSchemaError)(raw))
        return false;
    const col = (0, db_schema_errors_1.missingColumnFromError)(raw);
    if (!col)
        return false;
    return runPatch(col);
}
//# sourceMappingURL=ensure-merchant-schema.js.map