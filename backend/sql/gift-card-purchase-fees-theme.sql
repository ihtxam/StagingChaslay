-- Online gift card purchase fees + theme (run once on existing DBs)
ALTER TABLE gift_card_purchases ADD COLUMN IF NOT EXISTS card_theme varchar(32) DEFAULT 'classic';
ALTER TABLE gift_card_purchases ADD COLUMN IF NOT EXISTS shipping_fee decimal(10,2) DEFAULT 0;
ALTER TABLE gift_card_purchases ADD COLUMN IF NOT EXISTS service_fee decimal(10,2) DEFAULT 0;
ALTER TABLE gift_card_purchases ADD COLUMN IF NOT EXISTS payment_fee decimal(10,2) DEFAULT 0;
ALTER TABLE gift_card_purchases ADD COLUMN IF NOT EXISTS total_charged decimal(10,2);
