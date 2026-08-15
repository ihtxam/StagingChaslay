-- Voucher / discount code schema for online shop
-- Run: psql "$DATABASE_URL" -f backend/sql/ensure-vouchers.sql

CREATE TABLE IF NOT EXISTS vouchers (
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
);

CREATE UNIQUE INDEX IF NOT EXISTS vouchers_merchant_code_idx ON vouchers(merchant_id, code);
CREATE INDEX IF NOT EXISTS vouchers_merchant_id_idx ON vouchers(merchant_id);
CREATE INDEX IF NOT EXISTS vouchers_merchant_active_idx ON vouchers(merchant_id, is_active);
CREATE INDEX IF NOT EXISTS vouchers_customer_id_idx ON vouchers(customer_id);

CREATE TABLE IF NOT EXISTS voucher_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  voucher_id uuid NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  code varchar(64) NOT NULL,
  discount_amount numeric(10, 2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS voucher_redemptions_merchant_id_idx ON voucher_redemptions(merchant_id);
CREATE INDEX IF NOT EXISTS voucher_redemptions_voucher_id_idx ON voucher_redemptions(voucher_id);
CREATE INDEX IF NOT EXISTS voucher_redemptions_order_id_idx ON voucher_redemptions(order_id);
CREATE INDEX IF NOT EXISTS voucher_redemptions_customer_id_idx ON voucher_redemptions(customer_id);
