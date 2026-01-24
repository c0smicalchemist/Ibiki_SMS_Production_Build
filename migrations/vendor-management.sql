-- Vendor Management System Database Migration
-- This migration adds support for comprehensive vendor configuration management

-- Add vendor column to message_logs if not exists
ALTER TABLE message_logs 
ADD COLUMN IF NOT EXISTS vendor VARCHAR(50) DEFAULT 'textbelt';

-- Add vendor configuration table (using system_config for JSON storage)
-- The vendor management configuration will be stored as JSON in system_config
-- Key: 'vendor_management'
-- Value: JSON object containing vendor configurations

-- Ensure system_config table has the vendor_management key
INSERT INTO system_config (key, value) 
VALUES ('vendor_management', '{
  "activeVendorId": "textbelt",
  "vendors": [
    {
      "id": "textbelt",
      "name": "TextBelt",
      "type": "textbelt",
      "enabled": true,
      "priority": 1,
      "timeout": 10000,
      "retryAttempts": 3,
      "retryDelay": 1000,
      "config": {
        "apiKey": "textbelt",
        "baseUrl": "https://textbelt.com",
        "maxRecipients": 1,
        "rateLimit": 75
      }
    },
    {
      "id": "extremesms",
      "name": "ExtremeSMS",
      "type": "extremesms",
      "enabled": true,
      "priority": 2,
      "timeout": 10000,
      "retryAttempts": 3,
      "retryDelay": 1000,
      "config": {
        "apiKey": "",
        "baseUrl": "https://extremesms.net",
        "senderId": "",
        "route": "4",
        "unicode": false,
        "flash": false
      }
    },
    {
      "id": "anveo",
      "name": "Anveo",
      "type": "anveo",
      "enabled": true,
      "priority": 1,
      "timeout": 10000,
      "retryAttempts": 3,
      "retryDelay": 1000,
      "config": {
        "apiKey": "",
        "baseUrl": "https://www.anveo.com/api/v1.asp",
        "fromNumber": "",
        "rateLimit": 60
      }
    }
  ],
  "switchingConfig": {
    "strategy": "manual",
    "fallbackEnabled": true,
    "healthCheckInterval": 30000,
    "failureThreshold": 3,
    "recoveryTime": 300000,
    "costOptimization": false,
    "regionBased": false
  },
  "vendorStates": {},
  "createdAt": "2024-12-19T00:00:00.000Z",
  "updatedAt": "2024-12-19T00:00:00.000Z"
}')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Add vendor-specific API keys to system_config
INSERT INTO system_config (key, value) 
VALUES 
('textbelt_api_key', 'textbelt'),
('extremesms_api_key', ''),
('extremesms_sender_id', ''),
('anveo_api_key', ''),
('anveo_from_number', ''),
('twilio_account_sid', ''),
('twilio_auth_token', ''),
('twilio_from_number', ''),
('vonage_api_key', ''),
('vonage_api_secret', ''),
('vonage_from', '')
ON CONFLICT (key) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_message_logs_vendor ON message_logs(vendor);
CREATE INDEX IF NOT EXISTS idx_message_logs_created_at_vendor ON message_logs(created_at, vendor);

-- Add vendor statistics tracking columns to message_logs
-- These will be populated by the vendor service
ALTER TABLE message_logs 
ADD COLUMN IF NOT EXISTS vendor_response_time INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS vendor_cost DECIMAL(10,4) DEFAULT 0.0000,
ADD COLUMN IF NOT EXISTS vendor_message_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS vendor_error TEXT;

-- Create a view for vendor analytics
CREATE OR REPLACE VIEW vendor_analytics AS
SELECT 
  vendor,
  COUNT(*) as total_messages,
  COUNT(CASE WHEN status = 'delivered' THEN 1 END) as successful_messages,
  COUNT(CASE WHEN status != 'delivered' THEN 1 END) as failed_messages,
  AVG(vendor_response_time) as avg_response_time,
  SUM(vendor_cost) as total_cost,
  DATE_TRUNC('day', created_at) as date
FROM message_logs
WHERE vendor IS NOT NULL
GROUP BY vendor, DATE_TRUNC('day', created_at)
ORDER BY date DESC, vendor;

-- Create a function to update vendor states
CREATE OR REPLACE FUNCTION update_vendor_state(
  p_vendor_id VARCHAR(50),
  p_status VARCHAR(20),
  p_response_time INTEGER DEFAULT 0,
  p_cost DECIMAL(10,4) DEFAULT 0.0000,
  p_message_id VARCHAR(255) DEFAULT NULL,
  p_error TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  -- This function would be called by the application to update vendor states
  -- The actual state management is handled in the application layer
  -- This is just a placeholder for potential future database-level state management
END;
$$ LANGUAGE plpgsql;