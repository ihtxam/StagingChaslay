-- Unlayer design JSON for newsletter campaigns (idempotent).
--
--   psql "$DATABASE_URL" -f backend/sql/ensure-newsletter-design-json.sql

ALTER TABLE newsletter_campaigns
  ADD COLUMN IF NOT EXISTS design_json jsonb;
