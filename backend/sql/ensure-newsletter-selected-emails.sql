-- Selected recipient emails for newsletter campaigns (idempotent).
--
--   psql "$DATABASE_URL" -f backend/sql/ensure-newsletter-selected-emails.sql

ALTER TABLE newsletter_campaigns
  ADD COLUMN IF NOT EXISTS selected_emails jsonb;
