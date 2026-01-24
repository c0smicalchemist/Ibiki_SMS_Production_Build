-- Fix old messages stuck in "Sending" status
-- This updates Anveo messages from 'Sending' to 'SENT' based on vendor

UPDATE message_logs 
SET status = 'SENT' 
WHERE vendor = 'anveo' 
  AND LOWER(status) = 'sending'
  AND created_at < NOW();

-- Show affected rows
SELECT 
  COUNT(*) as updated_count,
  vendor,
  status
FROM message_logs 
WHERE vendor = 'anveo' 
  AND status = 'SENT'
GROUP BY vendor, status;
