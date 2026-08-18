-- Payment by Invoice: merchant bank details, sequence, order invoice fields
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS webpos_invoice_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS bank_iban varchar(34);
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS bank_qr_iban varchar(34);
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS bank_name varchar(255);
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS bank_account_holder varchar(255);
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS invoice_sequence integer NOT NULL DEFAULT 0;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_number varchar(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_issued_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_due_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS orders_merchant_invoice_number_idx
  ON orders (merchant_id, invoice_number)
  WHERE invoice_number IS NOT NULL;
