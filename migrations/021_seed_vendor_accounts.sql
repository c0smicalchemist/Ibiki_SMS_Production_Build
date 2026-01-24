-- Seed data for 3 Anveo accounts setup
-- Run this after the main migration

-- Insert 3 vendor accounts (you'll need to create 3 separate Anveo accounts)
INSERT INTO vendor_accounts (
  vendor_name,
  account_identifier,
  account_label,
  daily_limit,
  priority,
  status,
  cost_per_sms,
  notes
) VALUES
  -- Account 1: Primary (highest priority)
  (
    'anveo',
    'anveo_account_1',
    'Anveo Primary (LLC Alpha)',
    10000,
    1,
    'active',
    0.01,
    'Primary account - highest priority. Setup via CF Worker 1'
  ),
  
  -- Account 2: Secondary
  (
    'anveo',
    'anveo_account_2',
    'Anveo Secondary (LLC Beta)',
    10000,
    2,
    'active',
    0.01,
    'Secondary account - failover. Setup via CF Worker 2'
  ),
  
  -- Account 3: Tertiary (emergency backup)
  (
    'anveo',
    'anveo_account_3',
    'Anveo Backup (LLC Gamma)',
    10000,
    3,
    'active',
    0.01,
    'Backup account - emergency use. Setup via CF Worker 3'
  )
ON CONFLICT (account_identifier) DO NOTHING;

-- After you purchase numbers, insert them like this:
-- Replace with your actual numbers

-- Example for Account 1 (10 numbers):
INSERT INTO phone_numbers (phone_number, vendor_account_id, status, daily_limit, warming_day) VALUES
  ('+12125551001', (SELECT id FROM vendor_accounts WHERE account_identifier = 'anveo_account_1'), 'warming', 100, 1),
  ('+12125551002', (SELECT id FROM vendor_accounts WHERE account_identifier = 'anveo_account_1'), 'warming', 100, 1),
  ('+12125551003', (SELECT id FROM vendor_accounts WHERE account_identifier = 'anveo_account_1'), 'warming', 100, 1),
  ('+12125551004', (SELECT id FROM vendor_accounts WHERE account_identifier = 'anveo_account_1'), 'warming', 100, 1),
  ('+12125551005', (SELECT id FROM vendor_accounts WHERE account_identifier = 'anveo_account_1'), 'warming', 100, 1),
  ('+12125551006', (SELECT id FROM vendor_accounts WHERE account_identifier = 'anveo_account_1'), 'warming', 100, 1),
  ('+12125551007', (SELECT id FROM vendor_accounts WHERE account_identifier = 'anveo_account_1'), 'warming', 100, 1),
  ('+12125551008', (SELECT id FROM vendor_accounts WHERE account_identifier = 'anveo_account_1'), 'warming', 100, 1),
  ('+12125551009', (SELECT id FROM vendor_accounts WHERE account_identifier = 'anveo_account_1'), 'warming', 100, 1),
  ('+12125551010', (SELECT id FROM vendor_accounts WHERE account_identifier = 'anveo_account_1'), 'warming', 100, 1)
ON CONFLICT (phone_number) DO NOTHING;

-- You'll repeat this for accounts 2 and 3 with their numbers

-- Helper query to check your setup:
SELECT 
  va.account_label,
  va.status as account_status,
  va.daily_limit,
  va.sent_today,
  va.health_score,
  COUNT(pn.id) as number_count,
  COUNT(pn.id) FILTER (WHERE pn.status = 'active') as active_numbers,
  COUNT(pn.id) FILTER (WHERE pn.status = 'warming') as warming_numbers
FROM vendor_accounts va
LEFT JOIN phone_numbers pn ON pn.vendor_account_id = va.id
GROUP BY va.id, va.account_label, va.status, va.daily_limit, va.sent_today, va.health_score
ORDER BY va.priority;

-- Query to see number distribution
SELECT 
  va.account_label,
  pn.status,
  COUNT(*) as count,
  AVG(pn.sent_today) as avg_sent_today,
  AVG(pn.daily_limit) as avg_limit
FROM phone_numbers pn
JOIN vendor_accounts va ON va.id = pn.vendor_account_id
GROUP BY va.account_label, pn.status
ORDER BY va.account_label, pn.status;
