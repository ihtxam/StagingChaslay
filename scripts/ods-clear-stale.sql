-- One-time ODS cleanup for a merchant with dozens of stale "being prepared" entries.
-- Replace :merchant_id with your merchant UUID before running.

-- 1) Shadow board (WebPOS kitchen pushes) — usually the main source of ghost numbers
DELETE FROM ods_orders
WHERE merchant_id = :merchant_id;

-- 2) Optional: inspect live orders still feeding the board (not deleted by clear-all)
SELECT order_number, status, created_at, notes
FROM orders
WHERE merchant_id = :merchant_id
  AND status IN ('accepted', 'preparing', 'sent_to_kitchen', 'ready')
ORDER BY created_at DESC;

-- 3) Optional: mark very old open online orders completed (review rows first!)
-- UPDATE orders
-- SET status = 'completed', completed_at = NOW(), updated_at = NOW()
-- WHERE merchant_id = :merchant_id
--   AND status IN ('accepted', 'preparing', 'sent_to_kitchen')
--   AND created_at < NOW() - INTERVAL '7 days';
