-- Add api_key_id to anveo_numbers table to link numbers to specific API keys
ALTER TABLE anveo_numbers 
ADD COLUMN IF NOT EXISTS api_key_id VARCHAR(255);

-- Add foreign key comment (PostgreSQL doesn't enforce FK to varchar easily, but we document it)
COMMENT ON COLUMN anveo_numbers.api_key_id IS 'Links to api_key_pool.id - which Anveo API key this number uses';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_anveo_numbers_api_key_id ON anveo_numbers(api_key_id);

-- Show current state
SELECT 
  phone_number,
  api_key_id,
  status,
  worker_url
FROM anveo_numbers
ORDER BY phone_number;
