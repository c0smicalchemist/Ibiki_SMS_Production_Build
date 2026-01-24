-- Add worker_url to anveo_numbers table for static worker assignment
ALTER TABLE anveo_numbers 
ADD COLUMN IF NOT EXISTS worker_url VARCHAR(255);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_anveo_numbers_worker ON anveo_numbers(worker_url);

-- Insert the new number with worker assignment
INSERT INTO anveo_numbers (
  phone_number, 
  vendor_account_id, 
  status, 
  daily_limit, 
  warming_day,
  worker_url,
  sent_today,
  complaints,
  error_count_today,
  success_count_today
) VALUES (
  '+17204398855',
  1,
  'warming',
  100,
  1,
  'https://sms-proxy-1.c0smicalch3mist.workers.dev/webhook',
  0,
  0,
  0,
  0
) ON CONFLICT (phone_number) DO UPDATE SET
  worker_url = 'https://sms-proxy-1.c0smicalch3mist.workers.dev/webhook',
  status = 'warming',
  daily_limit = 100,
  warming_day = 1;

-- Comment for reference
COMMENT ON COLUMN anveo_numbers.worker_url IS 'Cloudflare Worker webhook URL this number is permanently assigned to';
