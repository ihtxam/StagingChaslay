-- VAT on discounted amount (tax-exclusive pricing only)
ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS vat_after_discount boolean NOT NULL DEFAULT true;
