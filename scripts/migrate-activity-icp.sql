-- Add icp_profile_id to system_activity table for user-specific filtering
-- This allows activity feed to show only activities relevant to the logged-in user

-- Add the column (nullable to support legacy/global activities)
ALTER TABLE system_activity
ADD COLUMN IF NOT EXISTS icp_profile_id UUID REFERENCES icp_profiles(id) ON DELETE SET NULL;

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_system_activity_icp_profile_id
ON system_activity(icp_profile_id);

-- Optional: Create composite index for the common query pattern
CREATE INDEX IF NOT EXISTS idx_system_activity_icp_created
ON system_activity(icp_profile_id, created_at DESC);
