-- Add 3 existing Anveo numbers to the pool
-- Anveo NY #1, NY #2, and FL #3
-- All using same API key (****5c55)

INSERT INTO anveo_numbers (
  phone_number,
  vendor_account_id,
  status,
  daily_limit,
  sent_today,
  worker_url,
  created_at
) VALUES
  -- Anveo NY #1
  ('+19144080890', 1, 'warming', 100, 0, 'https://sms-proxy-1.c0smicalch3mist.workers.dev/webhook', NOW()),
  -- Anveo NY #2
  ('+19144080870', 1, 'warming', 100, 0, 'https://sms-proxy-1.c0smicalch3mist.workers.dev/webhook', NOW()),
  -- Anveo FL #3
  ('+19046409006', 1, 'warming', 100, 0, 'https://sms-proxy-1.c0smicalch3mist.workers.dev/webhook', NOW());

-- Verify all 4 numbers in pool
SELECT 
  phone_number,
  status,
  daily_limit,
  sent_today,
  CASE 
    WHEN phone_number = '+17204398855' THEN 'CO (Test Number - Active)'
    WHEN phone_number = '+19144080890' THEN 'NY #1 (Warming)'
    WHEN phone_number = '+19144080870' THEN 'NY #2 (Warming)'
    WHEN phone_number = '+19046409006' THEN 'FL #3 (Warming)'
  END as location
FROM anveo_numbers
ORDER BY phone_number;

-- Show total capacity
SELECT 
  COUNT(*) as total_numbers,
  SUM(daily_limit) as total_daily_capacity,
  SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_count,
  SUM(CASE WHEN status = 'warming' THEN 1 ELSE 0 END) as warming_count
FROM anveo_numbers;
