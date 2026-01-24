-- Multi-Vendor Infrastructure for Grey Route Scaling
-- Creates tables for vendor account management, number pools, and intelligent routing

-- Vendor Accounts Table (Support multiple Anveo accounts + future vendors)
CREATE TABLE IF NOT EXISTS vendor_accounts (
  id SERIAL PRIMARY KEY,
  vendor_name VARCHAR(50) NOT NULL DEFAULT 'anveo',
  account_identifier VARCHAR(100) UNIQUE NOT NULL, -- e.g., 'anveo_account_1', 'anveo_account_2'
  account_label VARCHAR(100), -- Human-readable: 'Anveo LLC Alpha', 'Anveo LLC Beta'
  
  -- Credentials (encrypted in production)
  api_key_encrypted TEXT,
  api_secret_encrypted TEXT,
  webhook_secret TEXT,
  
  -- Account Status
  status VARCHAR(20) DEFAULT 'active', -- active, degraded, suspended, banned
  daily_limit INTEGER DEFAULT 10000,
  sent_today INTEGER DEFAULT 0,
  sent_this_month INTEGER DEFAULT 0,
  
  -- Health Metrics
  error_rate_today DECIMAL(5,2) DEFAULT 0,
  success_rate_today DECIMAL(5,2) DEFAULT 100,
  health_score INTEGER DEFAULT 100, -- 0-100, auto-calculated
  consecutive_errors INTEGER DEFAULT 0,
  
  -- Last Error Tracking
  last_error_message TEXT,
  last_error_code VARCHAR(50),
  last_error_time TIMESTAMP,
  
  -- Routing Priority
  priority INTEGER DEFAULT 1, -- 1=highest priority, lower number = prefer this account
  
  -- Cost Tracking
  cost_per_sms DECIMAL(6,4) DEFAULT 0.01, -- Track cost per vendor
  
  -- Metadata
  cloudflare_worker_url TEXT, -- If using CF Workers for isolation
  webhook_endpoint TEXT, -- Unique webhook URL for this account
  notes TEXT,
  
  -- Timestamps
  last_reset_date DATE DEFAULT CURRENT_DATE,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for vendor_accounts
CREATE INDEX idx_vendor_accounts_status ON vendor_accounts(status) WHERE status = 'active';
CREATE INDEX idx_vendor_accounts_health ON vendor_accounts(health_score DESC) WHERE status = 'active';
CREATE INDEX idx_vendor_accounts_priority ON vendor_accounts(priority ASC, health_score DESC);

-- Phone Numbers Pool (Supports multiple vendor accounts)
CREATE TABLE IF NOT EXISTS phone_numbers (
  id SERIAL PRIMARY KEY,
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  vendor_account_id INTEGER REFERENCES vendor_accounts(id) ON DELETE SET NULL,
  
  -- Number Status
  status VARCHAR(20) DEFAULT 'warming', -- warming, active, suspended, banned
  warming_day INTEGER DEFAULT 1, -- Track how long this number has been warming
  
  -- Daily Limits (Progressive warming)
  daily_limit INTEGER DEFAULT 100, -- Start low, increase over time
  sent_today INTEGER DEFAULT 0,
  sent_this_month INTEGER DEFAULT 0,
  sent_lifetime INTEGER DEFAULT 0,
  
  -- Quality Metrics
  complaints INTEGER DEFAULT 0,
  complaint_rate DECIMAL(5,2) DEFAULT 0,
  error_count_today INTEGER DEFAULT 0,
  success_count_today INTEGER DEFAULT 0,
  delivery_rate DECIMAL(5,2) DEFAULT 100,
  
  -- Usage Tracking
  last_used_at TIMESTAMP,
  last_complaint_at TIMESTAMP,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  activated_at TIMESTAMP, -- When it graduated from warming to active
  last_reset_date DATE DEFAULT CURRENT_DATE,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for phone_numbers
CREATE INDEX idx_phone_numbers_status ON phone_numbers(status);
CREATE INDEX idx_phone_numbers_vendor ON phone_numbers(vendor_account_id);
CREATE INDEX idx_phone_numbers_available ON phone_numbers(status, sent_today, daily_limit) 
  WHERE status IN ('warming', 'active') AND sent_today < daily_limit;
CREATE INDEX idx_phone_numbers_least_used ON phone_numbers(sent_today ASC, last_used_at ASC NULLS FIRST)
  WHERE status IN ('warming', 'active');

-- Number Assignments (Sticky routing - same number for same user-recipient pair)
CREATE TABLE IF NOT EXISTS number_assignments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  recipient_phone VARCHAR(20) NOT NULL,
  assigned_number VARCHAR(20) REFERENCES phone_numbers(phone_number) ON DELETE SET NULL,
  
  -- Assignment metadata
  first_message_sent_at TIMESTAMP DEFAULT NOW(),
  last_message_sent_at TIMESTAMP DEFAULT NOW(),
  total_messages_sent INTEGER DEFAULT 1,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(user_id, recipient_phone)
);

CREATE INDEX idx_number_assignments_lookup ON number_assignments(user_id, recipient_phone) WHERE is_active = TRUE;
CREATE INDEX idx_number_assignments_number ON number_assignments(assigned_number);

-- Message Routing Log (Debug which vendor/account was used)
CREATE TABLE IF NOT EXISTS message_routing_log (
  id SERIAL PRIMARY KEY,
  message_id INTEGER REFERENCES message_logs(id) ON DELETE CASCADE,
  
  -- Routing Decision
  vendor_account_id INTEGER REFERENCES vendor_accounts(id),
  phone_number VARCHAR(20),
  routing_reason TEXT, -- Why this vendor was selected
  attempt_number INTEGER DEFAULT 1,
  
  -- Vendor Response
  vendor_message_id VARCHAR(100),
  vendor_response JSONB,
  vendor_error_code VARCHAR(50),
  vendor_error_message TEXT,
  
  -- Timing
  api_call_duration_ms INTEGER,
  
  -- Result
  success BOOLEAN,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_routing_log_message ON message_routing_log(message_id);
CREATE INDEX idx_routing_log_vendor ON message_routing_log(vendor_account_id);
CREATE INDEX idx_routing_log_created ON message_routing_log(created_at DESC);

-- Content Modification Log (Track silent content filtering)
CREATE TABLE IF NOT EXISTS content_modifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  message_id INTEGER REFERENCES message_logs(id),
  
  -- Content
  original_text TEXT NOT NULL,
  modified_text TEXT NOT NULL,
  
  -- Risk Assessment
  risk_score INTEGER DEFAULT 0, -- 0-100
  spam_triggers_found JSONB, -- Array of trigger words detected
  modifications_made JSONB, -- Array of changes applied
  
  -- Action Taken
  action VARCHAR(50), -- 'sent', 'modified_and_sent', 'queued_for_review', 'blocked'
  
  -- Don't tell client
  client_notified BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_content_mods_user ON content_modifications(user_id);
CREATE INDEX idx_content_mods_risk ON content_modifications(risk_score DESC);
CREATE INDEX idx_content_mods_created ON content_modifications(created_at DESC);

-- Manual Review Queue (High-risk messages flagged for review)
CREATE TABLE IF NOT EXISTS manual_review_queue (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  message_id INTEGER REFERENCES message_logs(id),
  
  original_message TEXT,
  modified_message TEXT,
  risk_score INTEGER,
  
  status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected, sent
  reviewer_notes TEXT,
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_review_queue_status ON manual_review_queue(status, created_at DESC);
CREATE INDEX idx_review_queue_user ON manual_review_queue(user_id);

-- Opt-Out Registry (Global - across all clients)
CREATE TABLE IF NOT EXISTS opt_out_registry (
  id SERIAL PRIMARY KEY,
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  opted_out_at TIMESTAMP DEFAULT NOW(),
  opt_out_message TEXT, -- What they sent: "STOP", "UNSUBSCRIBE", etc.
  source_user_id INTEGER REFERENCES users(id), -- Which client's campaign they opted out from
  
  -- Make sure we never send to them again
  permanently_blocked BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_opt_out_phone ON opt_out_registry(phone_number);
CREATE INDEX idx_opt_out_created ON opt_out_registry(created_at DESC);

-- User Spam Scores (Track which clients send risky content)
ALTER TABLE users ADD COLUMN IF NOT EXISTS spam_score INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auto_suspend_threshold INTEGER DEFAULT 80;
ALTER TABLE users ADD COLUMN IF NOT EXISTS high_risk_sender BOOLEAN DEFAULT FALSE;

-- Vendor Health Check Log (Monitor vendor API health)
CREATE TABLE IF NOT EXISTS vendor_health_checks (
  id SERIAL PRIMARY KEY,
  vendor_account_id INTEGER REFERENCES vendor_accounts(id),
  
  check_type VARCHAR(50), -- 'api_ping', 'test_send', 'auto_recovery'
  success BOOLEAN,
  response_time_ms INTEGER,
  error_message TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_health_checks_vendor ON vendor_health_checks(vendor_account_id, created_at DESC);

-- Webhook Deduplication (Prevent duplicate processing)
CREATE TABLE IF NOT EXISTS webhook_dedup (
  id SERIAL PRIMARY KEY,
  message_id VARCHAR(100) UNIQUE NOT NULL,
  vendor_account_id INTEGER REFERENCES vendor_accounts(id),
  webhook_payload JSONB,
  processed_at TIMESTAMP DEFAULT NOW(),
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_webhook_dedup_message ON webhook_dedup(message_id);
CREATE INDEX idx_webhook_dedup_created ON webhook_dedup(created_at DESC);

-- Auto-cleanup old dedup records (keep last 7 days)
-- Run this daily via cron
-- DELETE FROM webhook_dedup WHERE created_at < NOW() - INTERVAL '7 days';

-- Delivery Failures Analysis
CREATE TABLE IF NOT EXISTS delivery_failures (
  id SERIAL PRIMARY KEY,
  message_id VARCHAR(100),
  vendor_account_id INTEGER REFERENCES vendor_accounts(id),
  phone_number VARCHAR(20),
  
  failure_category VARCHAR(50), -- 'spam_detected', 'number_banned', 'carrier_rejection', etc.
  error_code VARCHAR(50),
  error_message TEXT,
  full_payload JSONB,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_delivery_failures_category ON delivery_failures(failure_category);
CREATE INDEX idx_delivery_failures_number ON delivery_failures(phone_number);
CREATE INDEX idx_delivery_failures_created ON delivery_failures(created_at DESC);

-- Content Blacklist (Admin-configurable spam patterns)
CREATE TABLE IF NOT EXISTS content_blacklist (
  id SERIAL PRIMARY KEY,
  pattern TEXT NOT NULL,
  pattern_type VARCHAR(20) DEFAULT 'contains', -- 'exact', 'regex', 'contains', 'starts_with'
  
  action VARCHAR(20) DEFAULT 'modify', -- 'block', 'modify', 'flag', 'log_only'
  replacement_text TEXT,
  risk_score_add INTEGER DEFAULT 15, -- How much to add to message risk score
  
  enabled BOOLEAN DEFAULT TRUE,
  notes TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_blacklist_enabled ON content_blacklist(enabled) WHERE enabled = TRUE;

-- Insert default spam triggers
INSERT INTO content_blacklist (pattern, pattern_type, action, replacement_text, risk_score_add, notes) VALUES
  ('FREE', 'contains', 'modify', 'Complimentary', 15, 'Common spam trigger'),
  ('CLICK HERE', 'contains', 'modify', 'See details', 20, 'Aggressive CTA'),
  ('LIMITED TIME', 'contains', 'modify', 'Time-sensitive', 10, 'Urgency trigger'),
  ('ACT NOW', 'contains', 'modify', 'Respond soon', 15, 'Urgency trigger'),
  ('WINNER', 'contains', 'modify', 'Selected', 20, 'Lottery scam indicator'),
  ('CONGRATULATIONS', 'contains', 'modify', 'Good news', 15, 'Scam indicator'),
  ('CLAIM YOUR', 'contains', 'modify', 'Receive your', 15, 'Scam indicator'),
  ('CASH PRIZE', 'contains', 'block', NULL, 50, 'Definite scam'),
  ('VIAGRA', 'contains', 'block', NULL, 50, 'Pharma spam'),
  ('WEIGHT LOSS', 'contains', 'modify', 'fitness program', 20, 'Common spam')
ON CONFLICT DO NOTHING;

-- System Config for vendor rotation
INSERT INTO system_config (key, value) VALUES
  ('vendor_rotation_enabled', 'true'),
  ('vendor_health_check_interval', '300'), -- seconds
  ('number_warming_enabled', 'true'),
  ('content_filtering_enabled', 'true'),
  ('auto_suspend_bad_vendors', 'true'),
  ('min_vendor_health_score', '50')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Function to reset daily counters (run at midnight)
CREATE OR REPLACE FUNCTION reset_daily_counters() RETURNS void AS $$
BEGIN
  -- Reset vendor account daily counters
  UPDATE vendor_accounts 
  SET 
    sent_today = 0,
    error_rate_today = 0,
    success_rate_today = 100,
    consecutive_errors = 0,
    last_reset_date = CURRENT_DATE
  WHERE last_reset_date < CURRENT_DATE;
  
  -- Reset phone number daily counters
  UPDATE phone_numbers 
  SET 
    sent_today = 0,
    error_count_today = 0,
    success_count_today = 0,
    last_reset_date = CURRENT_DATE,
    -- Progress warming schedule
    warming_day = CASE 
      WHEN status = 'warming' THEN warming_day + 1
      ELSE warming_day
    END,
    -- Increase daily limit based on warming schedule
    daily_limit = CASE 
      WHEN status = 'warming' AND warming_day < 7 THEN 100
      WHEN status = 'warming' AND warming_day BETWEEN 7 AND 14 THEN 500
      WHEN status = 'warming' AND warming_day BETWEEN 15 AND 21 THEN 1000
      WHEN status = 'warming' AND warming_day >= 22 THEN 1500
      ELSE daily_limit
    END,
    -- Graduate to active after 22 days
    status = CASE 
      WHEN status = 'warming' AND warming_day >= 22 THEN 'active'
      ELSE status
    END,
    activated_at = CASE 
      WHEN status = 'warming' AND warming_day >= 22 AND activated_at IS NULL THEN NOW()
      ELSE activated_at
    END
  WHERE last_reset_date < CURRENT_DATE;
  
  -- Calculate delivery rates
  UPDATE phone_numbers
  SET delivery_rate = CASE 
    WHEN (success_count_today + error_count_today) > 0 
    THEN (success_count_today::decimal / (success_count_today + error_count_today)) * 100
    ELSE 100
  END;
  
  -- Calculate complaint rates
  UPDATE phone_numbers
  SET complaint_rate = CASE 
    WHEN sent_lifetime > 0 
    THEN (complaints::decimal / sent_lifetime) * 100
    ELSE 0
  END;
  
  -- Auto-suspend numbers with high complaint rate
  UPDATE phone_numbers
  SET status = 'suspended'
  WHERE complaint_rate > 2.0 AND status NOT IN ('suspended', 'banned');
  
END;
$$ LANGUAGE plpgsql;

-- Function to calculate vendor health score
CREATE OR REPLACE FUNCTION calculate_vendor_health(v_id INTEGER) RETURNS INTEGER AS $$
DECLARE
  score INTEGER := 100;
  v_record RECORD;
BEGIN
  SELECT * INTO v_record FROM vendor_accounts WHERE id = v_id;
  
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  
  -- Penalize for consecutive errors
  score := score - (v_record.consecutive_errors * 5);
  
  -- Penalize for high error rate
  score := score - (v_record.error_rate_today * 10)::INTEGER;
  
  -- Penalize if near daily limit
  IF v_record.daily_limit > 0 THEN
    DECLARE
      usage_percent DECIMAL;
    BEGIN
      usage_percent := (v_record.sent_today::decimal / v_record.daily_limit) * 100;
      IF usage_percent > 90 THEN
        score := score - 40;
      ELSIF usage_percent > 80 THEN
        score := score - 20;
      END IF;
    END;
  END IF;
  
  -- Bonus for healthy vendor (no recent errors)
  IF v_record.consecutive_errors = 0 AND v_record.error_rate_today < 1 THEN
    score := score + 10;
  END IF;
  
  -- Cap between 0-100
  RETURN GREATEST(0, LEAST(100, score));
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update vendor health score
CREATE OR REPLACE FUNCTION update_vendor_health_trigger() RETURNS TRIGGER AS $$
BEGIN
  NEW.health_score := calculate_vendor_health(NEW.id);
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER vendor_health_update
  BEFORE UPDATE ON vendor_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_vendor_health_trigger();

-- Comments for documentation
COMMENT ON TABLE vendor_accounts IS 'Manages multiple vendor accounts (Anveo, Bandwidth, etc) for load balancing and failover';
COMMENT ON TABLE phone_numbers IS 'Pool of phone numbers with warming schedule and health tracking';
COMMENT ON TABLE number_assignments IS 'Sticky routing - ensures same number used for same user-recipient pair';
COMMENT ON TABLE content_modifications IS 'Logs all silent content filtering (never shown to client)';
COMMENT ON TABLE opt_out_registry IS 'Global opt-out list - never send to these numbers';
COMMENT ON FUNCTION reset_daily_counters IS 'Run this daily at midnight via cron to reset counters and progress warming';
