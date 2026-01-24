-- Override warming limit for testing tonight
UPDATE anveo_numbers 
SET daily_limit = 1500, status = 'active' 
WHERE phone_number = '+17204398855';

SELECT phone_number, status, daily_limit, sent_today 
FROM anveo_numbers;
