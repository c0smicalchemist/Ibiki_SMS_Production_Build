-- API Key Pool and SMS Queue Migration
-- This migration adds tables for high-volume SMS scaling

-- Create the vendor_api_key_pool table
CREATE TABLE IF NOT EXISTS vendor_api_key_pool (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor TEXT NOT NULL,
    name TEXT NOT NULL,
    api_key TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    priority INTEGER NOT NULL DEFAULT 0,
    weight INTEGER NOT NULL DEFAULT 100,
    quota_limit INTEGER DEFAULT 0,
    quota_used INTEGER NOT NULL DEFAULT 0,
    quota_reset_at TIMESTAMP,
    rate_limit DECIMAL(5, 2) NOT NULL DEFAULT 2.00,
    last_used_at TIMESTAMP,
    last_error_at TIMESTAMP,
    last_error TEXT,
    consecutive_errors INTEGER NOT NULL DEFAULT 0,
    total_sent INTEGER NOT NULL DEFAULT 0,
    total_failed INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for vendor_api_key_pool
CREATE INDEX IF NOT EXISTS vkp_vendor_idx ON vendor_api_key_pool(vendor);
CREATE INDEX IF NOT EXISTS vkp_active_idx ON vendor_api_key_pool(is_active);
CREATE INDEX IF NOT EXISTS vkp_priority_idx ON vendor_api_key_pool(priority);

-- Create the sms_queue table
CREATE TABLE IF NOT EXISTS sms_queue (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR NOT NULL REFERENCES users(id),
    recipient TEXT NOT NULL,
    message TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 50,
    status TEXT NOT NULL DEFAULT 'pending',
    vendor TEXT,
    api_key_id VARCHAR REFERENCES vendor_api_key_pool(id),
    vendor_message_id TEXT,
    vendor_status TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    last_attempt_at TIMESTAMP,
    last_error TEXT,
    scheduled_for TIMESTAMP,
    route_window_only BOOLEAN NOT NULL DEFAULT true,
    cost_per_message DECIMAL(10, 4),
    charge_per_message DECIMAL(10, 4),
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMP
);

-- Create indexes for sms_queue
CREATE INDEX IF NOT EXISTS sq_user_idx ON sms_queue(user_id);
CREATE INDEX IF NOT EXISTS sq_status_idx ON sms_queue(status);
CREATE INDEX IF NOT EXISTS sq_priority_idx ON sms_queue(priority);
CREATE INDEX IF NOT EXISTS sq_scheduled_idx ON sms_queue(scheduled_for);
CREATE INDEX IF NOT EXISTS sq_created_idx ON sms_queue(created_at);

-- Create the queue_stats table
CREATE TABLE IF NOT EXISTS queue_stats (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    date TIMESTAMP NOT NULL,
    pending INTEGER NOT NULL DEFAULT 0,
    processing INTEGER NOT NULL DEFAULT 0,
    sent INTEGER NOT NULL DEFAULT 0,
    failed INTEGER NOT NULL DEFAULT 0,
    throughput_per_sec DECIMAL(10, 2),
    avg_latency_ms INTEGER,
    route_window_open BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create index for queue_stats
CREATE INDEX IF NOT EXISTS qs_date_idx ON queue_stats(date);

-- Add comment to document the purpose
COMMENT ON TABLE vendor_api_key_pool IS 'Stores multiple API keys per vendor for load balancing and high-throughput SMS sending';
COMMENT ON TABLE sms_queue IS 'Queue for bulk SMS messages to be processed by workers during route window';
COMMENT ON TABLE queue_stats IS 'Hourly statistics for queue monitoring and analytics';
