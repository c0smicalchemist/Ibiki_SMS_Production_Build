-- Migration: Add phone number (DID) support for Anveo vendor keys
-- Anveo requires sending from your own purchased phone numbers

-- Add from_number column to vendor_api_key_pool for Anveo DIDs
ALTER TABLE vendor_api_key_pool ADD COLUMN IF NOT EXISTS from_number TEXT;

-- Add cost_per_sms for tracking vendor costs
ALTER TABLE vendor_api_key_pool ADD COLUMN IF NOT EXISTS cost_per_sms DECIMAL(10, 4) DEFAULT 0.0500;

-- Add vendor-specific metadata (JSON for flexibility)
ALTER TABLE vendor_api_key_pool ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Add index for from_number lookups (useful for incoming SMS routing)
CREATE INDEX IF NOT EXISTS vkp_from_number_idx ON vendor_api_key_pool(from_number) WHERE from_number IS NOT NULL;

-- Comment
COMMENT ON COLUMN vendor_api_key_pool.from_number IS 'Phone number/DID for vendors like Anveo that require sending from specific numbers';
COMMENT ON COLUMN vendor_api_key_pool.cost_per_sms IS 'Cost per SMS in USD for this key/vendor';
COMMENT ON COLUMN vendor_api_key_pool.metadata IS 'Vendor-specific metadata in JSON format';

-- Example Anveo key insert (template):
-- INSERT INTO vendor_api_key_pool (vendor, name, api_key, from_number, cost_per_sms, quota_limit, is_active, priority)
-- VALUES ('anveo', 'Anveo Key 1', 'your-anveo-api-key', '12125551234', 0.0200, 10000, true, 0);
