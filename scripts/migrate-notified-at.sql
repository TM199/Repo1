-- Add notified_at column to track which signals have been included in email notifications
-- Run this in Supabase SQL Editor

ALTER TABLE company_pain_signals
ADD COLUMN IF NOT EXISTS notified_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create index for efficient querying of un-notified signals
CREATE INDEX IF NOT EXISTS idx_company_pain_signals_notified
ON company_pain_signals (icp_profile_id, is_active, notified_at)
WHERE is_active = TRUE AND notified_at IS NULL;

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'company_pain_signals'
AND column_name = 'notified_at';
