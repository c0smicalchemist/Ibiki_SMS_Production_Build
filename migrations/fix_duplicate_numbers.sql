-- Fix duplicate phone numbers and enforce E.164 format
-- Transfer API key links and better settings from non-+ versions to + versions

-- Update +19144080890 with settings from 19144080890
UPDATE anveo_numbers 
SET 
  api_key_id = '31e13beb-a1d5-42a7-8483-baaf19348428',
  status = 'active',
  daily_limit = 350
WHERE phone_number = '+19144080890';

-- Update +19144080870 with settings from 19144080870
UPDATE anveo_numbers 
SET 
  api_key_id = '31e13beb-a1d5-42a7-8483-baaf19348428',
  status = 'active',
  daily_limit = 350
WHERE phone_number = '+19144080870';

-- Update +19046409006 with settings from 19046409006
UPDATE anveo_numbers 
SET 
  api_key_id = '31e13beb-a1d5-42a7-8483-baaf19348428',
  status = 'active',
  daily_limit = 150
WHERE phone_number = '+19046409006';

-- Delete duplicates without + prefix
DELETE FROM anveo_numbers WHERE phone_number IN ('19144080890', '19144080870', '19046409006');

-- Add CHECK constraint to enforce E.164 format (must start with +)
ALTER TABLE anveo_numbers 
ADD CONSTRAINT phone_number_e164_format 
CHECK (phone_number ~ '^\+[1-9][0-9]{1,14}$');

-- Verify results
SELECT id, phone_number, status, daily_limit, api_key_id 
FROM anveo_numbers 
ORDER BY phone_number;
