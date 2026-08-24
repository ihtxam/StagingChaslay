-- ODS cleanup for ghost numbers on the customer pickup display.
-- Replace :merchant_id with your merchant UUID before running.

-- 1) Clear shadow kitchen tickets
DELETE FROM ods_orders
WHERE merchant_id = :merchant_id;

-- 2) Hide all numbers currently eligible for the live board (Settings → Clear pickup board does this in app)
INSERT INTO ods_dismissed_orders (merchant_id, order_number, dismissed_at)
SELECT :merchant_id, o.order_number, NOW()
FROM orders o
WHERE o.merchant_id = :merchant_id
  AND o.status IN ('accepted', 'preparing', 'sent_to_kitchen', 'ready')
ON CONFLICT (merchant_id, order_number) DO UPDATE SET dismissed_at = NOW();

-- 3) Inspect live orders still in Order Center (not deleted — only hidden from ODS)
SELECT order_number, status, created_at, notes
FROM orders
WHERE merchant_id = :merchant_id
  AND status IN ('accepted', 'preparing', 'sent_to_kitchen', 'ready')
ORDER BY created_at DESC;

-- 4) Optional: mark very old open online orders completed (review rows first!)
-- UPDATE orders
-- SET status = 'completed', completed_at = NOW(), updated_at = NOW()
-- WHERE merchant_id = :merchant_id
--   AND status IN ('accepted', 'preparing', 'sent_to_kitchen')
--   AND created_at < NOW() - INTERVAL '7 days';
