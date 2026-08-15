-- Order Center: per-order ETA, print count, min pre-order delay
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS min_pre_order_delay_minutes INTEGER DEFAULT 30;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS estimated_ready_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS print_count INTEGER DEFAULT 0;
