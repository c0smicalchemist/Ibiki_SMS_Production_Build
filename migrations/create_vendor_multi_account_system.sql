-- ============================================
-- MULTI-VENDOR ACCOUNT SYSTEM
-- For managing multiple Anveo accounts + future vendors
-- ============================================

-- Vendor accounts table (multiple Anveo accounts + other vendors later)
CREATE TABLE IF NOT EXISTS vendor_accounts (
  id SERIAL PRIMARY KEY,
  vendor_name VARCHAR(50) NOT NULL DEFAULT 'anveo',
  account_identifier VARCHAR(100) UNIQUE NOT NULL,
  account_label VARCHAR(100),
  api_key_encrypted TEXT,
  api_secret_encrypted TEXT,
  status VARCHAR(20) DEFAULT 'active',
  daily_limit INTEGER DEFAULT 10000,
  sent_today INTEGER DEFAULT 0,
  error_rate_today DECIMAL(5,2) DEFAULT 0,
  last_error TEXT,
  last_error_time TIMESTAMP,
  consecutive_errors INTEGER DEFAULT 0,
  health_score INTEGER DEFAULT 100,
  priority INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  last_reset_date DATE DEFAULT CURRENT_DATE,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_vendor_accounts_status ON vendor_accounts(status);
CREATE INDEX IF NOT EXISTS idx_vendor_accounts_health ON vendor_accounts(health_score DESC);

-- Phone numbers pool
CREATE TABLE IF NOT EXISTS anveo_numbers (
  id SERIAL PRIMARY KEY,
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  vendor_account_id INTEGER REFERENCES vendor_accounts(id) ON DELETE SET NULL,
  worker_url VARCHAR(255),
  status VARCHAR(20) DEFAULT 'warming',
  daily_limit INTEGER DEFAULT 100,
  sent_today INTEGER DEFAULT 0,
  complaints INTEGER DEFAULT 0,
  error_count_today INTEGER DEFAULT 0,
  success_count_today INTEGER DEFAULT 0,
  last_used_at TIMESTAMP,
  warming_day INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  last_reset_date DATE DEFAULT CURRENT_DATE,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_anveo_numbers_status ON anveo_numbers(status);
CREATE INDEX IF NOT EXISTS idx_anveo_numbers_vendor ON anveo_numbers(vendor_account_id);
CREATE INDEX IF NOT EXISTS idx_anveo_numbers_worker ON anveo_numbers(worker_url);
CREATE INDEX IF NOT EXISTS idx_anveo_numbers_lookup ON anveo_numbers(phone_number);

-- Number assignments (sticky routing - user-recipient pairs)
CREATE TABLE IF NOT EXISTS number_assignments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  recipient_phone VARCHAR(20) NOT NULL,
  assigned_number VARCHAR(20) REFERENCES anveo_numbers(phone_number) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP DEFAULT NOW(),
  message_count INTEGER DEFAULT 0,
  UNIQUE(user_id, recipient_phone)
);

CREATE INDEX IF NOT EXISTS idx_number_assignments_lookup ON number_assignments(user_id, recipient_phone);
CREATE INDEX IF NOT EXISTS idx_number_assignments_number ON number_assignments(assigned_number);

-- Message routing log (for debugging and analytics)
CREATE TABLE IF NOT EXISTS message_routing_log (
  id SERIAL PRIMARY KEY,
  message_id INTEGER,
  user_id INTEGER,
  vendor_account_id INTEGER REFERENCES vendor_accounts(id) ON DELETE SET NULL,
  phone_number VARCHAR(20),
  routing_decision TEXT,
  attempt_number INTEGER DEFAULT 1,
  success BOOLEAN DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_routing_log_message ON message_routing_log(message_id);
CREATE INDEX IF NOT EXISTS idx_routing_log_vendor ON message_routing_log(vendor_account_id);
CREATE INDEX IF NOT EXISTS idx_routing_log_created ON message_routing_log(created_at DESC);

-- Opt-out registry (global blacklist)
CREATE TABLE IF NOT EXISTS opt_out_registry (
  id SERIAL PRIMARY KEY,
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  opted_out_at TIMESTAMP DEFAULT NOW(),
  source VARCHAR(50) DEFAULT 'sms_reply',
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_opt_out_phone ON opt_out_registry(phone_number);

-- Content modification log (track sanitization)
CREATE TABLE IF NOT EXISTS content_modifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  message_id INTEGER,
  original_text TEXT NOT NULL,
  modified_text TEXT NOT NULL,
  risk_score INTEGER DEFAULT 0,
  modifications JSONB,
  action_taken VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_mods_user ON content_modifications(user_id);
CREATE INDEX IF NOT EXISTS idx_content_mods_risk ON content_modifications(risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_content_mods_created ON content_modifications(created_at DESC);

-- Webhook deduplication
CREATE TABLE IF NOT EXISTS webhook_dedup (
  id SERIAL PRIMARY KEY,
  message_id VARCHAR(100) UNIQUE NOT NULL,
  vendor_account_id INTEGER,
  received_count INTEGER DEFAULT 1,
  first_received_at TIMESTAMP DEFAULT NOW(),
  last_received_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_dedup_created ON webhook_dedup(first_received_at);

-- Daily stats reset function
CREATE OR REPLACE FUNCTION reset_daily_counters()
RETURNS void AS $$
BEGIN
  -- Reset vendor account counters
  UPDATE vendor_accounts 
  SET sent_today = 0, 
      error_rate_today = 0,
      last_reset_date = CURRENT_DATE
  WHERE last_reset_date < CURRENT_DATE;
  
  -- Reset number counters and promote warming numbers
  UPDATE anveo_numbers 
  SET sent_today = 0,
      error_count_today = 0,
      success_count_today = 0,
      last_reset_date = CURRENT_DATE,
      warming_day = CASE 
        WHEN status = 'warming' THEN warming_day + 1 
        ELSE warming_day 
      END,
      daily_limit = CASE
        WHEN status = 'warming' AND warming_day >= 21 THEN 1500
        WHEN status = 'warming' AND warming_day >= 14 THEN 1000
        WHEN status = 'warming' AND warming_day >= 7 THEN 500
        WHEN status = 'warming' THEN 100
        ELSE daily_limit
      END,
      status = CASE
        WHEN status = 'warming' AND warming_day >= 21 THEN 'active'
        ELSE status
      END
  WHERE last_reset_date < CURRENT_DATE;
  
  RAISE NOTICE 'Daily counters reset completed';
END;
$$ LANGUAGE plpgsql;

-- Insert default vendor account (your current Anveo)
INSERT INTO vendor_accounts (
  vendor_name,
  account_identifier,
  account_label,
  status,
  daily_limit,
  priority
) VALUES (
  'anveo',
  'anveo_account_1',
  'Primary Anveo Account',
  'active',
  10000,
  1
) ON CONFLICT (account_identifier) DO NOTHING;

-- Insert the new number with worker assignment
INSERT INTO anveo_numbers (
  phone_number, 
  vendor_account_id, 
  status, 
  daily_limit, 
  warming_day,
  worker_url,
  sent_today,
  complaints
) VALUES (
  '+17204398855',
  (SELECT id FROM vendor_accounts WHERE account_identifier = 'anveo_account_1' LIMIT 1),
  'warming',
  100,
  1,
  'https://sms-proxy-1.c0smicalch3mist.workers.dev/webhook',
  0,
  0
) ON CONFLICT (phone_number) DO UPDATE SET
  worker_url = EXCLUDED.worker_url,
  status = 'warming',
  daily_limit = 100,
  warming_day = 1,
  vendor_account_id = EXCLUDED.vendor_account_id;

-- Add comments
COMMENT ON TABLE vendor_accounts IS 'Multiple vendor accounts for load distribution and redundancy';
COMMENT ON TABLE anveo_numbers IS 'Phone number pool with warming protocol and worker assignment';
COMMENT ON TABLE number_assignments IS 'Sticky routing: maintain same number for user-recipient conversations';
COMMENT ON COLUMN anveo_numbers.worker_url IS 'Cloudflare Worker webhook URL this number is permanently assigned to';
COMMENT ON COLUMN anveo_numbers.warming_day IS 'Days since number activation (warming protocol)';
COMMENT ON FUNCTION reset_daily_counters IS 'Run daily at midnight to reset counters and promote warming numbers';

-- Grant permissions
GRANT ALL ON vendor_accounts TO ibiki_user;
GRANT ALL ON anveo_numbers TO ibiki_user;
GRANT ALL ON number_assignments TO ibiki_user;
GRANT ALL ON message_routing_log TO ibiki_user;
GRANT ALL ON opt_out_registry TO ibiki_user;
GRANT ALL ON content_modifications TO ibiki_user;
GRANT ALL ON webhook_dedup TO ibiki_user;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ibiki_user;
