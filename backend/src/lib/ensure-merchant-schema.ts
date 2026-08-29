import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  dbErrorChain,
  isLocationsSchemaError,
  isMissingSchemaError,
  missingColumnFromDbError,
  missingTableColumnFromDbError,
} from "@/lib/db-schema-errors";

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
  business_category: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS business_category varchar(20)",
  plan_billing_paid:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS plan_billing_paid boolean NOT NULL DEFAULT true",
  reseller_id: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS reseller_id uuid",
  report_email_settings:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS report_email_settings jsonb",
  email_brevo_settings:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS email_brevo_settings jsonb",
  email_smtp_settings:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS email_smtp_settings jsonb",
  email_delivery_mode:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS email_delivery_mode varchar(20) NOT NULL DEFAULT 'platform'",
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
  min_pre_order_delay_minutes:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS min_pre_order_delay_minutes integer DEFAULT 30",
  category_pricing_enabled:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS category_pricing_enabled boolean NOT NULL DEFAULT false",
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
  max_staff:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS max_staff integer NOT NULL DEFAULT 0",
  max_locations:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS max_locations integer NOT NULL DEFAULT 1",
  webpos_invoice_enabled:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS webpos_invoice_enabled boolean NOT NULL DEFAULT true",
  bank_iban: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS bank_iban varchar(34)",
  bank_qr_iban: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS bank_qr_iban varchar(34)",
  bank_name: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS bank_name varchar(255)",
  bank_account_holder: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS bank_account_holder varchar(255)",
  invoice_sequence:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS invoice_sequence integer NOT NULL DEFAULT 0",
  /** Paid addon flag — default false for every merchant; Superadmin/reseller toggle it. */
  inventory_addon_enabled:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS inventory_addon_enabled boolean NOT NULL DEFAULT false",
  inventory_waste_factor:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS inventory_waste_factor numeric(5,4) NOT NULL DEFAULT 0.20",
  inventory_auto_reorder_email_enabled:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS inventory_auto_reorder_email_enabled boolean NOT NULL DEFAULT false",
  inventory_expiry_alert_days:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS inventory_expiry_alert_days integer NOT NULL DEFAULT 30",
  signage_addon_enabled:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS signage_addon_enabled boolean NOT NULL DEFAULT false",
  signage_screen_limit:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS signage_screen_limit integer NOT NULL DEFAULT 2",
  kds_addon_enabled:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS kds_addon_enabled boolean NOT NULL DEFAULT false",
  ods_addon_enabled:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS ods_addon_enabled boolean NOT NULL DEFAULT false",
  just_eat_addon_enabled:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS just_eat_addon_enabled boolean NOT NULL DEFAULT false",
  uber_eats_addon_enabled:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS uber_eats_addon_enabled boolean NOT NULL DEFAULT false",
  storekeeper_addon_enabled:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS storekeeper_addon_enabled boolean NOT NULL DEFAULT false",
  loyalty_enabled:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS loyalty_enabled boolean NOT NULL DEFAULT false",
  loyalty_earn_points_per_chf:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS loyalty_earn_points_per_chf numeric(8,3) DEFAULT 1",
  loyalty_redeem_points_per_chf:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS loyalty_redeem_points_per_chf integer DEFAULT 100",
  loyalty_points_expiry_days:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS loyalty_points_expiry_days integer DEFAULT 30",
  reservation_settings:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS reservation_settings jsonb",
  vacation_settings: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS vacation_settings jsonb",
  marketing_settings: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS marketing_settings jsonb",
};

/** Non-merchant columns added with the inventory cookbook v1 follow-up. */
const EXTRA_COLUMN_PATCHES: Record<string, string> = {
  recipe_yield: "ALTER TABLE products ADD COLUMN IF NOT EXISTS recipe_yield numeric(12,4) NOT NULL DEFAULT 1",
  products_barcode: "ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode varchar(255)",
  inventory_item_id: "ALTER TABLE modifier_options ADD COLUMN IF NOT EXISTS inventory_item_id uuid",
  inventory_qty: "ALTER TABLE modifier_options ADD COLUMN IF NOT EXISTS inventory_qty numeric(14,4) NOT NULL DEFAULT 0",
  category_id: "ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS category_id uuid",
  inventory_items_barcode: "ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS barcode varchar(255)",
  inventory_items_is_demo:
    "ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false",
  inventory_items_do_not_reorder:
    "ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS do_not_reorder boolean NOT NULL DEFAULT false",
  inventory_categories_is_demo:
    "ALTER TABLE inventory_categories ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false",
  inventory_suppliers_is_demo:
    "ALTER TABLE inventory_suppliers ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false",
  inventory_units_is_demo:
    "ALTER TABLE inventory_units ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false",
  inventory_unit_ratios_is_demo:
    "ALTER TABLE inventory_unit_ratios ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false",
  product_recipes_is_demo:
    "ALTER TABLE product_recipes ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false",
  preferred_terminal_id:
    "ALTER TABLE merchant_staff ADD COLUMN IF NOT EXISTS preferred_terminal_id varchar(255)",
  assigned_delivery_staff_id:
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_delivery_staff_id uuid REFERENCES merchant_staff(id) ON DELETE SET NULL",
  delivery_latitude: "ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_latitude numeric(10,7)",
  delivery_longitude: "ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_longitude numeric(10,7)",
  delivery_tracking_token:
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_tracking_token varchar(64)",
  delivery_driver_pay_mode:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS delivery_driver_pay_mode varchar(20) NOT NULL DEFAULT 'both'",
  delivery_driver_hourly_rate:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS delivery_driver_hourly_rate numeric(10,2) DEFAULT 0",
  delivery_per_order_fee:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS delivery_per_order_fee numeric(10,2) DEFAULT 0",
  delivery_hourly_rate_override:
    "ALTER TABLE merchant_staff ADD COLUMN IF NOT EXISTS delivery_hourly_rate_override numeric(10,2)",
  delivery_per_order_fee_override:
    "ALTER TABLE merchant_staff ADD COLUMN IF NOT EXISTS delivery_per_order_fee_override numeric(10,2)",
  login_home:
    "ALTER TABLE merchant_staff ADD COLUMN IF NOT EXISTS login_home varchar(20) NOT NULL DEFAULT 'auto'",
  merchant_staff_pin_display:
    "ALTER TABLE merchant_staff ADD COLUMN IF NOT EXISTS pin_display varchar(8)",
  products_visibility:
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS visibility jsonb NOT NULL DEFAULT '{\"channels\":[\"pos\",\"shop\",\"qr_table\",\"delivery\"]}'::jsonb",
  categories_visibility:
    "ALTER TABLE categories ADD COLUMN IF NOT EXISTS visibility jsonb NOT NULL DEFAULT '{\"channels\":[\"pos\",\"shop\",\"qr_table\",\"delivery\"]}'::jsonb",
  categories_delivery_pricing_enabled:
    "ALTER TABLE categories ADD COLUMN IF NOT EXISTS delivery_pricing_enabled boolean NOT NULL DEFAULT false",
  categories_extra_delivery_price:
    "ALTER TABLE categories ADD COLUMN IF NOT EXISTS extra_delivery_price numeric(10,2) DEFAULT 0",
  orders_table_session_id: "ALTER TABLE orders ADD COLUMN IF NOT EXISTS table_session_id uuid",
  orders_location_id: "ALTER TABLE orders ADD COLUMN IF NOT EXISTS location_id uuid",
  pos_sessions_location_id: "ALTER TABLE pos_sessions ADD COLUMN IF NOT EXISTS location_id uuid",
  orders_order_source: "ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_source varchar(50)",
  orders_fulfillment_channel:
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_channel varchar(50) DEFAULT 'takeaway'",
  orders_external_order_id: "ALTER TABLE orders ADD COLUMN IF NOT EXISTS external_order_id varchar(255)",
  orders_customer_name: "ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name varchar(255)",
  orders_customer_phone: "ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone varchar(40)",
  orders_customer_email: "ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email varchar(255)",
  orders_table_id: "ALTER TABLE orders ADD COLUMN IF NOT EXISTS table_id uuid",
  orders_table_label: "ALTER TABLE orders ADD COLUMN IF NOT EXISTS table_label varchar(50)",
  orders_scheduled_for: "ALTER TABLE orders ADD COLUMN IF NOT EXISTS scheduled_for timestamptz",
  orders_estimated_ready_at: "ALTER TABLE orders ADD COLUMN IF NOT EXISTS estimated_ready_at timestamptz",
  orders_print_count: "ALTER TABLE orders ADD COLUMN IF NOT EXISTS print_count integer DEFAULT 0",
  orders_payment_breakdown: "ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_breakdown jsonb",
  orders_staff_id: "ALTER TABLE orders ADD COLUMN IF NOT EXISTS staff_id uuid",
  orders_staff_name: "ALTER TABLE orders ADD COLUMN IF NOT EXISTS staff_name varchar(255)",
  orders_rounding_amount:
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS rounding_amount numeric(10,2) DEFAULT 0",
  orders_points_discount:
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS points_discount numeric(10,2) DEFAULT 0",
  orders_points_earned: "ALTER TABLE orders ADD COLUMN IF NOT EXISTS points_earned integer DEFAULT 0",
  orders_points_redeemed: "ALTER TABLE orders ADD COLUMN IF NOT EXISTS points_redeemed integer DEFAULT 0",
  orders_card_fee: "ALTER TABLE orders ADD COLUMN IF NOT EXISTS card_fee numeric(10,2) DEFAULT 0",
  orders_amount_tendered: "ALTER TABLE orders ADD COLUMN IF NOT EXISTS amount_tendered numeric(10,2)",
  orders_change_due: "ALTER TABLE orders ADD COLUMN IF NOT EXISTS change_due numeric(10,2)",
  orders_invoice_number: "ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_number varchar(50)",
  orders_invoice_issued_at: "ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_issued_at timestamptz",
  orders_invoice_due_at: "ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_due_at timestamptz",
  orders_master_order_id: "ALTER TABLE orders ADD COLUMN IF NOT EXISTS master_order_id varchar(64)",
  orders_split_check_number: "ALTER TABLE orders ADD COLUMN IF NOT EXISTS split_check_number integer",
  orders_guest_count: "ALTER TABLE orders ADD COLUMN IF NOT EXISTS guest_count integer",
  orders_bill_splits: "ALTER TABLE orders ADD COLUMN IF NOT EXISTS bill_splits jsonb DEFAULT '[]'::jsonb",
  orders_refund_amount: "ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_amount numeric(10,2) DEFAULT 0",
  orders_refunded_at: "ALTER TABLE orders ADD COLUMN IF NOT EXISTS refunded_at timestamptz",
  orders_refund_reason: "ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_reason text",
  orders_goodwill_amount: "ALTER TABLE orders ADD COLUMN IF NOT EXISTS goodwill_amount numeric(10,2) DEFAULT 0",
  orders_cancel_reason: "ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancel_reason text",
  orders_cancelled_at: "ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_at timestamptz",
  merchants_loyalty_enabled:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS loyalty_enabled boolean NOT NULL DEFAULT false",
  merchants_loyalty_earn_points_per_chf:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS loyalty_earn_points_per_chf numeric(8,3) DEFAULT 1",
  merchants_loyalty_redeem_points_per_chf:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS loyalty_redeem_points_per_chf integer DEFAULT 100",
  merchants_loyalty_points_expiry_days:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS loyalty_points_expiry_days integer DEFAULT 30",
  merchants_reservation_settings:
    "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS reservation_settings jsonb",
  merchants_vacation_settings: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS vacation_settings jsonb",
  merchants_marketing_settings: "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS marketing_settings jsonb",
  subscription_plans_max_locations:
    "ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_locations integer NOT NULL DEFAULT 1",
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
  `CREATE TABLE IF NOT EXISTS table_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    table_id uuid NOT NULL REFERENCES dining_tables(id) ON DELETE CASCADE,
    session_token varchar(64) NOT NULL,
    status varchar(30) NOT NULL DEFAULT 'open',
    guest_count integer,
    opened_at timestamptz NOT NULL DEFAULT now(),
    closed_at timestamptz
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS table_sessions_token_uidx ON table_sessions(session_token)`,
  `CREATE INDEX IF NOT EXISTS table_sessions_merchant_id_idx ON table_sessions(merchant_id)`,
  `CREATE INDEX IF NOT EXISTS table_sessions_table_id_idx ON table_sessions(table_id)`,
  `CREATE INDEX IF NOT EXISTS table_sessions_merchant_table_status_idx ON table_sessions(merchant_id, table_id, status)`,
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
  `CREATE TABLE IF NOT EXISTS chaslay_homepage_builders (
    id serial PRIMARY KEY,
    merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    name varchar(255) NOT NULL DEFAULT 'Untitled',
    editor_state text,
    is_active boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
  )`,
  `CREATE INDEX IF NOT EXISTS chaslay_homepage_builders_merchant_idx ON chaslay_homepage_builders(merchant_id)`,
  `CREATE INDEX IF NOT EXISTS chaslay_homepage_builders_active_idx ON chaslay_homepage_builders(merchant_id, is_active)`,
  `CREATE TABLE IF NOT EXISTS chaslay_homepage_builder_pages (
    id serial PRIMARY KEY,
    homepage_builder_id integer NOT NULL REFERENCES chaslay_homepage_builders(id) ON DELETE CASCADE,
    merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    title varchar(255) NOT NULL DEFAULT 'Home',
    slug varchar(255) NOT NULL DEFAULT 'home',
    editor_state text,
    is_homepage boolean NOT NULL DEFAULT false,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS chaslay_homepage_builder_pages_slug_uq ON chaslay_homepage_builder_pages(homepage_builder_id, slug)`,
  `CREATE INDEX IF NOT EXISTS chaslay_homepage_builder_pages_sort_idx ON chaslay_homepage_builder_pages(homepage_builder_id, sort_order)`,
  `CREATE TABLE IF NOT EXISTS locations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    name varchar(255) NOT NULL,
    slug varchar(100) NOT NULL,
    business_category varchar(20) NOT NULL DEFAULT 'restaurant',
    address text,
    city varchar(100),
    country varchar(100),
    timezone varchar(64) NOT NULL DEFAULT 'Europe/Zurich',
    is_default boolean NOT NULL DEFAULT false,
    status varchar(20) NOT NULL DEFAULT 'active',
    settings jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS locations_merchant_slug_idx ON locations(merchant_id, slug)`,
  `CREATE INDEX IF NOT EXISTS locations_merchant_id_idx ON locations(merchant_id)`,
  `CREATE INDEX IF NOT EXISTS locations_merchant_default_idx ON locations(merchant_id, is_default)`,
  `CREATE TABLE IF NOT EXISTS merchant_staff_locations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    staff_id uuid NOT NULL REFERENCES merchant_staff(id) ON DELETE CASCADE,
    location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS merchant_staff_locations_staff_location_idx ON merchant_staff_locations(staff_id, location_id)`,
  `CREATE INDEX IF NOT EXISTS merchant_staff_locations_merchant_staff_idx ON merchant_staff_locations(merchant_id, staff_id)`,
  `CREATE TABLE IF NOT EXISTS hq_catalog_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    version integer NOT NULL DEFAULT 1,
    name varchar(255) NOT NULL DEFAULT 'HQ Menu',
    payload_json jsonb NOT NULL DEFAULT '{}',
    created_by_staff_id uuid REFERENCES merchant_staff(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS hq_catalog_versions_merchant_idx ON hq_catalog_versions(merchant_id, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS location_catalog_links (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    hq_product_id uuid NOT NULL,
    local_product_id uuid REFERENCES products(id) ON DELETE SET NULL,
    sync_status varchar(30) NOT NULL DEFAULT 'synced',
    overrides_json jsonb NOT NULL DEFAULT '{}',
    from_hq_version_id uuid REFERENCES hq_catalog_versions(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS location_catalog_links_loc_hq_product_idx ON location_catalog_links(location_id, hq_product_id)`,
  `CREATE INDEX IF NOT EXISTS location_catalog_links_merchant_location_idx ON location_catalog_links(merchant_id, location_id)`,
  `CREATE TABLE IF NOT EXISTS location_product_overrides (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    price_override numeric(10,2),
    visibility jsonb,
    is_available boolean,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS location_product_overrides_loc_product_idx ON location_product_overrides(location_id, product_id)`,
  `CREATE TABLE IF NOT EXISTS pricing_bulk_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    location_ids jsonb NOT NULL DEFAULT '[]',
    category_ids jsonb NOT NULL DEFAULT '[]',
    product_ids jsonb NOT NULL DEFAULT '[]',
    operation varchar(20) NOT NULL,
    value_type varchar(20) NOT NULL,
    value numeric(12,4) NOT NULL,
    round_to numeric(6,4),
    affected_count integer NOT NULL DEFAULT 0,
    created_by_staff_id uuid REFERENCES merchant_staff(id) ON DELETE SET NULL,
    created_by_name varchar(255),
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS pricing_bulk_jobs_merchant_idx ON pricing_bulk_jobs(merchant_id, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS hq_menus (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    name varchar(120) NOT NULL,
    channels jsonb NOT NULL DEFAULT '["pos","shop","qr_table"]',
    days_of_week jsonb NOT NULL DEFAULT '[0,1,2,3,4,5,6]',
    time_start varchar(5) NOT NULL DEFAULT '00:00',
    time_end varchar(5) NOT NULL DEFAULT '23:59',
    location_ids jsonb NOT NULL DEFAULT '[]',
    hq_version_id uuid REFERENCES hq_catalog_versions(id) ON DELETE SET NULL,
    product_ids jsonb NOT NULL DEFAULT '[]',
    is_active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS hq_menus_merchant_idx ON hq_menus(merchant_id, sort_order)`,
  `CREATE TABLE IF NOT EXISTS inventory_location_stock (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    on_hand numeric(14,4) NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS inventory_location_stock_loc_item_idx ON inventory_location_stock(location_id, item_id)`,
  `CREATE INDEX IF NOT EXISTS inventory_location_stock_merchant_idx ON inventory_location_stock(merchant_id)`,
  `CREATE TABLE IF NOT EXISTS inventory_transfers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    from_location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    to_location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    qty numeric(14,4) NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'pending',
    note text,
    created_by_staff_id uuid REFERENCES merchant_staff(id) ON DELETE SET NULL,
    created_by_name varchar(255),
    created_at timestamptz NOT NULL DEFAULT now(),
    confirmed_at timestamptz
  )`,
  `CREATE INDEX IF NOT EXISTS inventory_transfers_merchant_idx ON inventory_transfers(merchant_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS inventory_transfers_status_idx ON inventory_transfers(merchant_id, status)`,
  `ALTER TABLE signage_screens ADD COLUMN IF NOT EXISTS short_code varchar(8)`,
  `ALTER TABLE signage_screens ADD COLUMN IF NOT EXISTS screen_size_in integer NOT NULL DEFAULT 32`,
  `CREATE UNIQUE INDEX IF NOT EXISTS signage_screens_short_code_uidx ON signage_screens(short_code) WHERE short_code IS NOT NULL`,
];

/** Subset of TABLE_PATCHES for multi-location feature (idempotent CREATE IF NOT EXISTS). */
const LOCATIONS_SCHEMA_PATTERN =
  /\blocations\b|merchant_staff_locations|hq_catalog_versions|location_catalog_links|location_product_overrides|pricing_bulk_jobs|hq_menus|inventory_location_stock|inventory_transfers/;

let startupPatchPromise: Promise<void> | null = null;
let patchedColumns = new Set<string>();
let patchedTables = false;

function resolvePatchStatement(column: string, table?: string | null): string | undefined {
  const direct = MERCHANT_COLUMN_PATCHES[column] || EXTRA_COLUMN_PATCHES[column];
  if (direct) return direct;
  if (table) {
    const scoped = EXTRA_COLUMN_PATCHES[`${table}_${column}`];
    if (scoped) return scoped;
  }
  const all = { ...MERCHANT_COLUMN_PATCHES, ...EXTRA_COLUMN_PATCHES };
  for (const sql of Object.values(all)) {
    if (sql.includes(`ADD COLUMN IF NOT EXISTS ${column} `)) return sql;
  }
  return undefined;
}

async function runPatch(column: string, table?: string | null): Promise<boolean> {
  const cacheKey = table ? `${table}.${column}` : column;
  if (patchedColumns.has(cacheKey)) return false;
  const statement = resolvePatchStatement(column, table);
  if (!statement) return false;
  const db = getDb();
  try {
    await db.execute(sql.raw(statement));
    patchedColumns.add(cacheKey);
    console.info(`[schema] patched column ${cacheKey}`);
    return true;
  } catch (err) {
    console.warn(`[schema] failed to patch column ${column}:`, err);
    return false;
  }
}

export async function ensureMerchantTables(): Promise<boolean> {
  if (patchedTables) return false;
  const db = getDb();
  let applied = false;
  for (const statement of TABLE_PATCHES) {
    try {
      await db.execute(sql.raw(statement));
      applied = true;
    } catch (err) {
      console.warn("[schema] table patch failed:", err);
    }
  }
  patchedTables = true;
  if (applied) console.info("[schema] voucher/inventory tables ensured");
  try {
    await db.execute(sql.raw(`
      UPDATE merchants SET email_delivery_mode = 'own'
      WHERE email_delivery_mode = 'platform'
      AND (
        COALESCE((email_smtp_settings->>'enabled')::boolean, false) = true
        OR COALESCE((email_brevo_settings->>'enabled')::boolean, false) = true
      )
    `));
  } catch {
    /* column may not exist yet */
  }
  return applied;
}

export async function ensureInventoryAddonColumn(): Promise<void> {
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
  await runPatch("inventory_items_do_not_reorder");
  await runPatch("inventory_categories_is_demo");
  await runPatch("inventory_units_is_demo");
  await runPatch("inventory_unit_ratios_is_demo");
  await runPatch("product_recipes_is_demo");
}

/** Ensure is_demo columns exist on inventory tables (demo import/delete). */
export async function ensureInventoryDemoColumns(): Promise<void> {
  await ensureInventoryAddonColumn();
}

export async function ensureSignageAddonColumn(): Promise<void> {
  await runPatch("signage_addon_enabled");
  await runPatch("signage_screen_limit");
  await ensureMerchantTables();
}

export async function ensureKdsAddonColumn(): Promise<void> {
  await runPatch("kds_addon_enabled");
  await ensureMerchantTables();
}

export async function ensureOdsAddonColumn(): Promise<void> {
  await runPatch("ods_addon_enabled");
  await ensureMerchantTables();
}

export async function ensureJustEatAddonColumn(): Promise<void> {
  await runPatch("just_eat_addon_enabled");
  await ensureMerchantTables();
}

export async function ensureUberEatsAddonColumn(): Promise<void> {
  await runPatch("uber_eats_addon_enabled");
  await ensureMerchantTables();
}

export async function ensureStorekeeperAddonColumn(): Promise<void> {
  await runPatch("storekeeper_addon_enabled");
  await ensureMerchantTables();
}

/** Ensure optional merchants columns exist (multi-location, addons, tax, etc.). */
export async function ensureMerchantColumnsSchema(): Promise<void> {
  for (const column of Object.keys(MERCHANT_COLUMN_PATCHES)) {
    await runPatch(column, "merchants");
  }
  await runPatch("delivery_driver_pay_mode", "merchants");
  await runPatch("delivery_driver_hourly_rate", "merchants");
  await runPatch("delivery_per_order_fee", "merchants");
}

/** Ensure optional orders columns exist (online shop, QR table, multi-location). */
export async function ensureOrdersColumnsSchema(): Promise<void> {
  for (const column of Object.keys(EXTRA_COLUMN_PATCHES)) {
    if (!column.startsWith("orders_")) continue;
    const col = column.slice("orders_".length);
    await runPatch(col, "orders");
  }
  await runPatch("location_id", "orders");
  await runPatch("table_session_id", "orders");
  await runPatch("order_source", "orders");
  await runPatch("fulfillment_channel", "orders");
}

/** Ensure multi-location tables/columns exist and backfill default location per merchant. */
export async function ensureLocationsSchema(): Promise<void> {
  const db = getDb();
  for (const statement of TABLE_PATCHES) {
    if (!LOCATIONS_SCHEMA_PATTERN.test(statement)) continue;
    try {
      await db.execute(sql.raw(statement));
    } catch (err) {
      console.warn("[schema] locations schema patch failed:", err);
    }
  }
  await runPatch("orders_location_id");
  await runPatch("pos_sessions_location_id");
  await runPatch("max_locations");
  await runPatch("subscription_plans_max_locations");
  await backfillDefaultLocations();
}

/** Create one default location per merchant and backfill orders/POS sessions. */
export async function backfillDefaultLocations(): Promise<void> {
  const db = getDb();
  try {
    await db.execute(sql.raw(`
      INSERT INTO locations (merchant_id, name, slug, business_category, address, city, country, is_default, status)
      SELECT m.id,
        COALESCE(NULLIF(TRIM(m.name), ''), 'Main location'),
        'main',
        COALESCE(NULLIF(m.business_category, ''), 'restaurant'),
        m.address,
        m.city,
        m.country,
        true,
        'active'
      FROM merchants m
      WHERE NOT EXISTS (SELECT 1 FROM locations l WHERE l.merchant_id = m.id)
    `));
    await db.execute(sql.raw(`
      UPDATE orders o
      SET location_id = l.id
      FROM locations l
      WHERE o.merchant_id = l.merchant_id
        AND l.is_default = true
        AND o.location_id IS NULL
    `));
    await db.execute(sql.raw(`
      UPDATE pos_sessions ps
      SET location_id = l.id
      FROM locations l
      WHERE ps.merchant_id = l.merchant_id
        AND l.is_default = true
        AND ps.location_id IS NULL
    `));
  } catch (err) {
    console.warn("[schema] default location backfill failed:", err);
  }
}

function isOrdersColumnSchemaError(raw: string): boolean {
  return (
    isMissingSchemaError(raw) &&
    (/relation ["']?orders["']?/i.test(raw) ||
      /from ["']?orders["']?/i.test(raw) ||
      /column "[^"]+" of relation "orders"/i.test(raw))
  );
}

/** Apply all idempotent schema patches (safe to run on every boot). */
export async function ensureAllMerchantSchema(): Promise<void> {
  await ensureMerchantColumnsSchema();
  for (const column of Object.keys(EXTRA_COLUMN_PATCHES)) {
    if (column.startsWith("orders_")) {
      await runPatch(column.slice("orders_".length), "orders");
    } else if (column.startsWith("pos_sessions_")) {
      await runPatch(column.slice("pos_sessions_".length), "pos_sessions");
    } else if (column.startsWith("merchants_")) {
      await runPatch(column.slice("merchants_".length), "merchants");
    } else {
      await runPatch(column);
    }
  }
  await ensureMerchantTables();
  await ensureLocationsSchema();
}

/** Run schema patches at startup — await before accepting traffic. */
export function ensureMerchantSchemaAtStartup(): Promise<void> {
  if (!startupPatchPromise) {
    startupPatchPromise = ensureAllMerchantSchema().catch((err) => {
      console.warn("[schema] merchant startup patch failed:", err);
      startupPatchPromise = null;
    });
  }
  return startupPatchPromise;
}

function isMerchantsColumnSchemaError(raw: string): boolean {
  return (
    isMissingSchemaError(raw) &&
    (/relation ["']?merchants["']?/i.test(raw) ||
      /from ["']?merchants["']?/i.test(raw) ||
      /merchants\./i.test(raw))
  );
}

/** Retry a merchants query after applying missing-column/table patches. */
export async function withMerchantSchemaRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const raw = dbErrorChain(error);
      const patched = await patchMerchantSchemaFromError(error);
      const locationsMissing = isLocationsSchemaError(raw);
      const merchantsColumnMissing = isMerchantsColumnSchemaError(raw);
      const ordersColumnMissing = isOrdersColumnSchemaError(raw);
      const inventoryTableMissing = /relation ["']?(inventory_|product_recipes|signage_)/i.test(raw);
      if (locationsMissing) {
        await ensureLocationsSchema();
      } else if (merchantsColumnMissing) {
        await ensureMerchantColumnsSchema();
      } else if (ordersColumnMissing) {
        await ensureOrdersColumnsSchema();
      } else if (inventoryTableMissing) {
        patchedTables = false;
        await ensureMerchantTables();
      }
      if (
        !patched &&
        !inventoryTableMissing &&
        !locationsMissing &&
        !merchantsColumnMissing &&
        !ordersColumnMissing
      ) {
        throw error;
      }
    }
  }
  return fn();
}

/**
 * On a missing-column error, apply the matching patch (if known) so the caller can retry.
 * Returns true when a patch was applied.
 */
export async function patchMerchantSchemaFromError(error: unknown): Promise<boolean> {
  const raw = dbErrorChain(error);
  if (!isMissingSchemaError(raw)) return false;
  if (isLocationsSchemaError(raw)) {
    await ensureLocationsSchema();
    return true;
  }
  if (isMerchantsColumnSchemaError(raw)) {
    await ensureMerchantColumnsSchema();
    return true;
  }
  if (isOrdersColumnSchemaError(raw)) {
    await ensureOrdersColumnsSchema();
    return true;
  }
  const { table, column } = missingTableColumnFromDbError(error);
  if (!column) return false;
  return runPatch(column, table);
}
