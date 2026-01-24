-- Add credits_anveo column to client_profiles table
ALTER TABLE client_profiles 
ADD COLUMN IF NOT EXISTS credits_anveo DECIMAL(10, 2) NOT NULL DEFAULT 0.00;

-- Copy existing credits to credits_anveo for all users
-- This ensures existing users have their credits in the new column
UPDATE client_profiles 
SET credits_anveo = credits 
WHERE credits_anveo = 0.00 AND credits > 0.00;
