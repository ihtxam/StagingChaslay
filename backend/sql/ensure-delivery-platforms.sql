-- Just Eat / Uber Eats delivery platform credentials + order source tracking (idempotent).
--
--   psql "$DATABASE_URL" -f backend/sql/ensure-delivery-platforms.sql

ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS delivery_platform_settings jsonb;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS order_source varchar(50);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS external_order_id varchar(255);

CREATE INDEX IF NOT EXISTS orders_merchant_order_source_idx
  ON orders (merchant_id, order_source);

CREATE UNIQUE INDEX IF NOT EXISTS orders_merchant_external_order_uidx
  ON orders (merchant_id, order_source, external_order_id)
  WHERE external_order_id IS NOT NULL AND order_source IS NOT NULL;
