-- Manual cash in/out during POS shifts (petty cash, bank drops, etc.)
CREATE TABLE IF NOT EXISTS pos_cash_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  shift_id UUID NOT NULL REFERENCES pos_shifts(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES merchant_staff(id) ON DELETE SET NULL,
  staff_name VARCHAR(255),
  type VARCHAR(10) NOT NULL CHECK (type IN ('in', 'out')),
  amount DECIMAL(12, 2) NOT NULL CHECK (amount >= 0),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pos_cash_movements_merchant_idx ON pos_cash_movements(merchant_id);
CREATE INDEX IF NOT EXISTS pos_cash_movements_shift_idx ON pos_cash_movements(shift_id);
CREATE INDEX IF NOT EXISTS pos_cash_movements_created_idx ON pos_cash_movements(merchant_id, created_at);
