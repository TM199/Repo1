-- System Activity Table for Dashboard Activity Feed
-- Run this in Supabase SQL Editor

-- Create the system_activity table
CREATE TABLE IF NOT EXISTS system_activity (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL, -- 'signals_detected', 'jobs_synced', 'classification_complete', 'contracts_synced', etc.
  title TEXT NOT NULL,
  detail TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for efficient sorting by created_at
CREATE INDEX IF NOT EXISTS idx_system_activity_created ON system_activity(created_at DESC);

-- Add table to Supabase realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE system_activity;

-- Optional: Add retention policy to auto-delete old entries (keep last 7 days)
-- This prevents the table from growing indefinitely
CREATE OR REPLACE FUNCTION cleanup_old_activities()
RETURNS void AS $$
BEGIN
  DELETE FROM system_activity WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Grant access for authenticated users (read only)
GRANT SELECT ON system_activity TO authenticated;

-- Grant all access for service role (for Inngest functions)
GRANT ALL ON system_activity TO service_role;
