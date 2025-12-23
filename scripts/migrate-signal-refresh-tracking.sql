-- Migration: Add days_since_refresh tracking to company_pain_signals
-- This enables the hard_to_fill vs stale signal distinction

-- Add days_since_refresh column to track when signals were last refreshed
ALTER TABLE company_pain_signals
ADD COLUMN IF NOT EXISTS days_since_refresh INTEGER;

-- Add comment explaining the column
COMMENT ON COLUMN company_pain_signals.days_since_refresh IS
  'Days since the source job was last seen in scrapes. Used to distinguish hard_to_fill (low value = active) from stale (high value = abandoned).';

-- Create index for filtering by refresh status
CREATE INDEX IF NOT EXISTS idx_pain_signals_refresh
ON company_pain_signals (days_since_refresh)
WHERE is_active = TRUE;

-- Update existing signals to have a reasonable days_since_refresh value
-- For existing stale_job signals, estimate based on when they were detected
UPDATE company_pain_signals
SET days_since_refresh = COALESCE(
  EXTRACT(DAY FROM (NOW() - detected_at))::INTEGER,
  30
)
WHERE days_since_refresh IS NULL
AND pain_signal_type LIKE 'stale_job%';

-- Note: Run this migration in Supabase SQL Editor
-- After running, the generate-pain-signals cron will populate this correctly
