-- Update vendor_management config to include Anveo
UPDATE system_config
SET value = jsonb_set(
  value::jsonb,
  '{vendors}',
  (value::jsonb->'vendors') || jsonb_build_array(
    jsonb_build_object(
      'id', 'anveo',
      'name', 'Anveo',
      'type', 'anveo',
      'enabled', true,
      'priority', 1,
      'timeout', 10000,
      'retryAttempts', 3,
      'retryDelay', 1000,
      'config', jsonb_build_object(
        'apiKey', '',
        'baseUrl', 'https://www.anveo.com/api/v1.asp',
        'fromNumber', '',
        'rateLimit', 60
      )
    )
  )
)
WHERE key = 'vendor_management'
AND NOT (value::jsonb->'vendors' @> jsonb_build_array(jsonb_build_object('id', 'anveo')));

-- Also set active vendor to anveo if not already set
INSERT INTO system_config (key, value)
VALUES ('active_sms_vendor', 'anveo')
ON CONFLICT (key) DO NOTHING;

-- Add Anveo API key configs
INSERT INTO system_config (key, value)
VALUES ('anveo_api_key', '')
ON CONFLICT (key) DO NOTHING;

INSERT INTO system_config (key, value)
VALUES ('anveo_from_number', '')
ON CONFLICT (key) DO NOTHING;