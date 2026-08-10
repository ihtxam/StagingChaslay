-- Link completed POS sales to merchant_staff for own-sales EOD / reports.
-- Idempotent. Deploy normally runs drizzle-kit push; run manually if needed:
--
--   psql "$DATABASE_URL" -f backend/sql/ensure-orders-staff-id.sql

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS staff_id uuid REFERENCES merchant_staff(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS orders_merchant_staff_id_idx
  ON orders (merchant_id, staff_id);
