-- Refund reasons + per-item refunded quantities (idempotent).
--
--   psql "$DATABASE_URL" -f backend/sql/ensure-refunds.sql
--
-- Or via docker (see DEPLOY.md):
--   docker compose --env-file .env.production exec -T db \
--     psql -U "${POSTGRES_USER:-manupos}" -d "${POSTGRES_DB:-manupos}" \
--     < backend/sql/ensure-refunds.sql

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS refund_reason text;

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS refunded_quantity numeric(12, 3) NOT NULL DEFAULT 0;
