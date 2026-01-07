-- Migration: Add vendor-specific credit columns
-- Date: 2026-01-07
-- Purpose: Add credits_textbelt and credits_extremesms columns to client_profiles
--          and ensure group_id exists on users table

-- Add vendor-specific credit columns to client_profiles
ALTER TABLE client_profiles 
ADD COLUMN IF NOT EXISTS credits_textbelt NUMERIC(10, 2) NOT NULL DEFAULT 0.00;

ALTER TABLE client_profiles 
ADD COLUMN IF NOT EXISTS credits_extremesms NUMERIC(10, 2) NOT NULL DEFAULT 0.00;

-- Ensure group_id column exists on users table (should already exist from schema)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS group_id TEXT;

-- Create index on group_id if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename = 'users' 
        AND indexname = 'user_group_id_idx'
    ) THEN
        CREATE INDEX user_group_id_idx ON users(group_id);
    END IF;
END $$;

-- Migrate existing 'credits' data to vendor-specific columns
-- (Copy old 'credits' value to 'credits_extremesms' as default, since that was the original vendor)
UPDATE client_profiles 
SET credits_extremesms = COALESCE(credits, 0.00)
WHERE credits_extremesms = 0.00 AND credits > 0.00;

-- Add comment to track migration
COMMENT ON COLUMN client_profiles.credits_textbelt IS 'TextBelt vendor-specific credit balance';
COMMENT ON COLUMN client_profiles.credits_extremesms IS 'ExtremeSMS vendor-specific credit balance';
COMMENT ON COLUMN client_profiles.credits IS 'Legacy credit column (deprecated - use vendor-specific columns)';
