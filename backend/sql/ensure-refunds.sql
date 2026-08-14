-- Refund + payment breakdown + goodwill (idempotent).
--
--   psql "$DATABASE_URL" -f backend/sql/ensure-refunds.sql

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS refund_reason text;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS goodwill_amount numeric(10, 2) NOT NULL DEFAULT 0;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_breakdown jsonb;

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS refunded_quantity numeric(12, 3) NOT NULL DEFAULT 0;

ALTER TABLE floor_plans
  ADD COLUMN IF NOT EXISTS elements_json jsonb;
