-- Merchant columns added in code after older DB snapshots (idempotent).
-- Fixes superadmin merchants list + login when drizzle-kit push lags.
--
--   psql "$DATABASE_URL" -f backend/sql/ensure-merchant-columns-drift.sql

ALTER TABLE merchants ADD COLUMN IF NOT EXISTS auth_epoch integer NOT NULL DEFAULT 0;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS custom_domain_pending varchar(255);
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS custom_domain_dns_status varchar(20) DEFAULT 'none';
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS custom_domain_ssl_status varchar(20) DEFAULT 'none';
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS custom_domain_verified_at timestamp;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS shop_site_settings jsonb;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS delivery_mode varchar(20) NOT NULL DEFAULT 'zones';
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS adyen_store_reference varchar(255);
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS customer_display_settings jsonb;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS panel_nav_hidden jsonb;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS shop_commission_percent numeric(6,3);
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS support_code varchar(16);
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS adyen_live_url_prefix varchar(255);
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS gift_card_addon_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS fiskaly_settings jsonb;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS webpos_express_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS webpos_cash_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS webpos_card_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS webpos_terminal_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS adyen_hmac_key text;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS tap_to_pay_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS kiosk_addon_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS kiosk_settings jsonb;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS max_locations integer NOT NULL DEFAULT 1;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS cart_layout varchar(20) NOT NULL DEFAULT 'hidden_slide';
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS plan_billing_paid boolean NOT NULL DEFAULT true;
