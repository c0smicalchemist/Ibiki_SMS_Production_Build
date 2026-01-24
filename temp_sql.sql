DELETE FROM system_config WHERE key = 'vendor_management';
DELETE FROM vendor_api_key_pool WHERE vendor = 'anveo';
INSERT INTO vendor_api_key_pool (vendor, api_key, name, is_active, priority, from_number) VALUES 
  ('anveo', 'e601cd693610f9a621d46e92e5ac3752fc865c55', 'Anveo NY #1 +19144080890', true, 1, '19144080890'),
  ('anveo', 'e601cd693610f9a621d46e92e5ac3752fc865c55', 'Anveo NY #2 +19144080870', true, 2, '19144080870'),
  ('anveo', 'e601cd693610f9a621d46e92e5ac3752fc865c55', 'Anveo FL #3 +19046409006', true, 3, '19046409006');
UPDATE system_config SET value = 'anveo' WHERE key = 'active_sms_vendor';
