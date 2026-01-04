-- Migration: Add job_fetch_reed and job_fetch_adzuna task types to scan_queue
-- Purpose: Enable queue-based job fetching with rate limit compliance
-- Run this in Supabase SQL Editor

-- Step 1: Drop the existing CHECK constraint on task_type
ALTER TABLE scan_queue DROP CONSTRAINT IF EXISTS scan_queue_task_type_check;

-- Step 2: Add new CHECK constraint with job_fetch types
ALTER TABLE scan_queue ADD CONSTRAINT scan_queue_task_type_check
  CHECK (task_type IN (
    'role_variation',
    'expanded_location',
    'industry_search',
    'job_fetch_reed',
    'job_fetch_adzuna'
  ));

-- Step 3: Add columns to icp_profiles for sync tracking (if they don't exist)
ALTER TABLE icp_profiles ADD COLUMN IF NOT EXISTS job_count_reed INTEGER;
ALTER TABLE icp_profiles ADD COLUMN IF NOT EXISTS job_count_adzuna INTEGER;
ALTER TABLE icp_profiles ADD COLUMN IF NOT EXISTS last_full_sync_at TIMESTAMPTZ;

-- Step 4: Create index for job fetch tasks
CREATE INDEX IF NOT EXISTS idx_scan_queue_job_fetch
  ON scan_queue (task_type, status, scheduled_for)
  WHERE task_type IN ('job_fetch_reed', 'job_fetch_adzuna');

-- Step 5: Add Adzuna tracking to api_usage (if not exists)
-- This ensures we can track Adzuna API calls separately from Reed
INSERT INTO api_usage (api_name, api_key_id, date, calls_made)
SELECT 'adzuna', NULL, CURRENT_DATE, 0
WHERE NOT EXISTS (
  SELECT 1 FROM api_usage
  WHERE api_name = 'adzuna' AND api_key_id IS NULL AND date = CURRENT_DATE
);

-- Add comment for documentation
COMMENT ON COLUMN scan_queue.task_type IS 'Task types: role_variation, expanded_location, industry_search, job_fetch_reed, job_fetch_adzuna';
