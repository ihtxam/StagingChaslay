-- Adyen terminal POI receipts, refund linkage, subscription recurring tokens (idempotent).
--
--   psql "$DATABASE_URL" -f backend/sql/ensure-adyen-features.sql

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS adyen_poi_transaction_ts timestamptz,
  ADD COLUMN IF NOT EXISTS adyen_customer_receipt_json text,
  ADD COLUMN IF NOT EXISTS adyen_cashier_receipt_json text;

ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS subscription_billing_cycle varchar(20),
  ADD COLUMN IF NOT EXISTS adyen_recurring_detail_reference varchar(255);

ALTER TABLE subscription_payments
  ADD COLUMN IF NOT EXISTS adyen_recurring_detail_reference varchar(255),
  ADD COLUMN IF NOT EXISTS is_recurring boolean NOT NULL DEFAULT false;

ALTER TABLE payment_transactions
  ADD COLUMN IF NOT EXISTS adyen_poi_transaction_ts timestamptz,
  ADD COLUMN IF NOT EXISTS currency varchar(3) DEFAULT 'CHF';
