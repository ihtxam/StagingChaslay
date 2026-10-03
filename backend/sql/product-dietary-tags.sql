ALTER TABLE products ADD COLUMN IF NOT EXISTS dietary_tags json DEFAULT '[]';
