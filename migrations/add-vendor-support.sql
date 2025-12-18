-- Add vendor support to existing message_logs table
ALTER TABLE message_logs 
ADD COLUMN IF NOT EXISTS vendor VARCHAR(50) DEFAULT 'extremesms' NOT NULL;

-- Create index for vendor column
CREATE INDEX IF NOT EXISTS message_vendor_idx ON message_logs(vendor);

-- Create vendor_configs table for future extensibility
CREATE TABLE IF NOT EXISTS vendor_configs (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    config JSONB NOT NULL,
    priority INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Insert default vendor configurations
INSERT INTO vendor_configs (name, config, priority) VALUES 
('extremesms', '{"type": "extremesms", "baseUrl": "https://extremesms.net", "requiresApiKey": true}', 1)
ON CONFLICT (name) DO NOTHING;

INSERT INTO vendor_configs (name, config, priority) VALUES 
('textbelt', '{"type": "textbelt", "baseUrl": "https://textbelt.com", "requiresApiKey": true}', 0)
ON CONFLICT (name) DO NOTHING;

-- Set default active vendor
INSERT INTO system_config (key, value) VALUES ('active_sms_vendor', 'textbelt')
ON CONFLICT (key) DO NOTHING;