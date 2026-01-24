-- ============================================
-- BULK NUMBER ASSIGNMENT SCRIPT
-- Use this when you buy more Anveo numbers
-- ============================================

-- Example: Adding 10 numbers to Worker 1
-- REPLACE these with your actual numbers

INSERT INTO anveo_numbers (phone_number, vendor_account_id, worker_url, status, daily_limit, warming_day)
SELECT 
  phone,
  (SELECT id FROM vendor_accounts WHERE account_identifier = 'anveo_account_1' LIMIT 1),
  'https://sms-proxy-1.c0smicalch3mist.workers.dev/webhook',
  'warming',
  100,
  1
FROM (VALUES
  ('+17204398855'),  -- REPLACE with actual numbers
  ('+1XXXXXXXXXX'),
  ('+1XXXXXXXXXX'),
  ('+1XXXXXXXXXX'),
  ('+1XXXXXXXXXX'),
  ('+1XXXXXXXXXX'),
  ('+1XXXXXXXXXX'),
  ('+1XXXXXXXXXX'),
  ('+1XXXXXXXXXX'),
  ('+1XXXXXXXXXX')
) AS numbers(phone)
ON CONFLICT (phone_number) DO UPDATE SET
  worker_url = EXCLUDED.worker_url,
  vendor_account_id = EXCLUDED.vendor_account_id;

-- ============================================
-- For Worker 2 (when you setup 2nd account)
-- ============================================

-- Uncomment when ready:
-- INSERT INTO anveo_numbers (phone_number, vendor_account_id, worker_url, status, daily_limit, warming_day)
-- SELECT 
--   phone,
--   (SELECT id FROM vendor_accounts WHERE account_identifier = 'anveo_account_2' LIMIT 1),
--   'https://sms-proxy-2.c0smicalch3mist.workers.dev/webhook',
--   'warming',
--   100,
--   1
-- FROM (VALUES
--   ('+1XXXXXXXXXX'),
--   ('+1XXXXXXXXXX')
--   -- ... 10 numbers total
-- ) AS numbers(phone)
-- ON CONFLICT (phone_number) DO UPDATE SET
--   worker_url = EXCLUDED.worker_url,
--   vendor_account_id = EXCLUDED.vendor_account_id;

-- ============================================
-- USEFUL QUERIES
-- ============================================

-- View all numbers with their assignments
SELECT 
  phone_number,
  worker_url,
  status,
  daily_limit,
  sent_today,
  warming_day,
  complaints
FROM anveo_numbers
ORDER BY worker_url, phone_number;

-- View number distribution across workers
SELECT 
  worker_url,
  COUNT(*) as number_count,
  SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_count,
  SUM(CASE WHEN status = 'warming' THEN 1 ELSE 0 END) as warming_count,
  SUM(sent_today) as total_sent_today,
  SUM(daily_limit) as total_capacity
FROM anveo_numbers
GROUP BY worker_url
ORDER BY worker_url;

-- View today's usage
SELECT 
  phone_number,
  sent_today,
  daily_limit,
  ROUND((sent_today::numeric / daily_limit * 100), 2) as usage_percent,
  status
FROM anveo_numbers
WHERE sent_today > 0
ORDER BY sent_today DESC;

-- Find numbers ready to promote from warming
SELECT 
  phone_number,
  warming_day,
  daily_limit,
  status
FROM anveo_numbers
WHERE status = 'warming' AND warming_day >= 21
ORDER BY warming_day DESC;

-- Manually promote a number to active (if needed)
-- UPDATE anveo_numbers 
-- SET status = 'active', daily_limit = 1500
-- WHERE phone_number = '+1XXXXXXXXXX';

-- Manually suspend a number
-- UPDATE anveo_numbers 
-- SET status = 'suspended'
-- WHERE phone_number = '+1XXXXXXXXXX';
