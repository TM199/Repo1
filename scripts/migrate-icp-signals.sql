-- Migration: Associate signals with ICP profiles
-- Purpose: Make all signals ICP-specific so users only see signals matching their profiles

-- Add ICP profile association to company_pain_signals
ALTER TABLE company_pain_signals ADD COLUMN IF NOT EXISTS icp_profile_id UUID REFERENCES icp_profiles(id) ON DELETE CASCADE;

-- Add ICP profile association to signals table (for government/contract signals)
ALTER TABLE signals ADD COLUMN IF NOT EXISTS icp_profile_id UUID REFERENCES icp_profiles(id) ON DELETE CASCADE;

-- Index for efficient querying by ICP profile
CREATE INDEX IF NOT EXISTS idx_company_pain_signals_icp ON company_pain_signals (icp_profile_id, is_active);
CREATE INDEX IF NOT EXISTS idx_signals_icp ON signals (icp_profile_id, is_new);

-- Comments
COMMENT ON COLUMN company_pain_signals.icp_profile_id IS 'Associates pain signal with specific ICP profile. If NULL, signal is from legacy global processing.';
COMMENT ON COLUMN signals.icp_profile_id IS 'Associates signal with specific ICP profile. If NULL, signal is from legacy global processing.';
