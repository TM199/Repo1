-- Migration: Scan Queue System
-- Purpose: Add queue table for background ICP scan expansion + status tracking on profiles

-- Queue table for background scan expansion tasks
CREATE TABLE IF NOT EXISTS scan_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    icp_profile_id UUID REFERENCES icp_profiles(id) ON DELETE CASCADE,
    batch_id UUID NOT NULL,

    -- Task specification
    task_type TEXT NOT NULL CHECK (task_type IN ('role_variation', 'expanded_location', 'industry_search')),
    keywords TEXT NOT NULL,
    location TEXT NOT NULL,

    -- Status tracking
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
    priority INTEGER DEFAULT 0,  -- Higher = more important
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,

    -- Results
    jobs_found INTEGER DEFAULT 0,
    error_message TEXT,

    -- Timing
    created_at TIMESTAMPTZ DEFAULT NOW(),
    scheduled_for TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- Indexes for efficient queue processing
CREATE INDEX IF NOT EXISTS idx_scan_queue_pending ON scan_queue (status, scheduled_for)
    WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_scan_queue_batch ON scan_queue (batch_id);
CREATE INDEX IF NOT EXISTS idx_scan_queue_profile ON scan_queue (icp_profile_id);

-- Add scan status columns to ICP profiles
ALTER TABLE icp_profiles ADD COLUMN IF NOT EXISTS scan_status TEXT DEFAULT 'idle';
ALTER TABLE icp_profiles ADD COLUMN IF NOT EXISTS scan_batch_id UUID;
ALTER TABLE icp_profiles ADD COLUMN IF NOT EXISTS scan_progress JSONB;
-- scan_progress structure: { "jobs_found": 150, "tasks_pending": 45, "tasks_completed": 10 }

-- Add comment for documentation
COMMENT ON TABLE scan_queue IS 'Background queue for ICP scan expansion tasks. Processed by /api/cron/process-scan-queue every 15 minutes.';
COMMENT ON COLUMN icp_profiles.scan_status IS 'Status of ICP scan: idle, scanning, expanding, completed, failed';
COMMENT ON COLUMN icp_profiles.scan_progress IS 'JSON with scan progress: jobs_found, tasks_pending, tasks_completed';
