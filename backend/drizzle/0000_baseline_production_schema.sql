CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"location_id" uuid,
	"name" varchar(255) NOT NULL,
	"description" text,
	"color" varchar(7),
	"image_url" varchar(500),
	"is_offers_category" boolean DEFAULT false NOT NULL,
	"visibility" json DEFAULT '{"channels":["pos","shop","qr_table","kiosk"]}'::json NOT NULL,
	"shop_schedule" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"delivery_pricing_enabled" boolean DEFAULT false NOT NULL,
	"extra_delivery_price" numeric(10, 2) DEFAULT '0',
	"sort_order" integer DEFAULT 0 NOT NULL,
	"client_id" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catering_inquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(64) NOT NULL,
	"event_date" varchar(40) NOT NULL,
	"guest_count" varchar(32) NOT NULL,
	"message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chaslay_floor_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"device_id" varchar(255) NOT NULL,
	"device_name" varchar(255),
	"role" varchar(30) DEFAULT 'STANDARD' NOT NULL,
	"lan_host" varchar(255),
	"app_version" varchar(50),
	"last_seen_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chaslay_floor_print_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"job_type" varchar(30) NOT NULL,
	"status" varchar(30) DEFAULT 'PENDING' NOT NULL,
	"payload" json DEFAULT '{}'::json,
	"source_device_id" varchar(255) DEFAULT '' NOT NULL,
	"target_role" varchar(30) DEFAULT 'MAIN_POS' NOT NULL,
	"order_id" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "chaslay_floor_table_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"local_order_id" varchar(255) NOT NULL,
	"table_id" integer DEFAULT 0 NOT NULL,
	"table_name" varchar(255) DEFAULT '' NOT NULL,
	"status" varchar(50) DEFAULT 'OPEN' NOT NULL,
	"service_type" varchar(50) DEFAULT 'DINE_IN' NOT NULL,
	"user_id" integer DEFAULT 0 NOT NULL,
	"user_name" varchar(255) DEFAULT '' NOT NULL,
	"cart_json" json DEFAULT '{}'::json,
	"source_device_id" varchar(255) DEFAULT '' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chaslay_homepage_builder_pages" (
	"id" serial PRIMARY KEY NOT NULL,
	"homepage_builder_id" integer NOT NULL,
	"merchant_id" uuid NOT NULL,
	"title" varchar(255) DEFAULT 'Home' NOT NULL,
	"slug" varchar(255) DEFAULT 'home' NOT NULL,
	"editor_state" text,
	"last_good_editor_state" text,
	"is_homepage" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "chaslay_homepage_builders" (
	"id" serial PRIMARY KEY NOT NULL,
	"merchant_id" uuid NOT NULL,
	"name" varchar(255) DEFAULT 'Untitled' NOT NULL,
	"editor_state" text,
	"last_good_editor_state" text,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "cms_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"slug" varchar(120) NOT NULL,
	"is_homepage" boolean DEFAULT false NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"template_key" varchar(40),
	"blocks" json DEFAULT '{"engine":"openpage","config":{"name":"","blocks":[]},"html":""}'::json NOT NULL,
	"theme" json,
	"seo_title" varchar(200),
	"seo_description" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "como_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"como_transaction_id" varchar(128) NOT NULL,
	"como_confirmation" varchar(255),
	"membership_key" varchar(255),
	"status" varchar(30) DEFAULT 'submitted' NOT NULL,
	"selected_assets" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"merchant_id" uuid NOT NULL,
	"label" varchar(40) DEFAULT 'home' NOT NULL,
	"address" text NOT NULL,
	"zip_code" varchar(20),
	"city" varchar(100),
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"email" varchar(255),
	"phone" varchar(20),
	"first_name" varchar(100),
	"last_name" varchar(100),
	"password_hash" varchar(255),
	"default_address" text,
	"default_zip" varchar(20),
	"default_city" varchar(100),
	"loyalty_points" integer DEFAULT 0,
	"total_spent" numeric(10, 2) DEFAULT '0',
	"marketing_opt_in" boolean DEFAULT true NOT NULL,
	"marketing_sms_opt_in" boolean DEFAULT false NOT NULL,
	"phone_verified_at" timestamp,
	"last_order_at" timestamp,
	"last_reorder_reminder_at" timestamp,
	"crm_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"allergies" text,
	"habits" text,
	"membership_plan_id" varchar(80),
	"photo_url" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"report_date" varchar(10) NOT NULL,
	"total_orders" integer DEFAULT 0,
	"total_revenue" numeric(10, 2) DEFAULT '0',
	"total_tax" numeric(10, 2) DEFAULT '0',
	"total_discount" numeric(10, 2) DEFAULT '0',
	"payment_breakdown" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_driver_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"latitude" numeric(10, 7) NOT NULL,
	"longitude" numeric(10, 7) NOT NULL,
	"accuracy_m" numeric(10, 2),
	"heading" numeric(6, 2),
	"speed_mps" numeric(8, 3),
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_driver_shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_zip_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"city" varchar(255),
	"zip_code" varchar(20),
	"zip_from" varchar(20),
	"zip_to" varchar(20),
	"min_order_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"delivery_fee" numeric(10, 2) DEFAULT '0' NOT NULL,
	"free_delivery_min_order" numeric(10, 2) DEFAULT '0' NOT NULL,
	"estimated_minutes" integer DEFAULT 45,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"polygon" json DEFAULT '[]'::json NOT NULL,
	"zip_codes" json DEFAULT '[]'::json,
	"min_order_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"delivery_fee" numeric(10, 2) DEFAULT '0' NOT NULL,
	"free_delivery_min_order" numeric(10, 2) DEFAULT '0' NOT NULL,
	"estimated_minutes" integer DEFAULT 45,
	"color" varchar(20) DEFAULT '#0d9488',
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"device_id" varchar(128) NOT NULL,
	"location_id" uuid NOT NULL,
	"station_id" uuid,
	"payment_profile_id" uuid NOT NULL,
	"payment_terminal_id" uuid NOT NULL,
	"print_snapshot" jsonb DEFAULT '{}'::jsonb,
	"enrolled_by_staff_id" uuid,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lock_enrollment" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"device_id" varchar(255) NOT NULL,
	"device_name" varchar(255) NOT NULL,
	"device_type" varchar(50) NOT NULL,
	"os_version" varchar(50),
	"app_version" varchar(50),
	"last_sync" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "devices_device_id_unique" UNIQUE("device_id")
);
--> statement-breakpoint
CREATE TABLE "dining_tables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"floor_plan_id" uuid NOT NULL,
	"label" varchar(50) NOT NULL,
	"capacity" integer DEFAULT 2 NOT NULL,
	"shape" varchar(20) DEFAULT 'rect' NOT NULL,
	"pos_x" integer DEFAULT 40 NOT NULL,
	"pos_y" integer DEFAULT 40 NOT NULL,
	"width" integer DEFAULT 100 NOT NULL,
	"height" integer DEFAULT 80 NOT NULL,
	"rotation" integer DEFAULT 0 NOT NULL,
	"status" varchar(30) DEFAULT 'available' NOT NULL,
	"current_order_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "editions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_type" varchar(20) DEFAULT 'platform' NOT NULL,
	"owner_id" uuid,
	"name" varchar(150) NOT NULL,
	"note" text,
	"business_category" varchar(20) DEFAULT 'both' NOT NULL,
	"features" json DEFAULT '[]'::json NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_send_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid,
	"order_id" uuid,
	"provider" varchar(20) NOT NULL,
	"source" varchar(30) NOT NULL,
	"email_type" varchar(50) DEFAULT 'general' NOT NULL,
	"recipient" varchar(255) NOT NULL,
	"subject" varchar(500),
	"status" varchar(20) DEFAULT 'sent' NOT NULL,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "floor_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"canvas_width" integer DEFAULT 1000 NOT NULL,
	"canvas_height" integer DEFAULT 700 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"elements_json" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gift_card_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"recipient_email" varchar(255) NOT NULL,
	"recipient_name" varchar(255),
	"sender_name" varchar(255),
	"sender_email" varchar(255),
	"message" text,
	"payment_method" varchar(20) DEFAULT 'card' NOT NULL,
	"payment_status" varchar(30) DEFAULT 'awaiting_payment' NOT NULL,
	"delivery_type" varchar(20) DEFAULT 'digital' NOT NULL,
	"shipping_address" text,
	"shipping_zip" varchar(20),
	"shipping_city" varchar(120),
	"shipping_country" varchar(2) DEFAULT 'CH',
	"card_theme" varchar(32) DEFAULT 'classic',
	"shipping_fee" numeric(10, 2) DEFAULT '0',
	"service_fee" numeric(10, 2) DEFAULT '0',
	"payment_fee" numeric(10, 2) DEFAULT '0',
	"total_charged" numeric(10, 2),
	"fulfillment_status" varchar(30),
	"shipped_at" timestamp with time zone,
	"adyen_reference" varchar(255),
	"card_id" uuid,
	"fulfilled_at" timestamp,
	"scheduled_deliver_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gift_card_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"card_id" uuid NOT NULL,
	"transaction_type" varchar(50) NOT NULL,
	"amount" numeric(10, 2),
	"balance_after" numeric(10, 2),
	"points" integer,
	"points_after" integer,
	"order_id" uuid,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gift_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"card_number" varchar(255) NOT NULL,
	"card_media_type" varchar(20) DEFAULT 'physical' NOT NULL,
	"balance" numeric(10, 2) DEFAULT '0' NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"suspended_reason" text,
	"customer_id" uuid,
	"membership_enabled" boolean DEFAULT false NOT NULL,
	"membership_plan_id" varchar(64),
	"stamp_count" integer DEFAULT 0 NOT NULL,
	"points_balance" integer DEFAULT 0 NOT NULL,
	"holder_name" varchar(255),
	"holder_email" varchar(255),
	"holder_phone" varchar(40),
	"ecard_email" varchar(255),
	"ecard_code" varchar(64),
	"issued_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "held_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"station_id" uuid,
	"label" varchar(120),
	"status" varchar(40) DEFAULT 'held' NOT NULL,
	"channel" varchar(50) DEFAULT 'takeaway',
	"cart_json" json NOT NULL,
	"notes" text,
	"staff_id" uuid,
	"staff_name" varchar(255),
	"closed_at" timestamp,
	"closed_reason" varchar(40),
	"paid_total" numeric(10, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hq_catalog_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"name" varchar(255) DEFAULT 'HQ Menu' NOT NULL,
	"payload_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_staff_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hq_menus" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"channels" jsonb DEFAULT '["pos","shop","qr_table"]'::jsonb NOT NULL,
	"days_of_week" jsonb DEFAULT '[0,1,2,3,4,5,6]'::jsonb NOT NULL,
	"time_start" varchar(5) DEFAULT '00:00' NOT NULL,
	"time_end" varchar(5) DEFAULT '23:59' NOT NULL,
	"schedule_type" varchar(16) DEFAULT 'weekly' NOT NULL,
	"days_of_month" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"time_ranges" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"product_prices" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"location_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"hq_version_id" uuid,
	"product_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"category_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"barcode" varchar(255),
	"unit" varchar(20) DEFAULT 'kg' NOT NULL,
	"cost" numeric(12, 4) DEFAULT '0' NOT NULL,
	"on_hand" numeric(14, 4) DEFAULT '0' NOT NULL,
	"min_stock" numeric(14, 4) DEFAULT '0' NOT NULL,
	"reorder_qty" numeric(14, 4) DEFAULT '0' NOT NULL,
	"supplier_id" uuid,
	"category_id" uuid,
	"perishable" boolean DEFAULT false NOT NULL,
	"auto_reorder_enabled" boolean DEFAULT false NOT NULL,
	"do_not_reorder" boolean DEFAULT false NOT NULL,
	"last_auto_reorder_at" timestamp,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_location_stock" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"on_hand" numeric(14, 4) DEFAULT '0' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"type" varchar(20) NOT NULL,
	"qty" numeric(14, 4) NOT NULL,
	"unit_cost" numeric(12, 4),
	"note" text,
	"supplier_name" varchar(255),
	"order_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_stock_lots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"movement_id" uuid,
	"qty" numeric(14, 4) NOT NULL,
	"remaining_qty" numeric(14, 4) NOT NULL,
	"expiry_date" timestamp,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255),
	"phone" varchar(40),
	"address" text,
	"contact_person" varchar(255),
	"notes" text,
	"archived_at" timestamp,
	"last_order_email_at" timestamp,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"from_location_id" uuid NOT NULL,
	"to_location_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"qty" numeric(14, 4) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"note" text,
	"created_by_staff_id" uuid,
	"created_by_name" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "inventory_unit_ratios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"from_code" varchar(20) NOT NULL,
	"to_code" varchar(20) NOT NULL,
	"factor" numeric(16, 6) NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(80) NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kds_stations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"token" varchar(128) NOT NULL,
	"short_code" varchar(8),
	"order_types" json DEFAULT '[]'::json NOT NULL,
	"category_ids" json DEFAULT '[]'::json NOT NULL,
	"product_ids" json DEFAULT '[]'::json NOT NULL,
	"theme" varchar(32) DEFAULT 'dark' NOT NULL,
	"layout_mode" varchar(16) DEFAULT 'grid' NOT NULL,
	"grid_columns" integer DEFAULT 3 NOT NULL,
	"overdue_minutes" integer DEFAULT 20 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kds_ticket_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"line_id" varchar(128) NOT NULL,
	"product_id" uuid,
	"category_id" uuid,
	"name" varchar(255) NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"line_note" text,
	"course_number" integer,
	"modifiers_json" json DEFAULT '{}'::json,
	"status" varchar(30) DEFAULT 'pending' NOT NULL,
	"ready_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kds_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"ticket_key" varchar(255) NOT NULL,
	"order_number" varchar(64),
	"table_label" varchar(120),
	"tab_number" varchar(64),
	"channel" varchar(50),
	"status" varchar(30) DEFAULT 'pending' NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "license_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"transaction_type" varchar(50) NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"payment_status" varchar(50) NOT NULL,
	"payment_method" varchar(50),
	"payment_id" varchar(255),
	"invoice_number" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "license_transactions_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "licenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"license_key" varchar(255) NOT NULL,
	"license_type" varchar(50) NOT NULL,
	"trial_days" integer DEFAULT 7,
	"starts_at" timestamp NOT NULL,
	"expires_at" timestamp NOT NULL,
	"renewal_notified_at" timestamp,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"issued_by_reseller_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "licenses_license_key_unique" UNIQUE("license_key")
);
--> statement-breakpoint
CREATE TABLE "location_catalog_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"hq_product_id" uuid NOT NULL,
	"local_product_id" uuid,
	"sync_status" varchar(30) DEFAULT 'synced' NOT NULL,
	"overrides_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"from_hq_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "location_product_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"price_override" numeric(10, 2),
	"visibility" jsonb,
	"is_available" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"business_category" varchar(20) DEFAULT 'restaurant' NOT NULL,
	"address" text,
	"city" varchar(100),
	"country" varchar(100),
	"timezone" varchar(64) DEFAULT 'Europe/Zurich',
	"is_default" boolean DEFAULT false NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"settings" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loyalty_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"card_number" varchar(255) NOT NULL,
	"customer_id" uuid,
	"card_type" varchar(50) NOT NULL,
	"balance" numeric(10, 2) DEFAULT '0',
	"points_balance" integer DEFAULT 0,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"suspended_reason" text,
	"issued_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "loyalty_cards_card_number_unique" UNIQUE("card_number")
);
--> statement-breakpoint
CREATE TABLE "loyalty_point_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"order_id" uuid,
	"product_id" uuid,
	"event_type" varchar(40) NOT NULL,
	"points" integer NOT NULL,
	"meta" json DEFAULT '{}'::json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loyalty_point_lots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"order_id" uuid,
	"points_granted" integer NOT NULL,
	"points_remaining" integer NOT NULL,
	"earned_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"source" varchar(40) DEFAULT 'earn' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loyalty_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"card_id" uuid NOT NULL,
	"transaction_type" varchar(50) NOT NULL,
	"amount" numeric(10, 2),
	"points" integer,
	"balance_after" numeric(10, 2),
	"description" text,
	"order_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_email_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"campaign_id" uuid,
	"email" varchar(255) NOT NULL,
	"customer_id" uuid,
	"type" varchar(40) NOT NULL,
	"status" varchar(30) DEFAULT 'sent' NOT NULL,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchant_addon_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"addon_id" uuid NOT NULL,
	"billing_cycle" varchar(20) NOT NULL,
	"status" varchar(30) DEFAULT 'active' NOT NULL,
	"period_start" timestamp,
	"period_end" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchant_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"permissions" text DEFAULT '' NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchant_staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255),
	"phone" varchar(32),
	"pin_hash" varchar(255),
	"pin_display" varchar(8),
	"extra_permissions" text,
	"password_hash" varchar(255),
	"can_access_panel" boolean DEFAULT false NOT NULL,
	"pin_only" boolean DEFAULT false NOT NULL,
	"login_home" varchar(20) DEFAULT 'auto' NOT NULL,
	"preferred_terminal_id" varchar(255),
	"delivery_hourly_rate_override" numeric(10, 2),
	"delivery_per_order_fee_override" numeric(10, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchant_staff_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(20),
	"business_license" varchar(255),
	"address" text,
	"city" varchar(100),
	"country" varchar(100),
	"support_code" varchar(16),
	"vat_number" varchar(50),
	"vat_rate" numeric(5, 2) DEFAULT '0',
	"tax_takeaway_rate" numeric(5, 2) DEFAULT '0',
	"tax_dine_in_rate" numeric(5, 2) DEFAULT '0',
	"tax_delivery_rate" numeric(5, 2) DEFAULT '0',
	"tax_included_in_price" boolean DEFAULT false NOT NULL,
	"vat_after_discount" boolean DEFAULT true NOT NULL,
	"slug" varchar(100),
	"subdomain" varchar(63),
	"custom_domain" varchar(255),
	"custom_domain_pending" varchar(255),
	"custom_domain_dns_status" varchar(20) DEFAULT 'none',
	"custom_domain_ssl_status" varchar(20) DEFAULT 'none',
	"custom_domain_verified_at" timestamp,
	"shop_enabled" boolean DEFAULT false NOT NULL,
	"accepting_orders" boolean DEFAULT true NOT NULL,
	"accepting_reservations" boolean DEFAULT true NOT NULL,
	"cms_homepage_enabled" boolean DEFAULT false NOT NULL,
	"pickup_enabled" boolean DEFAULT true NOT NULL,
	"dine_in_enabled" boolean DEFAULT true NOT NULL,
	"delivery_enabled" boolean DEFAULT true NOT NULL,
	"delivery_mode" varchar(20) DEFAULT 'zones' NOT NULL,
	"channel_select_mode" varchar(20) DEFAULT 'checkout' NOT NULL,
	"menu_show_product_images" boolean DEFAULT true NOT NULL,
	"menu_show_upsells" boolean DEFAULT true NOT NULL,
	"menu_show_category_banners" boolean DEFAULT true NOT NULL,
	"cart_layout" varchar(20) DEFAULT 'hidden_slide' NOT NULL,
	"scheduled_orders_enabled" boolean DEFAULT true NOT NULL,
	"store_hours" json DEFAULT '{}'::json,
	"shop_logo_url" varchar(500),
	"shop_banner_url" varchar(500),
	"shop_site_settings" jsonb,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"pickup_eta_minutes" integer DEFAULT 25,
	"delivery_eta_minutes" integer DEFAULT 45,
	"min_pre_order_delay_minutes" integer DEFAULT 30,
	"delivery_menu_markup" numeric(10, 2) DEFAULT '0',
	"category_pricing_enabled" boolean DEFAULT false NOT NULL,
	"catalog_scope_mode" varchar(20) DEFAULT 'per_location' NOT NULL,
	"delivery_driver_pay_mode" varchar(20) DEFAULT 'both' NOT NULL,
	"delivery_driver_hourly_rate" numeric(10, 2) DEFAULT '0',
	"delivery_per_order_fee" numeric(10, 2) DEFAULT '0',
	"adyen_merchant_account" varchar(255),
	"adyen_api_key" text,
	"adyen_client_id" varchar(255),
	"adyen_store_reference" varchar(255),
	"adyen_hmac_key" text,
	"tap_to_pay_enabled" boolean DEFAULT false NOT NULL,
	"adyen_live_environment" boolean DEFAULT false NOT NULL,
	"adyen_live_url_prefix" varchar(255),
	"adyen_live_region" varchar(10) DEFAULT 'EU' NOT NULL,
	"adyen_use_legacy_endpoint" boolean DEFAULT false NOT NULL,
	"webpos_express_enabled" boolean DEFAULT true NOT NULL,
	"webpos_cash_enabled" boolean DEFAULT true NOT NULL,
	"webpos_card_enabled" boolean DEFAULT true NOT NULL,
	"webpos_terminal_enabled" boolean DEFAULT true NOT NULL,
	"webpos_gift_card_enabled" boolean DEFAULT false NOT NULL,
	"webpos_invoice_enabled" boolean DEFAULT true NOT NULL,
	"bank_iban" varchar(34),
	"bank_qr_iban" varchar(34),
	"bank_name" varchar(255),
	"bank_account_holder" varchar(255),
	"invoice_sequence" integer DEFAULT 0 NOT NULL,
	"gift_card_settings" json,
	"gift_card_addon_enabled" boolean DEFAULT false NOT NULL,
	"sms_addon_enabled" boolean DEFAULT false NOT NULL,
	"sms_tier" varchar(20) DEFAULT 'starter' NOT NULL,
	"sms_unit_price_cents" integer DEFAULT 15 NOT NULL,
	"sms_settings" jsonb,
	"fiskaly_settings" jsonb,
	"como_settings" jsonb,
	"phone_ordering_settings" jsonb,
	"phone_ordering_addon_enabled" boolean DEFAULT false NOT NULL,
	"online_card_fee_fixed" numeric(10, 2) DEFAULT '0',
	"online_card_fee_percent" numeric(6, 3) DEFAULT '0',
	"loyalty_enabled" boolean DEFAULT false NOT NULL,
	"loyalty_earn_points_per_chf" numeric(8, 3) DEFAULT '1',
	"loyalty_redeem_points_per_chf" integer DEFAULT 100 NOT NULL,
	"loyalty_points_expiry_days" integer DEFAULT 30 NOT NULL,
	"panel_language" varchar(10) DEFAULT 'en' NOT NULL,
	"shop_language" varchar(10),
	"sync_api_key" varchar(64),
	"floor_plan_enabled" boolean DEFAULT false NOT NULL,
	"pax_ordering_enabled" boolean DEFAULT false NOT NULL,
	"courses_enabled" boolean DEFAULT false NOT NULL,
	"shifts_enabled" boolean DEFAULT false NOT NULL,
	"max_pos_posts" integer DEFAULT 0 NOT NULL,
	"max_waiter_posts" integer DEFAULT 0 NOT NULL,
	"max_staff" integer DEFAULT 0 NOT NULL,
	"max_locations" integer DEFAULT 1 NOT NULL,
	"inventory_addon_enabled" boolean DEFAULT false NOT NULL,
	"growth_analytics_addon_enabled" boolean DEFAULT false NOT NULL,
	"guest_crm_addon_enabled" boolean DEFAULT false NOT NULL,
	"marketing_automation_addon_enabled" boolean DEFAULT false NOT NULL,
	"smart_segments_addon_enabled" boolean DEFAULT false NOT NULL,
	"reservation_campaigns_addon_enabled" boolean DEFAULT false NOT NULL,
	"ai_coach_addon_enabled" boolean DEFAULT false NOT NULL,
	"google_reputation_addon_enabled" boolean DEFAULT false NOT NULL,
	"ai_web_seo_addon_enabled" boolean DEFAULT false NOT NULL,
	"marketing_automation_settings" jsonb,
	"smart_segments_settings" jsonb,
	"ai_coach_cache" jsonb,
	"google_reputation_settings" jsonb,
	"ai_web_seo_settings" jsonb,
	"signage_addon_enabled" boolean DEFAULT false NOT NULL,
	"signage_screen_limit" integer DEFAULT 2 NOT NULL,
	"kds_addon_enabled" boolean DEFAULT false NOT NULL,
	"ods_addon_enabled" boolean DEFAULT false NOT NULL,
	"kiosk_addon_enabled" boolean DEFAULT false NOT NULL,
	"catering_enabled" boolean DEFAULT false NOT NULL,
	"kiosk_settings" jsonb,
	"customer_display_settings" jsonb,
	"just_eat_addon_enabled" boolean DEFAULT false NOT NULL,
	"uber_eats_addon_enabled" boolean DEFAULT false NOT NULL,
	"bexio_addon_enabled" boolean DEFAULT false NOT NULL,
	"odoo_addon_enabled" boolean DEFAULT false NOT NULL,
	"storekeeper_addon_enabled" boolean DEFAULT false NOT NULL,
	"inventory_waste_factor" numeric(5, 4) DEFAULT '0.20' NOT NULL,
	"inventory_auto_reorder_email_enabled" boolean DEFAULT false NOT NULL,
	"inventory_expiry_alert_days" integer DEFAULT 30 NOT NULL,
	"pos_color_theme" varchar(20) DEFAULT 'teal' NOT NULL,
	"reservations_enabled" boolean DEFAULT false NOT NULL,
	"reservation_settings" json,
	"vacation_settings" json,
	"email_smtp_settings" json,
	"email_brevo_settings" json,
	"email_delivery_mode" varchar(20) DEFAULT 'platform' NOT NULL,
	"marketing_settings" json,
	"report_email_settings" json,
	"pos_print_settings" json,
	"table_qr_settings" json,
	"pos_checkout_settings" json,
	"time_slot_pricing_settings" jsonb,
	"pizza_builder_settings" jsonb,
	"delivery_platform_settings" json,
	"accounting_integration_settings" jsonb,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"auth_epoch" integer DEFAULT 0 NOT NULL,
	"subscription_plan" varchar(50) DEFAULT 'free',
	"trial_ends_at" timestamp,
	"subscription_ends_at" timestamp,
	"subscription_billing_cycle" varchar(20),
	"adyen_recurring_detail_reference" varchar(255),
	"reseller_id" uuid,
	"panel_nav_hidden" jsonb,
	"shop_commission_percent" numeric(6, 3),
	"edition_id" uuid,
	"business_category" varchar(20),
	"plan_billing_paid" boolean DEFAULT true NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"password_set_at" timestamp,
	"invite_token_hash" varchar(64),
	"invite_token_expires_at" timestamp,
	"invite_sent_at" timestamp,
	"shop_seo_footer" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "merchants_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "modifier_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"pricing_type" varchar(40) DEFAULT 'fixed' NOT NULL,
	"selection_type" varchar(40) DEFAULT 'optional' NOT NULL,
	"min_selectable" integer DEFAULT 0 NOT NULL,
	"max_selectable" integer DEFAULT 1 NOT NULL,
	"default_collapsed" boolean DEFAULT false NOT NULL,
	"allow_multiple_same_item" boolean DEFAULT false NOT NULL,
	"price_scope" varchar(20) DEFAULT 'fixed' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modifier_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"price" numeric(10, 2) DEFAULT '0' NOT NULL,
	"sale_status" varchar(40) DEFAULT 'in_stock' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"inventory_item_id" uuid,
	"inventory_qty" numeric(14, 4) DEFAULT '0' NOT NULL,
	"image_url" varchar(2048),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "newsletter_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"title" varchar(200) DEFAULT 'Newsletter' NOT NULL,
	"subject" varchar(300) NOT NULL,
	"body_html" text DEFAULT '' NOT NULL,
	"design_json" json,
	"status" varchar(30) DEFAULT 'draft' NOT NULL,
	"audience" varchar(30) DEFAULT 'all' NOT NULL,
	"recipient_count" integer DEFAULT 0,
	"sent_count" integer DEFAULT 0,
	"failed_count" integer DEFAULT 0,
	"selected_emails" json,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ods_dismissed_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"order_number" varchar(64) NOT NULL,
	"dismissed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ods_displays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"token" varchar(128) NOT NULL,
	"short_code" varchar(8),
	"theme" varchar(32) DEFAULT 'light' NOT NULL,
	"layout" varchar(20) DEFAULT 'columns' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ods_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"order_number" varchar(64) NOT NULL,
	"status" varchar(20) DEFAULT 'preparing' NOT NULL,
	"ready_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"offer_type" varchar(40) NOT NULL,
	"rules" json DEFAULT '{}'::json NOT NULL,
	"channels" json DEFAULT '[]'::json NOT NULL,
	"category_ids" json DEFAULT '[]'::json NOT NULL,
	"product_ids" json DEFAULT '[]'::json NOT NULL,
	"staff_ids" json DEFAULT '[]'::json NOT NULL,
	"schedule_mode" varchar(20) DEFAULT 'always' NOT NULL,
	"days_of_week" json DEFAULT '[]'::json NOT NULL,
	"time_start" varchar(5),
	"time_end" varchar(5),
	"valid_from" timestamp with time zone,
	"valid_to" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"featured" boolean DEFAULT true NOT NULL,
	"badge_label" varchar(40),
	"priority" integer DEFAULT 0 NOT NULL,
	"stackable" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid,
	"product_name" varchar(255),
	"quantity" numeric(12, 3) NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"total_price" numeric(10, 2) NOT NULL,
	"tax_amount" numeric(10, 2) NOT NULL,
	"weight_kg" numeric(12, 3),
	"selected_extras" json DEFAULT '[]'::json,
	"combo_selections" json DEFAULT '[]'::json,
	"catering_guest_count" integer,
	"is_open_price" boolean DEFAULT false NOT NULL,
	"seat_number" integer,
	"refunded_quantity" numeric(12, 3) DEFAULT '0'
);
--> statement-breakpoint
CREATE TABLE "order_refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"kind" varchar(20) DEFAULT 'referenced' NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"reason" text,
	"staff_id" uuid,
	"staff_name" varchar(255),
	"items_json" json,
	"allocation_json" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"location_id" uuid,
	"station_id" uuid,
	"order_number" varchar(50) NOT NULL,
	"customer_id" uuid,
	"order_type" varchar(50) NOT NULL,
	"order_source" varchar(50),
	"external_order_id" varchar(255),
	"fulfillment_channel" varchar(50) DEFAULT 'takeaway',
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL,
	"tax_amount" numeric(10, 2) NOT NULL,
	"discount_amount" numeric(10, 2) DEFAULT '0',
	"delivery_fee" numeric(10, 2) DEFAULT '0',
	"tip_amount" numeric(10, 2) DEFAULT '0',
	"rounding_amount" numeric(10, 2) DEFAULT '0',
	"amount_tendered" numeric(10, 2),
	"change_due" numeric(10, 2),
	"staff_name" varchar(255),
	"staff_id" uuid,
	"card_fee" numeric(10, 2) DEFAULT '0',
	"points_discount" numeric(10, 2) DEFAULT '0',
	"points_earned" integer DEFAULT 0,
	"points_redeemed" integer DEFAULT 0,
	"total" numeric(10, 2) NOT NULL,
	"payment_method" varchar(50),
	"payment_status" varchar(50),
	"invoice_number" varchar(50),
	"invoice_issued_at" timestamp,
	"invoice_due_at" timestamp,
	"adyen_reference" varchar(255),
	"adyen_poi_transaction_ts" timestamp,
	"adyen_customer_receipt_json" text,
	"adyen_cashier_receipt_json" text,
	"notes" text,
	"fiskaly_signature" jsonb,
	"como_loyalty" jsonb,
	"shipping_address" text,
	"delivery_latitude" numeric(10, 7),
	"delivery_longitude" numeric(10, 7),
	"assigned_delivery_staff_id" uuid,
	"delivery_tracking_token" varchar(64),
	"delivery_zone_id" uuid,
	"scheduled_for" timestamp,
	"customer_name" varchar(255),
	"customer_phone" varchar(40),
	"customer_email" varchar(255),
	"table_id" uuid,
	"table_label" varchar(50),
	"table_session_id" uuid,
	"guest_count" integer,
	"bill_splits" json DEFAULT '[]'::json,
	"master_order_id" varchar(64),
	"split_check_number" integer,
	"client_id" varchar(64),
	"device_id" varchar(255),
	"synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"estimated_ready_at" timestamp,
	"print_count" integer DEFAULT 0,
	"cancel_reason" text,
	"cancelled_at" timestamp,
	"refund_amount" numeric(10, 2) DEFAULT '0',
	"refunded_at" timestamp,
	"refund_reason" text,
	"goodwill_amount" numeric(10, 2) DEFAULT '0',
	"payment_breakdown" json,
	CONSTRAINT "orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" varchar(20) NOT NULL,
	"account_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"location_id" uuid,
	"is_default" boolean DEFAULT false NOT NULL,
	"adyen_merchant_account" varchar(255),
	"adyen_api_key" text,
	"adyen_client_id" varchar(255),
	"adyen_store_reference" varchar(255),
	"adyen_hmac_key" text,
	"adyen_live_environment" boolean DEFAULT false NOT NULL,
	"adyen_live_url_prefix" varchar(255),
	"adyen_live_region" varchar(10) DEFAULT 'EU' NOT NULL,
	"adyen_use_legacy_endpoint" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_terminals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"payment_profile_id" uuid,
	"terminal_id" varchar(255) NOT NULL,
	"terminal_name" varchar(255) NOT NULL,
	"serial_number" varchar(255),
	"adyen_merchant_account" varchar(255),
	"adyen_api_key" text,
	"adyen_client_id" varchar(255),
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"last_heartbeat" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payment_terminals_terminal_id_unique" UNIQUE("terminal_id")
);
--> statement-breakpoint
CREATE TABLE "payment_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"terminal_id" uuid,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"payment_method" varchar(50) NOT NULL,
	"adyen_reference" varchar(255),
	"adyen_poi_transaction_ts" timestamp,
	"status" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "platform_event_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"level" varchar(10) DEFAULT 'info' NOT NULL,
	"category" varchar(80) DEFAULT 'system' NOT NULL,
	"message" text NOT NULL,
	"metadata" json,
	"actor_role" varchar(20),
	"actor_id" uuid,
	"merchant_id" uuid,
	"reseller_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_message_dismissals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"viewer_role" varchar(20) NOT NULL,
	"viewer_id" uuid NOT NULL,
	"dismissed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" varchar(20) DEFAULT 'announcement' NOT NULL,
	"audience" varchar(30) DEFAULT 'all_merchants' NOT NULL,
	"target_merchant_id" uuid,
	"target_reseller_id" uuid,
	"title" varchar(255) NOT NULL,
	"body" text NOT NULL,
	"severity" varchar(20) DEFAULT 'info' NOT NULL,
	"external_url" varchar(500),
	"external_label" varchar(120),
	"show_on_login" boolean DEFAULT true NOT NULL,
	"show_in_banner" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"starts_at" timestamp,
	"ends_at" timestamp,
	"created_by_superadmin_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"key" varchar(100) PRIMARY KEY NOT NULL,
	"value" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_shop_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"status" varchar(30) DEFAULT 'pending' NOT NULL,
	"payment_status" varchar(30) DEFAULT 'pending' NOT NULL,
	"subtotal" numeric(10, 2) DEFAULT '0' NOT NULL,
	"discount_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total" numeric(10, 2) DEFAULT '0' NOT NULL,
	"currency" varchar(3) DEFAULT 'CHF' NOT NULL,
	"voucher_code" varchar(50),
	"items" json DEFAULT '[]'::json NOT NULL,
	"notes" text,
	"adyen_session_id" varchar(255),
	"adyen_psp_reference" varchar(255),
	"adyen_result_code" varchar(50),
	"paid_at" timestamp,
	"tracking_url" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_shop_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"price" numeric(10, 2) DEFAULT '0' NOT NULL,
	"discount_percent" integer,
	"image_url" varchar(500),
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_shop_vouchers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"label" varchar(255),
	"discount_percent" integer,
	"discount_amount" numeric(10, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	"max_uses" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "platform_shop_vouchers_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "pos_cash_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"staff_id" uuid,
	"staff_name" varchar(255),
	"type" varchar(10) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pos_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"location_id" uuid,
	"station_id" uuid,
	"session_kind" varchar(20) DEFAULT 'main' NOT NULL,
	"platform" varchar(30) NOT NULL,
	"device_id" varchar(128) NOT NULL,
	"device_label" varchar(255),
	"staff_id" uuid,
	"staff_name" varchar(255),
	"print_agent_online" boolean,
	"last_heartbeat" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pos_shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"staff_id" uuid,
	"staff_name" varchar(255),
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"opened_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp,
	"opening_cash" numeric(12, 2) DEFAULT '0' NOT NULL,
	"closing_cash_counted" numeric(12, 2),
	"expected_cash" numeric(12, 2),
	"cash_sales" numeric(12, 2) DEFAULT '0',
	"card_sales" numeric(12, 2) DEFAULT '0',
	"terminal_sales" numeric(12, 2) DEFAULT '0',
	"other_sales" numeric(12, 2) DEFAULT '0',
	"order_count" integer DEFAULT 0,
	"variance" numeric(12, 2),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pos_stations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"payment_profile_id" uuid,
	"name" varchar(120) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pricing_bulk_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"location_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"category_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"product_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"operation" varchar(20) NOT NULL,
	"value_type" varchar(20) NOT NULL,
	"value" numeric(12, 4) NOT NULL,
	"round_to" numeric(6, 4),
	"affected_count" integer DEFAULT 0 NOT NULL,
	"created_by_staff_id" uuid,
	"created_by_name" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_modifier_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"qty" numeric(14, 4) NOT NULL,
	"unit" varchar(20) DEFAULT 'kg' NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"location_id" uuid,
	"category_id" uuid,
	"name" varchar(255) NOT NULL,
	"sku" varchar(100),
	"barcode" varchar(255),
	"price" numeric(10, 2) NOT NULL,
	"cost" numeric(10, 2),
	"stock" integer DEFAULT 0 NOT NULL,
	"low_stock_threshold" integer DEFAULT 5,
	"is_taxable" boolean DEFAULT true NOT NULL,
	"description" text,
	"image_url" varchar(500),
	"product_type" varchar(50) DEFAULT 'standard' NOT NULL,
	"is_open_price" boolean DEFAULT false NOT NULL,
	"sold_by_weight" boolean DEFAULT false NOT NULL,
	"weight_unit" varchar(10) DEFAULT 'kg',
	"bulk_pricing" json DEFAULT '[]'::json,
	"extras" json DEFAULT '[]'::json,
	"combo_items" json DEFAULT '[]'::json,
	"catering_config" jsonb DEFAULT '{}'::jsonb,
	"specifications" json DEFAULT '[]'::json,
	"button_color" varchar(20),
	"allow_extras" boolean DEFAULT false NOT NULL,
	"loyalty_reward_points" integer,
	"recipe_yield" numeric(12, 4) DEFAULT '1' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"client_id" varchar(64),
	"is_active" boolean DEFAULT true NOT NULL,
	"visibility" json DEFAULT '{"channels":["pos","shop","qr_table","kiosk"]}'::json NOT NULL,
	"similar_product_ids" jsonb DEFAULT '[]'::jsonb,
	"dietary_tags" jsonb DEFAULT '[]'::jsonb,
	"brand" varchar(255),
	"extra_barcodes" jsonb DEFAULT '[]'::jsonb,
	"time_slot_prices" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "published_pull_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" integer NOT NULL,
	"title" varchar(500) NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"html_url" varchar(500) DEFAULT '' NOT NULL,
	"author" varchar(120) DEFAULT '' NOT NULL,
	"base_branch" varchar(80) DEFAULT '' NOT NULL,
	"merged_at" timestamp with time zone NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resellers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"phone" varchar(40),
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"license_seats" integer DEFAULT 0 NOT NULL,
	"branding" json,
	"created_by_superadmin_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "resellers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "reservation_growth_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"code" varchar(40) NOT NULL,
	"name" varchar(200) NOT NULL,
	"perk_label" varchar(200),
	"message" text,
	"click_count" integer DEFAULT 0 NOT NULL,
	"booking_count" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"code" varchar(32) NOT NULL,
	"customer_id" uuid,
	"guest_name" varchar(200) NOT NULL,
	"guest_email" varchar(255),
	"guest_phone" varchar(50) NOT NULL,
	"party_size" integer DEFAULT 2 NOT NULL,
	"reserved_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer DEFAULT 90 NOT NULL,
	"status" varchar(30) DEFAULT 'pending' NOT NULL,
	"table_id" uuid,
	"table_label" varchar(50),
	"discount_percent" integer,
	"discount_label" varchar(80),
	"notes" text,
	"internal_notes" text,
	"source" varchar(30) DEFAULT 'web' NOT NULL,
	"confirmation_sent_at" timestamp with time zone,
	"reminder_sent_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"seated_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"extras" jsonb
);
--> statement-breakpoint
CREATE TABLE "rfid_readers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"reader_uid" varchar(255) NOT NULL,
	"connection_type" varchar(50) DEFAULT 'hid' NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"last_seen_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signage_playlists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"template" varchar(40) DEFAULT 'dark_pizza' NOT NULL,
	"schedule" json DEFAULT '{"type":"always"}'::json NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signage_screens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"token" varchar(128) NOT NULL,
	"short_code" varchar(8),
	"orientation" varchar(20) DEFAULT 'landscape' NOT NULL,
	"template" varchar(40) DEFAULT 'dark_pizza' NOT NULL,
	"screen_size_in" integer DEFAULT 32 NOT NULL,
	"playlist_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signage_slides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"playlist_id" uuid NOT NULL,
	"type" varchar(30) DEFAULT 'menu' NOT NULL,
	"duration_sec" integer DEFAULT 10 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"category_ids" json DEFAULT '[]'::json NOT NULL,
	"headline" varchar(255),
	"body" text,
	"image_url" varchar(500),
	"show_prices" boolean DEFAULT true NOT NULL,
	"show_photos" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sms_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"body" text NOT NULL,
	"audience" varchar(20) DEFAULT 'all' NOT NULL,
	"selected_phones" jsonb,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"recipient_count" integer DEFAULT 0 NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sms_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"customer_id" uuid,
	"campaign_id" uuid,
	"to_e164" varchar(20) NOT NULL,
	"type" varchar(20) NOT NULL,
	"event" varchar(60) NOT NULL,
	"body" text NOT NULL,
	"segments" integer DEFAULT 1 NOT NULL,
	"status" varchar(20) DEFAULT 'queued' NOT NULL,
	"provider_id" varchar(80),
	"provider_batch_id" varchar(80),
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sms_otps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"phone_e164" varchar(20) NOT NULL,
	"purpose" varchar(20) NOT NULL,
	"code_hash" varchar(64) NOT NULL,
	"meta" jsonb,
	"ip" varchar(64),
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp NOT NULL,
	"consumed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sms_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"period_ym" varchar(7) NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"segments_billed" integer DEFAULT 0 NOT NULL,
	"billable_cents" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "software_releases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" varchar(40) NOT NULL,
	"title" varchar(255) NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"product" varchar(30) DEFAULT 'all' NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_superadmin_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_addon_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"addon_id" uuid NOT NULL,
	"billing_cycle" varchar(20) NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'CHF' NOT NULL,
	"status" varchar(30) DEFAULT 'pending' NOT NULL,
	"adyen_session_id" varchar(255),
	"adyen_psp_reference" varchar(255),
	"adyen_recurring_detail_reference" varchar(255),
	"is_recurring" boolean DEFAULT false NOT NULL,
	"adyen_result_code" varchar(50),
	"paid_at" timestamp,
	"period_start" timestamp,
	"period_end" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_addons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_type" varchar(20) DEFAULT 'platform' NOT NULL,
	"owner_id" uuid,
	"slug" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"addon_key" varchar(40) NOT NULL,
	"price_monthly" numeric(10, 2) DEFAULT '0' NOT NULL,
	"price_yearly" numeric(10, 2),
	"currency" varchar(3) DEFAULT 'CHF' NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"billing_cycle" varchar(20) NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'CHF' NOT NULL,
	"status" varchar(30) DEFAULT 'pending' NOT NULL,
	"adyen_session_id" varchar(255),
	"adyen_psp_reference" varchar(255),
	"adyen_recurring_detail_reference" varchar(255),
	"is_recurring" boolean DEFAULT false NOT NULL,
	"adyen_result_code" varchar(50),
	"paid_at" timestamp,
	"period_start" timestamp,
	"period_end" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_type" varchar(20) DEFAULT 'platform' NOT NULL,
	"owner_id" uuid,
	"name" varchar(100) NOT NULL,
	"slug" varchar(50) NOT NULL,
	"description" text,
	"price_monthly" numeric(10, 2) DEFAULT '0' NOT NULL,
	"price_yearly" numeric(10, 2),
	"currency" varchar(3) DEFAULT 'CHF' NOT NULL,
	"edition_id" uuid,
	"max_devices" integer DEFAULT 1 NOT NULL,
	"max_products" integer,
	"max_pos_posts" integer DEFAULT 0 NOT NULL,
	"max_waiter_posts" integer DEFAULT 0 NOT NULL,
	"max_staff" integer DEFAULT 0 NOT NULL,
	"max_locations" integer DEFAULT 1 NOT NULL,
	"included_addons" json DEFAULT '{}'::json,
	"features" json DEFAULT '[]'::json,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"trial_days" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_plans_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "superadmins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"role" varchar(50) DEFAULT 'superadmin' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"handles_support" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "superadmins_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "support_ticket_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"author_role" varchar(20) NOT NULL,
	"author_id" uuid,
	"author_name" varchar(255),
	"body" text NOT NULL,
	"attachment_url" varchar(500),
	"attachment_name" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_number" varchar(20) NOT NULL,
	"merchant_id" uuid,
	"reseller_id" uuid,
	"requester_role" varchar(20) DEFAULT 'merchant' NOT NULL,
	"category" varchar(30) DEFAULT 'technical' NOT NULL,
	"subcategory" varchar(80),
	"subject" varchar(255) NOT NULL,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"merchant_visible" boolean DEFAULT true NOT NULL,
	"assigned_to_superadmin_id" uuid,
	"last_message_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp,
	"auto_close_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "table_qr_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"table_id" uuid NOT NULL,
	"code_type" varchar(20) DEFAULT 'static' NOT NULL,
	"code" varchar(512) NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "table_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"table_id" uuid NOT NULL,
	"session_token" varchar(64) NOT NULL,
	"status" varchar(30) DEFAULT 'open' NOT NULL,
	"guest_count" integer,
	"opened_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "vat_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"country" varchar(100) NOT NULL,
	"vat_rate" numeric(5, 2) NOT NULL,
	"tax_id" varchar(255),
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voucher_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"voucher_id" uuid NOT NULL,
	"order_id" uuid,
	"customer_id" uuid,
	"code" varchar(64) NOT NULL,
	"discount_amount" numeric(10, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vouchers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(255),
	"usage_type" varchar(20) DEFAULT 'multi_use' NOT NULL,
	"max_redemptions" integer DEFAULT 1 NOT NULL,
	"customer_id" uuid,
	"discount_type" varchar(20) DEFAULT 'percent' NOT NULL,
	"discount_value" numeric(10, 2) NOT NULL,
	"min_order_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"order_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"valid_from" timestamp with time zone,
	"valid_to" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"redemption_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catering_inquiries" ADD CONSTRAINT "catering_inquiries_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chaslay_floor_devices" ADD CONSTRAINT "chaslay_floor_devices_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chaslay_floor_print_jobs" ADD CONSTRAINT "chaslay_floor_print_jobs_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chaslay_floor_table_orders" ADD CONSTRAINT "chaslay_floor_table_orders_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chaslay_homepage_builder_pages" ADD CONSTRAINT "chaslay_homepage_builder_pages_homepage_builder_id_chaslay_homepage_builders_id_fk" FOREIGN KEY ("homepage_builder_id") REFERENCES "public"."chaslay_homepage_builders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chaslay_homepage_builder_pages" ADD CONSTRAINT "chaslay_homepage_builder_pages_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chaslay_homepage_builders" ADD CONSTRAINT "chaslay_homepage_builders_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_pages" ADD CONSTRAINT "cms_pages_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "como_transactions" ADD CONSTRAINT "como_transactions_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_reports" ADD CONSTRAINT "daily_reports_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_driver_locations" ADD CONSTRAINT "delivery_driver_locations_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_driver_locations" ADD CONSTRAINT "delivery_driver_locations_staff_id_merchant_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."merchant_staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_driver_shifts" ADD CONSTRAINT "delivery_driver_shifts_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_driver_shifts" ADD CONSTRAINT "delivery_driver_shifts_staff_id_merchant_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."merchant_staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_zip_rules" ADD CONSTRAINT "delivery_zip_rules_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_zones" ADD CONSTRAINT "delivery_zones_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_enrollments" ADD CONSTRAINT "device_enrollments_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_enrollments" ADD CONSTRAINT "device_enrollments_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_enrollments" ADD CONSTRAINT "device_enrollments_station_id_pos_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."pos_stations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_enrollments" ADD CONSTRAINT "device_enrollments_payment_profile_id_payment_profiles_id_fk" FOREIGN KEY ("payment_profile_id") REFERENCES "public"."payment_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_enrollments" ADD CONSTRAINT "device_enrollments_payment_terminal_id_payment_terminals_id_fk" FOREIGN KEY ("payment_terminal_id") REFERENCES "public"."payment_terminals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_enrollments" ADD CONSTRAINT "device_enrollments_enrolled_by_staff_id_merchant_staff_id_fk" FOREIGN KEY ("enrolled_by_staff_id") REFERENCES "public"."merchant_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dining_tables" ADD CONSTRAINT "dining_tables_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dining_tables" ADD CONSTRAINT "dining_tables_floor_plan_id_floor_plans_id_fk" FOREIGN KEY ("floor_plan_id") REFERENCES "public"."floor_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_send_log" ADD CONSTRAINT "email_send_log_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "floor_plans" ADD CONSTRAINT "floor_plans_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_card_purchases" ADD CONSTRAINT "gift_card_purchases_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_card_purchases" ADD CONSTRAINT "gift_card_purchases_card_id_gift_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."gift_cards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_card_transactions" ADD CONSTRAINT "gift_card_transactions_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_card_transactions" ADD CONSTRAINT "gift_card_transactions_card_id_gift_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."gift_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_card_transactions" ADD CONSTRAINT "gift_card_transactions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_cards" ADD CONSTRAINT "gift_cards_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_cards" ADD CONSTRAINT "gift_cards_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "held_orders" ADD CONSTRAINT "held_orders_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "held_orders" ADD CONSTRAINT "held_orders_station_id_pos_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."pos_stations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hq_catalog_versions" ADD CONSTRAINT "hq_catalog_versions_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hq_catalog_versions" ADD CONSTRAINT "hq_catalog_versions_created_by_staff_id_merchant_staff_id_fk" FOREIGN KEY ("created_by_staff_id") REFERENCES "public"."merchant_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hq_menus" ADD CONSTRAINT "hq_menus_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hq_menus" ADD CONSTRAINT "hq_menus_hq_version_id_hq_catalog_versions_id_fk" FOREIGN KEY ("hq_version_id") REFERENCES "public"."hq_catalog_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_categories" ADD CONSTRAINT "inventory_categories_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_supplier_id_inventory_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."inventory_suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_location_stock" ADD CONSTRAINT "inventory_location_stock_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_location_stock" ADD CONSTRAINT "inventory_location_stock_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_location_stock" ADD CONSTRAINT "inventory_location_stock_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_stock_lots" ADD CONSTRAINT "inventory_stock_lots_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_stock_lots" ADD CONSTRAINT "inventory_stock_lots_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_stock_lots" ADD CONSTRAINT "inventory_stock_lots_movement_id_inventory_movements_id_fk" FOREIGN KEY ("movement_id") REFERENCES "public"."inventory_movements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_suppliers" ADD CONSTRAINT "inventory_suppliers_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_from_location_id_locations_id_fk" FOREIGN KEY ("from_location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_to_location_id_locations_id_fk" FOREIGN KEY ("to_location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_created_by_staff_id_merchant_staff_id_fk" FOREIGN KEY ("created_by_staff_id") REFERENCES "public"."merchant_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_unit_ratios" ADD CONSTRAINT "inventory_unit_ratios_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_units" ADD CONSTRAINT "inventory_units_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kds_stations" ADD CONSTRAINT "kds_stations_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kds_ticket_items" ADD CONSTRAINT "kds_ticket_items_ticket_id_kds_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."kds_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kds_tickets" ADD CONSTRAINT "kds_tickets_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "license_transactions" ADD CONSTRAINT "license_transactions_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_issued_by_reseller_id_resellers_id_fk" FOREIGN KEY ("issued_by_reseller_id") REFERENCES "public"."resellers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_catalog_links" ADD CONSTRAINT "location_catalog_links_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_catalog_links" ADD CONSTRAINT "location_catalog_links_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_catalog_links" ADD CONSTRAINT "location_catalog_links_local_product_id_products_id_fk" FOREIGN KEY ("local_product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_catalog_links" ADD CONSTRAINT "location_catalog_links_from_hq_version_id_hq_catalog_versions_id_fk" FOREIGN KEY ("from_hq_version_id") REFERENCES "public"."hq_catalog_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_product_overrides" ADD CONSTRAINT "location_product_overrides_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_product_overrides" ADD CONSTRAINT "location_product_overrides_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_product_overrides" ADD CONSTRAINT "location_product_overrides_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_cards" ADD CONSTRAINT "loyalty_cards_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_cards" ADD CONSTRAINT "loyalty_cards_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_point_events" ADD CONSTRAINT "loyalty_point_events_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_point_events" ADD CONSTRAINT "loyalty_point_events_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_point_events" ADD CONSTRAINT "loyalty_point_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_point_events" ADD CONSTRAINT "loyalty_point_events_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_point_lots" ADD CONSTRAINT "loyalty_point_lots_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_point_lots" ADD CONSTRAINT "loyalty_point_lots_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_point_lots" ADD CONSTRAINT "loyalty_point_lots_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_card_id_loyalty_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."loyalty_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_email_log" ADD CONSTRAINT "marketing_email_log_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_email_log" ADD CONSTRAINT "marketing_email_log_campaign_id_newsletter_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."newsletter_campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_email_log" ADD CONSTRAINT "marketing_email_log_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_addon_subscriptions" ADD CONSTRAINT "merchant_addon_subscriptions_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_addon_subscriptions" ADD CONSTRAINT "merchant_addon_subscriptions_addon_id_subscription_addons_id_fk" FOREIGN KEY ("addon_id") REFERENCES "public"."subscription_addons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_roles" ADD CONSTRAINT "merchant_roles_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_staff" ADD CONSTRAINT "merchant_staff_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_staff" ADD CONSTRAINT "merchant_staff_role_id_merchant_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."merchant_roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_staff_locations" ADD CONSTRAINT "merchant_staff_locations_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_staff_locations" ADD CONSTRAINT "merchant_staff_locations_staff_id_merchant_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."merchant_staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_staff_locations" ADD CONSTRAINT "merchant_staff_locations_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_reseller_id_resellers_id_fk" FOREIGN KEY ("reseller_id") REFERENCES "public"."resellers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modifier_groups" ADD CONSTRAINT "modifier_groups_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modifier_options" ADD CONSTRAINT "modifier_options_group_id_modifier_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."modifier_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "newsletter_campaigns" ADD CONSTRAINT "newsletter_campaigns_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ods_dismissed_orders" ADD CONSTRAINT "ods_dismissed_orders_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ods_displays" ADD CONSTRAINT "ods_displays_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ods_orders" ADD CONSTRAINT "ods_orders_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_refunds" ADD CONSTRAINT "order_refunds_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_refunds" ADD CONSTRAINT "order_refunds_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_station_id_pos_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."pos_stations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_staff_id_merchant_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."merchant_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_assigned_delivery_staff_id_merchant_staff_id_fk" FOREIGN KEY ("assigned_delivery_staff_id") REFERENCES "public"."merchant_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_profiles" ADD CONSTRAINT "payment_profiles_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_profiles" ADD CONSTRAINT "payment_profiles_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_terminals" ADD CONSTRAINT "payment_terminals_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_terminals" ADD CONSTRAINT "payment_terminals_payment_profile_id_payment_profiles_id_fk" FOREIGN KEY ("payment_profile_id") REFERENCES "public"."payment_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_terminal_id_payment_terminals_id_fk" FOREIGN KEY ("terminal_id") REFERENCES "public"."payment_terminals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_message_dismissals" ADD CONSTRAINT "platform_message_dismissals_message_id_platform_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."platform_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_shop_orders" ADD CONSTRAINT "platform_shop_orders_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_cash_movements" ADD CONSTRAINT "pos_cash_movements_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_cash_movements" ADD CONSTRAINT "pos_cash_movements_shift_id_pos_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."pos_shifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_cash_movements" ADD CONSTRAINT "pos_cash_movements_staff_id_merchant_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."merchant_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_sessions" ADD CONSTRAINT "pos_sessions_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_sessions" ADD CONSTRAINT "pos_sessions_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_sessions" ADD CONSTRAINT "pos_sessions_station_id_pos_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."pos_stations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_shifts" ADD CONSTRAINT "pos_shifts_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_shifts" ADD CONSTRAINT "pos_shifts_staff_id_merchant_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."merchant_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_stations" ADD CONSTRAINT "pos_stations_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_stations" ADD CONSTRAINT "pos_stations_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_stations" ADD CONSTRAINT "pos_stations_payment_profile_id_payment_profiles_id_fk" FOREIGN KEY ("payment_profile_id") REFERENCES "public"."payment_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_bulk_jobs" ADD CONSTRAINT "pricing_bulk_jobs_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_bulk_jobs" ADD CONSTRAINT "pricing_bulk_jobs_created_by_staff_id_merchant_staff_id_fk" FOREIGN KEY ("created_by_staff_id") REFERENCES "public"."merchant_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_modifier_groups" ADD CONSTRAINT "product_modifier_groups_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_modifier_groups" ADD CONSTRAINT "product_modifier_groups_group_id_modifier_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."modifier_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_recipes" ADD CONSTRAINT "product_recipes_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_recipes" ADD CONSTRAINT "product_recipes_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_recipes" ADD CONSTRAINT "product_recipes_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resellers" ADD CONSTRAINT "resellers_created_by_superadmin_id_superadmins_id_fk" FOREIGN KEY ("created_by_superadmin_id") REFERENCES "public"."superadmins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_growth_campaigns" ADD CONSTRAINT "reservation_growth_campaigns_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_table_id_dining_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."dining_tables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfid_readers" ADD CONSTRAINT "rfid_readers_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signage_playlists" ADD CONSTRAINT "signage_playlists_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signage_screens" ADD CONSTRAINT "signage_screens_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signage_screens" ADD CONSTRAINT "signage_screens_playlist_id_signage_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."signage_playlists"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signage_slides" ADD CONSTRAINT "signage_slides_playlist_id_signage_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."signage_playlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_campaigns" ADD CONSTRAINT "sms_campaigns_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_otps" ADD CONSTRAINT "sms_otps_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_usage" ADD CONSTRAINT "sms_usage_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_addon_payments" ADD CONSTRAINT "subscription_addon_payments_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_addon_payments" ADD CONSTRAINT "subscription_addon_payments_addon_id_subscription_addons_id_fk" FOREIGN KEY ("addon_id") REFERENCES "public"."subscription_addons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD CONSTRAINT "subscription_plans_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_reseller_id_resellers_id_fk" FOREIGN KEY ("reseller_id") REFERENCES "public"."resellers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_qr_codes" ADD CONSTRAINT "table_qr_codes_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_qr_codes" ADD CONSTRAINT "table_qr_codes_table_id_dining_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."dining_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_sessions" ADD CONSTRAINT "table_sessions_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_sessions" ADD CONSTRAINT "table_sessions_table_id_dining_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."dining_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vat_settings" ADD CONSTRAINT "vat_settings_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voucher_redemptions" ADD CONSTRAINT "voucher_redemptions_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voucher_redemptions" ADD CONSTRAINT "voucher_redemptions_voucher_id_vouchers_id_fk" FOREIGN KEY ("voucher_id") REFERENCES "public"."vouchers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voucher_redemptions" ADD CONSTRAINT "voucher_redemptions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voucher_redemptions" ADD CONSTRAINT "voucher_redemptions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "categories_merchant_id_idx" ON "categories" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "categories_merchant_location_idx" ON "categories" USING btree ("merchant_id","location_id");--> statement-breakpoint
CREATE INDEX "categories_client_id_idx" ON "categories" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "catering_inquiries_merchant_id_idx" ON "catering_inquiries" USING btree ("merchant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chaslay_floor_devices_merchant_device_idx" ON "chaslay_floor_devices" USING btree ("merchant_id","device_id");--> statement-breakpoint
CREATE INDEX "chaslay_floor_print_jobs_merchant_status_idx" ON "chaslay_floor_print_jobs" USING btree ("merchant_id","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "chaslay_floor_orders_merchant_local_idx" ON "chaslay_floor_table_orders" USING btree ("merchant_id","local_order_id");--> statement-breakpoint
CREATE INDEX "chaslay_floor_orders_merchant_updated_idx" ON "chaslay_floor_table_orders" USING btree ("merchant_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "chaslay_homepage_builder_pages_slug_uq" ON "chaslay_homepage_builder_pages" USING btree ("homepage_builder_id","slug");--> statement-breakpoint
CREATE INDEX "chaslay_homepage_builder_pages_sort_idx" ON "chaslay_homepage_builder_pages" USING btree ("homepage_builder_id","sort_order");--> statement-breakpoint
CREATE INDEX "chaslay_homepage_builders_merchant_idx" ON "chaslay_homepage_builders" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "chaslay_homepage_builders_active_idx" ON "chaslay_homepage_builders" USING btree ("merchant_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "cms_pages_merchant_slug_uq" ON "cms_pages" USING btree ("merchant_id","slug");--> statement-breakpoint
CREATE INDEX "cms_pages_merchant_homepage_idx" ON "cms_pages" USING btree ("merchant_id","is_homepage");--> statement-breakpoint
CREATE INDEX "como_transactions_merchant_id_idx" ON "como_transactions" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "como_transactions_order_id_idx" ON "como_transactions" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "customer_addresses_customer_idx" ON "customer_addresses" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "customer_addresses_merchant_customer_idx" ON "customer_addresses" USING btree ("merchant_id","customer_id");--> statement-breakpoint
CREATE INDEX "customers_merchant_id_idx" ON "customers" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "customers_email_idx" ON "customers" USING btree ("email");--> statement-breakpoint
CREATE INDEX "customers_last_order_idx" ON "customers" USING btree ("merchant_id","last_order_at");--> statement-breakpoint
CREATE INDEX "daily_reports_merchant_id_idx" ON "daily_reports" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "daily_reports_report_date_idx" ON "daily_reports" USING btree ("report_date");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_driver_locations_merchant_staff_uidx" ON "delivery_driver_locations" USING btree ("merchant_id","staff_id");--> statement-breakpoint
CREATE INDEX "delivery_driver_locations_merchant_recorded_idx" ON "delivery_driver_locations" USING btree ("merchant_id","recorded_at");--> statement-breakpoint
CREATE INDEX "delivery_driver_shifts_merchant_staff_idx" ON "delivery_driver_shifts" USING btree ("merchant_id","staff_id","started_at");--> statement-breakpoint
CREATE INDEX "delivery_zip_rules_merchant_id_idx" ON "delivery_zip_rules" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "delivery_zones_merchant_id_idx" ON "delivery_zones" USING btree ("merchant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "device_enrollments_merchant_device_idx" ON "device_enrollments" USING btree ("merchant_id","device_id");--> statement-breakpoint
CREATE INDEX "device_enrollments_merchant_id_idx" ON "device_enrollments" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "devices_merchant_id_idx" ON "devices" USING btree ("merchant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "devices_device_id_idx" ON "devices" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "dining_tables_merchant_id_idx" ON "dining_tables" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "dining_tables_floor_plan_id_idx" ON "dining_tables" USING btree ("floor_plan_id");--> statement-breakpoint
CREATE INDEX "editions_owner_idx" ON "editions" USING btree ("owner_type","owner_id");--> statement-breakpoint
CREATE INDEX "editions_name_idx" ON "editions" USING btree ("name");--> statement-breakpoint
CREATE INDEX "email_send_log_merchant_idx" ON "email_send_log" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "email_send_log_order_idx" ON "email_send_log" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "email_send_log_type_idx" ON "email_send_log" USING btree ("email_type");--> statement-breakpoint
CREATE INDEX "email_send_log_created_idx" ON "email_send_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "email_send_log_merchant_created_idx" ON "email_send_log" USING btree ("merchant_id","created_at");--> statement-breakpoint
CREATE INDEX "floor_plans_merchant_id_idx" ON "floor_plans" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "gift_card_purchases_merchant_id_idx" ON "gift_card_purchases" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "gift_card_purchases_payment_status_idx" ON "gift_card_purchases" USING btree ("payment_status");--> statement-breakpoint
CREATE INDEX "gift_card_transactions_merchant_id_idx" ON "gift_card_transactions" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "gift_card_transactions_card_id_idx" ON "gift_card_transactions" USING btree ("card_id");--> statement-breakpoint
CREATE INDEX "gift_card_transactions_order_id_idx" ON "gift_card_transactions" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "gift_cards_merchant_id_idx" ON "gift_cards" USING btree ("merchant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "gift_cards_merchant_card_number_idx" ON "gift_cards" USING btree ("merchant_id","card_number");--> statement-breakpoint
CREATE UNIQUE INDEX "gift_cards_ecard_code_idx" ON "gift_cards" USING btree ("ecard_code");--> statement-breakpoint
CREATE INDEX "gift_cards_status_idx" ON "gift_cards" USING btree ("status");--> statement-breakpoint
CREATE INDEX "gift_cards_customer_id_idx" ON "gift_cards" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "held_orders_merchant_id_idx" ON "held_orders" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "held_orders_status_idx" ON "held_orders" USING btree ("merchant_id","status");--> statement-breakpoint
CREATE INDEX "held_orders_merchant_open_idx" ON "held_orders" USING btree ("merchant_id","closed_at");--> statement-breakpoint
CREATE INDEX "hq_catalog_versions_merchant_idx" ON "hq_catalog_versions" USING btree ("merchant_id","created_at");--> statement-breakpoint
CREATE INDEX "hq_menus_merchant_idx" ON "hq_menus" USING btree ("merchant_id","sort_order");--> statement-breakpoint
CREATE INDEX "inventory_categories_merchant_idx" ON "inventory_categories" USING btree ("merchant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_categories_merchant_name_uidx" ON "inventory_categories" USING btree ("merchant_id","name");--> statement-breakpoint
CREATE INDEX "inventory_categories_demo_idx" ON "inventory_categories" USING btree ("merchant_id","is_demo");--> statement-breakpoint
CREATE INDEX "inventory_items_merchant_idx" ON "inventory_items" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "inventory_items_supplier_idx" ON "inventory_items" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "inventory_items_category_idx" ON "inventory_items" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "inventory_items_merchant_name_idx" ON "inventory_items" USING btree ("merchant_id","name");--> statement-breakpoint
CREATE INDEX "inventory_items_merchant_barcode_idx" ON "inventory_items" USING btree ("merchant_id","barcode");--> statement-breakpoint
CREATE INDEX "inventory_items_demo_idx" ON "inventory_items" USING btree ("merchant_id","is_demo");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_location_stock_loc_item_idx" ON "inventory_location_stock" USING btree ("location_id","item_id");--> statement-breakpoint
CREATE INDEX "inventory_location_stock_merchant_idx" ON "inventory_location_stock" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "inventory_movements_merchant_idx" ON "inventory_movements" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "inventory_movements_item_idx" ON "inventory_movements" USING btree ("item_id","created_at");--> statement-breakpoint
CREATE INDEX "inventory_movements_order_idx" ON "inventory_movements" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "inventory_movements_type_idx" ON "inventory_movements" USING btree ("merchant_id","type");--> statement-breakpoint
CREATE INDEX "inventory_stock_lots_merchant_idx" ON "inventory_stock_lots" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "inventory_stock_lots_item_idx" ON "inventory_stock_lots" USING btree ("item_id","expiry_date");--> statement-breakpoint
CREATE INDEX "inventory_stock_lots_expiry_idx" ON "inventory_stock_lots" USING btree ("merchant_id","expiry_date");--> statement-breakpoint
CREATE INDEX "inventory_suppliers_merchant_idx" ON "inventory_suppliers" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "inventory_suppliers_merchant_name_idx" ON "inventory_suppliers" USING btree ("merchant_id","name");--> statement-breakpoint
CREATE INDEX "inventory_suppliers_demo_idx" ON "inventory_suppliers" USING btree ("merchant_id","is_demo");--> statement-breakpoint
CREATE INDEX "inventory_transfers_merchant_idx" ON "inventory_transfers" USING btree ("merchant_id","created_at");--> statement-breakpoint
CREATE INDEX "inventory_transfers_status_idx" ON "inventory_transfers" USING btree ("merchant_id","status");--> statement-breakpoint
CREATE INDEX "inventory_unit_ratios_merchant_idx" ON "inventory_unit_ratios" USING btree ("merchant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_unit_ratios_pair_uidx" ON "inventory_unit_ratios" USING btree ("merchant_id","from_code","to_code");--> statement-breakpoint
CREATE INDEX "inventory_unit_ratios_demo_idx" ON "inventory_unit_ratios" USING btree ("merchant_id","is_demo");--> statement-breakpoint
CREATE INDEX "inventory_units_merchant_idx" ON "inventory_units" USING btree ("merchant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_units_merchant_code_uidx" ON "inventory_units" USING btree ("merchant_id","code");--> statement-breakpoint
CREATE INDEX "inventory_units_demo_idx" ON "inventory_units" USING btree ("merchant_id","is_demo");--> statement-breakpoint
CREATE INDEX "kds_stations_merchant_id_idx" ON "kds_stations" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "kds_stations_token_idx" ON "kds_stations" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "kds_stations_short_code_uidx" ON "kds_stations" USING btree ("short_code");--> statement-breakpoint
CREATE INDEX "kds_ticket_items_ticket_id_idx" ON "kds_ticket_items" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "kds_ticket_items_line_id_idx" ON "kds_ticket_items" USING btree ("ticket_id","line_id");--> statement-breakpoint
CREATE INDEX "kds_tickets_merchant_id_idx" ON "kds_tickets" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "kds_tickets_merchant_ticket_key_idx" ON "kds_tickets" USING btree ("merchant_id","ticket_key");--> statement-breakpoint
CREATE INDEX "license_transactions_merchant_id_idx" ON "license_transactions" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "license_transactions_payment_status_idx" ON "license_transactions" USING btree ("payment_status");--> statement-breakpoint
CREATE INDEX "licenses_merchant_id_idx" ON "licenses" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "licenses_device_id_idx" ON "licenses" USING btree ("device_id");--> statement-breakpoint
CREATE UNIQUE INDEX "licenses_license_key_idx" ON "licenses" USING btree ("license_key");--> statement-breakpoint
CREATE INDEX "licenses_status_idx" ON "licenses" USING btree ("status");--> statement-breakpoint
CREATE INDEX "licenses_expires_at_idx" ON "licenses" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "licenses_issued_by_reseller_idx" ON "licenses" USING btree ("issued_by_reseller_id");--> statement-breakpoint
CREATE UNIQUE INDEX "location_catalog_links_loc_hq_product_idx" ON "location_catalog_links" USING btree ("location_id","hq_product_id");--> statement-breakpoint
CREATE INDEX "location_catalog_links_merchant_location_idx" ON "location_catalog_links" USING btree ("merchant_id","location_id");--> statement-breakpoint
CREATE UNIQUE INDEX "location_product_overrides_loc_product_idx" ON "location_product_overrides" USING btree ("location_id","product_id");--> statement-breakpoint
CREATE INDEX "locations_merchant_id_idx" ON "locations" USING btree ("merchant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "locations_merchant_slug_idx" ON "locations" USING btree ("merchant_id","slug");--> statement-breakpoint
CREATE INDEX "locations_merchant_default_idx" ON "locations" USING btree ("merchant_id","is_default");--> statement-breakpoint
CREATE INDEX "loyalty_cards_merchant_id_idx" ON "loyalty_cards" USING btree ("merchant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "loyalty_cards_card_number_idx" ON "loyalty_cards" USING btree ("card_number");--> statement-breakpoint
CREATE INDEX "loyalty_cards_status_idx" ON "loyalty_cards" USING btree ("status");--> statement-breakpoint
CREATE INDEX "loyalty_point_events_customer_idx" ON "loyalty_point_events" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "loyalty_point_events_merchant_idx" ON "loyalty_point_events" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "loyalty_point_lots_customer_idx" ON "loyalty_point_lots" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "loyalty_point_lots_merchant_idx" ON "loyalty_point_lots" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "loyalty_point_lots_expires_idx" ON "loyalty_point_lots" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "loyalty_transactions_merchant_id_idx" ON "loyalty_transactions" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "loyalty_transactions_card_id_idx" ON "loyalty_transactions" USING btree ("card_id");--> statement-breakpoint
CREATE INDEX "marketing_email_log_merchant_idx" ON "marketing_email_log" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "marketing_email_log_email_idx" ON "marketing_email_log" USING btree ("merchant_id","email");--> statement-breakpoint
CREATE INDEX "marketing_email_log_type_idx" ON "marketing_email_log" USING btree ("merchant_id","type");--> statement-breakpoint
CREATE INDEX "merchant_addon_subscriptions_merchant_idx" ON "merchant_addon_subscriptions" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "merchant_addon_subscriptions_addon_idx" ON "merchant_addon_subscriptions" USING btree ("addon_id");--> statement-breakpoint
CREATE INDEX "merchant_addon_subscriptions_status_idx" ON "merchant_addon_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_roles_merchant_name_idx" ON "merchant_roles" USING btree ("merchant_id","name");--> statement-breakpoint
CREATE INDEX "merchant_roles_merchant_id_idx" ON "merchant_roles" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "merchant_staff_merchant_id_idx" ON "merchant_staff" USING btree ("merchant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_staff_merchant_email_idx" ON "merchant_staff" USING btree ("merchant_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_staff_merchant_phone_idx" ON "merchant_staff" USING btree ("merchant_id","phone");--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_staff_locations_staff_location_idx" ON "merchant_staff_locations" USING btree ("staff_id","location_id");--> statement-breakpoint
CREATE INDEX "merchant_staff_locations_merchant_staff_idx" ON "merchant_staff_locations" USING btree ("merchant_id","staff_id");--> statement-breakpoint
CREATE UNIQUE INDEX "merchants_email_idx" ON "merchants" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "merchants_support_code_idx" ON "merchants" USING btree ("support_code");--> statement-breakpoint
CREATE INDEX "merchants_status_idx" ON "merchants" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "merchants_slug_idx" ON "merchants" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "merchants_subdomain_idx" ON "merchants" USING btree ("subdomain");--> statement-breakpoint
CREATE UNIQUE INDEX "merchants_custom_domain_idx" ON "merchants" USING btree ("custom_domain");--> statement-breakpoint
CREATE UNIQUE INDEX "merchants_sync_api_key_idx" ON "merchants" USING btree ("sync_api_key");--> statement-breakpoint
CREATE INDEX "merchants_invite_token_hash_idx" ON "merchants" USING btree ("invite_token_hash");--> statement-breakpoint
CREATE INDEX "merchants_reseller_idx" ON "merchants" USING btree ("reseller_id");--> statement-breakpoint
CREATE INDEX "merchants_edition_idx" ON "merchants" USING btree ("edition_id");--> statement-breakpoint
CREATE INDEX "modifier_groups_merchant_id_idx" ON "modifier_groups" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "modifier_options_group_id_idx" ON "modifier_options" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "modifier_options_inventory_item_idx" ON "modifier_options" USING btree ("inventory_item_id");--> statement-breakpoint
CREATE INDEX "newsletter_campaigns_merchant_idx" ON "newsletter_campaigns" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "newsletter_campaigns_status_idx" ON "newsletter_campaigns" USING btree ("merchant_id","status");--> statement-breakpoint
CREATE INDEX "ods_dismissed_merchant_id_idx" ON "ods_dismissed_orders" USING btree ("merchant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ods_dismissed_merchant_order_uidx" ON "ods_dismissed_orders" USING btree ("merchant_id","order_number");--> statement-breakpoint
CREATE INDEX "ods_displays_merchant_id_idx" ON "ods_displays" USING btree ("merchant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ods_displays_token_uidx" ON "ods_displays" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "ods_displays_short_code_uidx" ON "ods_displays" USING btree ("short_code");--> statement-breakpoint
CREATE INDEX "ods_orders_merchant_id_idx" ON "ods_orders" USING btree ("merchant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ods_orders_merchant_order_uidx" ON "ods_orders" USING btree ("merchant_id","order_number");--> statement-breakpoint
CREATE INDEX "offers_merchant_id_idx" ON "offers" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "offers_merchant_active_idx" ON "offers" USING btree ("merchant_id","is_active");--> statement-breakpoint
CREATE INDEX "order_items_order_id_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_refunds_merchant_id_idx" ON "order_refunds" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "order_refunds_order_id_idx" ON "order_refunds" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_refunds_created_at_idx" ON "order_refunds" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "orders_merchant_id_idx" ON "orders" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "orders_location_id_idx" ON "orders" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "orders_station_id_idx" ON "orders" USING btree ("station_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_order_number_idx" ON "orders" USING btree ("order_number");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orders_created_at_idx" ON "orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "orders_client_id_idx" ON "orders" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "orders_table_id_idx" ON "orders" USING btree ("table_id");--> statement-breakpoint
CREATE INDEX "orders_table_session_id_idx" ON "orders" USING btree ("table_session_id");--> statement-breakpoint
CREATE INDEX "orders_master_order_id_idx" ON "orders" USING btree ("master_order_id");--> statement-breakpoint
CREATE INDEX "orders_merchant_order_source_idx" ON "orders" USING btree ("merchant_id","order_source");--> statement-breakpoint
CREATE INDEX "orders_merchant_external_order_idx" ON "orders" USING btree ("merchant_id","order_source","external_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_idx" ON "password_reset_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_email_idx" ON "password_reset_tokens" USING btree ("email");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_expires_idx" ON "password_reset_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "payment_profiles_merchant_id_idx" ON "payment_profiles" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "payment_profiles_merchant_default_idx" ON "payment_profiles" USING btree ("merchant_id","is_default");--> statement-breakpoint
CREATE INDEX "payment_terminals_merchant_id_idx" ON "payment_terminals" USING btree ("merchant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_terminals_terminal_id_idx" ON "payment_terminals" USING btree ("terminal_id");--> statement-breakpoint
CREATE INDEX "payment_transactions_merchant_id_idx" ON "payment_transactions" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "payment_transactions_order_id_idx" ON "payment_transactions" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "payment_transactions_status_idx" ON "payment_transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "platform_event_logs_level_idx" ON "platform_event_logs" USING btree ("level");--> statement-breakpoint
CREATE INDEX "platform_event_logs_category_idx" ON "platform_event_logs" USING btree ("category");--> statement-breakpoint
CREATE INDEX "platform_event_logs_created_idx" ON "platform_event_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_message_dismissals_unique" ON "platform_message_dismissals" USING btree ("message_id","viewer_role","viewer_id");--> statement-breakpoint
CREATE INDEX "platform_message_dismissals_viewer_idx" ON "platform_message_dismissals" USING btree ("viewer_role","viewer_id");--> statement-breakpoint
CREATE INDEX "platform_messages_kind_idx" ON "platform_messages" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "platform_messages_audience_idx" ON "platform_messages" USING btree ("audience");--> statement-breakpoint
CREATE INDEX "platform_messages_active_idx" ON "platform_messages" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "platform_messages_created_idx" ON "platform_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "platform_shop_orders_merchant_idx" ON "platform_shop_orders" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "platform_shop_orders_status_idx" ON "platform_shop_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "platform_shop_orders_created_idx" ON "platform_shop_orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "platform_shop_products_active_idx" ON "platform_shop_products" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "platform_shop_products_sort_idx" ON "platform_shop_products" USING btree ("sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_shop_vouchers_code_idx" ON "platform_shop_vouchers" USING btree ("code");--> statement-breakpoint
CREATE INDEX "platform_shop_vouchers_active_idx" ON "platform_shop_vouchers" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "pos_cash_movements_merchant_idx" ON "pos_cash_movements" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "pos_cash_movements_shift_idx" ON "pos_cash_movements" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "pos_cash_movements_created_idx" ON "pos_cash_movements" USING btree ("merchant_id","created_at");--> statement-breakpoint
CREATE INDEX "pos_sessions_merchant_id_idx" ON "pos_sessions" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "pos_sessions_merchant_device_idx" ON "pos_sessions" USING btree ("merchant_id","device_id","session_kind");--> statement-breakpoint
CREATE INDEX "pos_sessions_active_idx" ON "pos_sessions" USING btree ("merchant_id","session_kind","last_heartbeat");--> statement-breakpoint
CREATE INDEX "pos_shifts_merchant_idx" ON "pos_shifts" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "pos_shifts_status_idx" ON "pos_shifts" USING btree ("merchant_id","status");--> statement-breakpoint
CREATE INDEX "pos_shifts_opened_idx" ON "pos_shifts" USING btree ("merchant_id","opened_at");--> statement-breakpoint
CREATE INDEX "pos_stations_merchant_id_idx" ON "pos_stations" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "pos_stations_location_id_idx" ON "pos_stations" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "pos_stations_location_sort_idx" ON "pos_stations" USING btree ("location_id","sort_order");--> statement-breakpoint
CREATE INDEX "pricing_bulk_jobs_merchant_idx" ON "pricing_bulk_jobs" USING btree ("merchant_id","created_at");--> statement-breakpoint
CREATE INDEX "product_modifier_groups_product_id_idx" ON "product_modifier_groups" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_modifier_groups_group_id_idx" ON "product_modifier_groups" USING btree ("group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_modifier_groups_unique" ON "product_modifier_groups" USING btree ("product_id","group_id");--> statement-breakpoint
CREATE INDEX "product_recipes_merchant_idx" ON "product_recipes" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "product_recipes_product_idx" ON "product_recipes" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_recipes_item_idx" ON "product_recipes" USING btree ("item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_recipes_product_item_uidx" ON "product_recipes" USING btree ("product_id","item_id");--> statement-breakpoint
CREATE INDEX "product_recipes_demo_idx" ON "product_recipes" USING btree ("merchant_id","is_demo");--> statement-breakpoint
CREATE INDEX "products_merchant_id_idx" ON "products" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "products_merchant_location_idx" ON "products" USING btree ("merchant_id","location_id");--> statement-breakpoint
CREATE INDEX "products_barcode_idx" ON "products" USING btree ("barcode");--> statement-breakpoint
CREATE UNIQUE INDEX "products_merchant_barcode_uidx" ON "products" USING btree ("merchant_id","barcode") WHERE "products"."barcode" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "products_client_id_idx" ON "products" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "products_type_idx" ON "products" USING btree ("product_type");--> statement-breakpoint
CREATE INDEX "products_sort_order_idx" ON "products" USING btree ("merchant_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "published_pull_requests_number_idx" ON "published_pull_requests" USING btree ("number");--> statement-breakpoint
CREATE INDEX "published_pull_requests_merged_idx" ON "published_pull_requests" USING btree ("merged_at");--> statement-breakpoint
CREATE UNIQUE INDEX "resellers_email_idx" ON "resellers" USING btree ("email");--> statement-breakpoint
CREATE INDEX "resellers_status_idx" ON "resellers" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "reservation_growth_campaigns_merchant_code_uq" ON "reservation_growth_campaigns" USING btree ("merchant_id","code");--> statement-breakpoint
CREATE INDEX "reservation_growth_campaigns_merchant_idx" ON "reservation_growth_campaigns" USING btree ("merchant_id","active");--> statement-breakpoint
CREATE INDEX "reservations_merchant_reserved_idx" ON "reservations" USING btree ("merchant_id","reserved_at");--> statement-breakpoint
CREATE INDEX "reservations_merchant_status_idx" ON "reservations" USING btree ("merchant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "reservations_merchant_code_uq" ON "reservations" USING btree ("merchant_id","code");--> statement-breakpoint
CREATE INDEX "rfid_readers_merchant_id_idx" ON "rfid_readers" USING btree ("merchant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rfid_readers_reader_uid_idx" ON "rfid_readers" USING btree ("reader_uid");--> statement-breakpoint
CREATE INDEX "signage_playlists_merchant_id_idx" ON "signage_playlists" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "signage_screens_merchant_id_idx" ON "signage_screens" USING btree ("merchant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "signage_screens_token_uidx" ON "signage_screens" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "signage_screens_short_code_uidx" ON "signage_screens" USING btree ("short_code");--> statement-breakpoint
CREATE INDEX "signage_slides_playlist_id_idx" ON "signage_slides" USING btree ("playlist_id");--> statement-breakpoint
CREATE INDEX "sms_campaigns_merchant_idx" ON "sms_campaigns" USING btree ("merchant_id","created_at");--> statement-breakpoint
CREATE INDEX "sms_messages_merchant_idx" ON "sms_messages" USING btree ("merchant_id","created_at");--> statement-breakpoint
CREATE INDEX "sms_messages_to_idx" ON "sms_messages" USING btree ("merchant_id","to_e164");--> statement-breakpoint
CREATE INDEX "sms_messages_type_idx" ON "sms_messages" USING btree ("merchant_id","type");--> statement-breakpoint
CREATE INDEX "sms_otps_lookup_idx" ON "sms_otps" USING btree ("merchant_id","phone_e164","purpose");--> statement-breakpoint
CREATE INDEX "sms_otps_created_idx" ON "sms_otps" USING btree ("merchant_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sms_usage_merchant_period_uq" ON "sms_usage" USING btree ("merchant_id","period_ym");--> statement-breakpoint
CREATE INDEX "software_releases_published_idx" ON "software_releases" USING btree ("is_published","published_at");--> statement-breakpoint
CREATE INDEX "software_releases_version_idx" ON "software_releases" USING btree ("version");--> statement-breakpoint
CREATE INDEX "subscription_addon_payments_merchant_id_idx" ON "subscription_addon_payments" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "subscription_addon_payments_addon_id_idx" ON "subscription_addon_payments" USING btree ("addon_id");--> statement-breakpoint
CREATE INDEX "subscription_addon_payments_status_idx" ON "subscription_addon_payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "subscription_addon_payments_session_idx" ON "subscription_addon_payments" USING btree ("adyen_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_addons_slug_owner_idx" ON "subscription_addons" USING btree ("slug","owner_type","owner_id");--> statement-breakpoint
CREATE INDEX "subscription_addons_active_idx" ON "subscription_addons" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "subscription_addons_owner_idx" ON "subscription_addons" USING btree ("owner_type","owner_id");--> statement-breakpoint
CREATE INDEX "subscription_payments_merchant_id_idx" ON "subscription_payments" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "subscription_payments_plan_id_idx" ON "subscription_payments" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "subscription_payments_status_idx" ON "subscription_payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "subscription_payments_session_idx" ON "subscription_payments" USING btree ("adyen_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_plans_slug_idx" ON "subscription_plans" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "subscription_plans_active_idx" ON "subscription_plans" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "subscription_plans_owner_idx" ON "subscription_plans" USING btree ("owner_type","owner_id");--> statement-breakpoint
CREATE INDEX "subscription_plans_edition_idx" ON "subscription_plans" USING btree ("edition_id");--> statement-breakpoint
CREATE UNIQUE INDEX "superadmins_email_idx" ON "superadmins" USING btree ("email");--> statement-breakpoint
CREATE INDEX "support_ticket_messages_ticket_idx" ON "support_ticket_messages" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "support_ticket_messages_created_idx" ON "support_ticket_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "support_tickets_merchant_idx" ON "support_tickets" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "support_tickets_reseller_idx" ON "support_tickets" USING btree ("reseller_id");--> statement-breakpoint
CREATE INDEX "support_tickets_status_idx" ON "support_tickets" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "support_tickets_number_idx" ON "support_tickets" USING btree ("ticket_number");--> statement-breakpoint
CREATE INDEX "support_tickets_created_idx" ON "support_tickets" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "table_qr_codes_merchant_id_idx" ON "table_qr_codes" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "table_qr_codes_table_id_idx" ON "table_qr_codes" USING btree ("table_id");--> statement-breakpoint
CREATE INDEX "table_sessions_merchant_id_idx" ON "table_sessions" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "table_sessions_table_id_idx" ON "table_sessions" USING btree ("table_id");--> statement-breakpoint
CREATE UNIQUE INDEX "table_sessions_token_uidx" ON "table_sessions" USING btree ("session_token");--> statement-breakpoint
CREATE INDEX "table_sessions_merchant_table_status_idx" ON "table_sessions" USING btree ("merchant_id","table_id","status");--> statement-breakpoint
CREATE INDEX "vat_settings_merchant_id_idx" ON "vat_settings" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "voucher_redemptions_merchant_id_idx" ON "voucher_redemptions" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "voucher_redemptions_voucher_id_idx" ON "voucher_redemptions" USING btree ("voucher_id");--> statement-breakpoint
CREATE INDEX "voucher_redemptions_order_id_idx" ON "voucher_redemptions" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "voucher_redemptions_customer_id_idx" ON "voucher_redemptions" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vouchers_merchant_code_idx" ON "vouchers" USING btree ("merchant_id","code");--> statement-breakpoint
CREATE INDEX "vouchers_merchant_id_idx" ON "vouchers" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "vouchers_merchant_active_idx" ON "vouchers" USING btree ("merchant_id","is_active");--> statement-breakpoint
CREATE INDEX "vouchers_customer_id_idx" ON "vouchers" USING btree ("customer_id");