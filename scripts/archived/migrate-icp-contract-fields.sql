-- Migration: Add contract/tender configuration fields to icp_profiles
-- Run this in Supabase SQL Editor

-- Add contract configuration fields
ALTER TABLE icp_profiles ADD COLUMN IF NOT EXISTS min_contract_value INTEGER;
ALTER TABLE icp_profiles ADD COLUMN IF NOT EXISTS contract_sectors TEXT[] DEFAULT '{}';
ALTER TABLE icp_profiles ADD COLUMN IF NOT EXISTS contract_keywords TEXT[] DEFAULT '{}';

-- Add comment explaining fields
COMMENT ON COLUMN icp_profiles.min_contract_value IS 'Minimum contract value in GBP (e.g., 50000, 100000, 500000, 1000000)';
COMMENT ON COLUMN icp_profiles.contract_sectors IS 'Contract sectors to track: public, private';
COMMENT ON COLUMN icp_profiles.contract_keywords IS 'Keywords to match in contract title/description';

-- Verify the changes
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'icp_profiles'
ORDER BY ordinal_position;
