-- Sales adjustment audit log (idempotent).
--
--   psql "$DATABASE_URL" -f backend/sql/ensure-sales-adjustment.sql

CREATE TABLE IF NOT EXISTS sales_adjustment_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  month_key varchar(7) NOT NULL,
  target_percent numeric(5, 2) NOT NULL,
  before_cash_total numeric(12, 2) NOT NULL,
  after_cash_total numeric(12, 2) NOT NULL,
  orders_adjusted integer NOT NULL DEFAULT 0,
  items_adjusted integer NOT NULL DEFAULT 0,
  details jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sales_adjustment_runs_merchant_idx
  ON sales_adjustment_runs (merchant_id, created_at DESC);
