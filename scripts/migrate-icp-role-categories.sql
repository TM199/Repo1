-- Migration: Add role_categories and employment_type to icp_profiles
-- Run this in Supabase SQL Editor

-- Add role_categories column (stores team/department selections)
ALTER TABLE icp_profiles ADD COLUMN IF NOT EXISTS role_categories TEXT[] DEFAULT '{}';

-- Add employment_type column (permanent, contract, or both)
ALTER TABLE icp_profiles ADD COLUMN IF NOT EXISTS employment_type TEXT DEFAULT 'both';

-- Add constraint for valid employment_type values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'icp_profiles_employment_type_check'
  ) THEN
    ALTER TABLE icp_profiles
    ADD CONSTRAINT icp_profiles_employment_type_check
    CHECK (employment_type IN ('permanent', 'contract', 'both'));
  END IF;
END $$;

-- Verify the columns were added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'icp_profiles'
AND column_name IN ('role_categories', 'employment_type');
