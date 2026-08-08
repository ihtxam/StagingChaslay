-- Idempotent: reseller license seat pool + billing support
-- Run: psql "$DATABASE_URL" -f backend/sql/ensure-reseller-licenses-billing.sql

-- Seat pool granted by Superadmin to each reseller
ALTER TABLE resellers
  ADD COLUMN IF NOT EXISTS license_seats INTEGER NOT NULL DEFAULT 0;

-- Track which reseller issued a device license (counts against their pool)
ALTER TABLE licenses
  ADD COLUMN IF NOT EXISTS issued_by_reseller_id UUID REFERENCES resellers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS licenses_issued_by_reseller_idx
  ON licenses (issued_by_reseller_id);

-- Platform reseller billing price list (CHF monthly) stored as JSON in platform_settings
INSERT INTO platform_settings (key, value, updated_at)
VALUES (
  'reseller_billing_prices',
  '{
    "currency": "CHF",
    "basePosMonthly": 49,
    "featurePrices": {
      "online_shop": 19,
      "loyalty": 15,
      "gift_cards": 15,
      "terminals": 25,
      "website_cms": 19,
      "online_payments": 10,
      "offers": 10,
      "reservations": 10
    }
  }',
  NOW()
)
ON CONFLICT (key) DO NOTHING;
