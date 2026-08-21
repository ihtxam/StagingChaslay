-- Idempotent: reseller license seat pool + billing support
-- Run: psql "$DATABASE_URL" -f backend/sql/ensure-reseller-licenses-billing.sql

CREATE TABLE IF NOT EXISTS devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  device_id varchar(255) NOT NULL UNIQUE,
  device_name varchar(255) NOT NULL,
  device_type varchar(50) NOT NULL,
  os_version varchar(50),
  app_version varchar(50),
  last_sync timestamp,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  license_key varchar(255) NOT NULL UNIQUE,
  license_type varchar(50) NOT NULL,
  trial_days integer DEFAULT 7,
  starts_at timestamp NOT NULL,
  expires_at timestamp NOT NULL,
  renewal_notified_at timestamp,
  status varchar(50) NOT NULL DEFAULT 'active',
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

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
