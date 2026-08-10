-- Per-merchant Brevo API settings (idempotent).
--
--   psql "$DATABASE_URL" -f backend/sql/ensure-merchant-brevo-settings.sql

ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS email_brevo_settings jsonb;
