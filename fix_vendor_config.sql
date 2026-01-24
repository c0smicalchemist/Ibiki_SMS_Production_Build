-- Fix vendor_management configuration
-- This uses 'custom' type for Anveo since 'anveo' is not in the schema

DELETE FROM system_config WHERE key = 'vendor_management';

INSERT INTO system_config (key, value) VALUES (
  'vendor_management',
  '{"activeVendorId":"anveo","vendors":[{"id":"textbelt","name":"TextBelt","type":"textbelt","enabled":true,"priority":2,"config":{"apiKey":"a30321d80c30ac142e640dc2d1a2aa4c3dde81d8DhHW1zKrWnE4QZDyr1RQsH04t","baseUrl":"https://textbelt.com","maxRecipients":1,"rateLimit":75}},{"id":"anveo","name":"Anveo","type":"custom","enabled":true,"priority":1,"config":{"apiKey":"e601cd693610f9a621d46e92e5ac3752fc865c55","baseUrl":"https://www.anveo.com/api/v1.asp","fromNumber":"from_pool","rateLimit":60}}],"switchingConfig":{"strategy":"manual","fallbackEnabled":true,"healthCheckInterval":30000,"failureThreshold":3,"recoveryTime":300000,"costOptimization":false,"regionBased":false},"vendorStates":{}}'
);
