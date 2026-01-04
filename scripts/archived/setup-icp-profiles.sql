-- ICP Profiles Table
-- Stores user's Ideal Client Profile configuration for signal filtering and data collection

CREATE TABLE IF NOT EXISTS icp_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,

  -- Industry & Roles
  industries TEXT[] DEFAULT '{}',
  specific_roles TEXT[] DEFAULT '{}',
  seniority_levels TEXT[] DEFAULT '{}',

  -- Locations
  locations TEXT[] DEFAULT '{}',

  -- Signal Types to Track
  -- Options: 'job_pain', 'contracts_awarded', 'tenders', 'planning', 'leadership', 'funding'
  signal_types TEXT[] DEFAULT '{}',

  -- Company Filters
  company_size_min INTEGER,
  company_size_max INTEGER,
  exclude_keywords TEXT[] DEFAULT '{}',

  -- Data Pull Configuration
  pull_frequency TEXT DEFAULT 'daily' CHECK (pull_frequency IN ('hourly', 'every_4h', 'daily', 'weekly')),
  is_active BOOLEAN DEFAULT TRUE,
  last_synced_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for user lookups
CREATE INDEX IF NOT EXISTS idx_icp_profiles_user_id ON icp_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_icp_profiles_active ON icp_profiles(user_id, is_active) WHERE is_active = TRUE;

-- Enable RLS
ALTER TABLE icp_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own ICP profiles"
  ON icp_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own ICP profiles"
  ON icp_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ICP profiles"
  ON icp_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own ICP profiles"
  ON icp_profiles FOR DELETE
  USING (auth.uid() = user_id);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_icp_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_icp_profiles_updated_at
  BEFORE UPDATE ON icp_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_icp_profiles_updated_at();
