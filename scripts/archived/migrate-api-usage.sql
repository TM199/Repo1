-- Migration: API Usage Tracking
-- Purpose: Track daily API usage to respect rate limits (100 calls/day for Reed free tier)

CREATE TABLE IF NOT EXISTS api_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_name TEXT NOT NULL,  -- 'reed', 'adzuna', etc.
    api_key_id UUID,  -- NULL for default env key, references api_keys(id) for user keys
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    calls_made INTEGER DEFAULT 0,
    calls_limit INTEGER DEFAULT 100,
    last_call_at TIMESTAMPTZ,

    UNIQUE(api_name, api_key_id, date)
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_api_usage_lookup ON api_usage (api_name, api_key_id, date);

-- Function to check if we can make an API call and increment usage
CREATE OR REPLACE FUNCTION check_and_increment_api_usage(
    p_api_name TEXT,
    p_api_key_id UUID DEFAULT NULL,
    p_daily_limit INTEGER DEFAULT 100
)
RETURNS TABLE(allowed BOOLEAN, remaining INTEGER, current_count INTEGER) AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Upsert the usage record and increment
    INSERT INTO api_usage (api_name, api_key_id, date, calls_made, calls_limit, last_call_at)
    VALUES (p_api_name, p_api_key_id, CURRENT_DATE, 1, p_daily_limit, NOW())
    ON CONFLICT (api_name, api_key_id, date)
    DO UPDATE SET
        calls_made = api_usage.calls_made + 1,
        last_call_at = NOW()
    RETURNING calls_made INTO v_count;

    -- Return result
    RETURN QUERY SELECT
        v_count <= p_daily_limit AS allowed,
        GREATEST(0, p_daily_limit - v_count) AS remaining,
        v_count AS current_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get remaining calls without incrementing
CREATE OR REPLACE FUNCTION get_remaining_api_calls(
    p_api_name TEXT,
    p_api_key_id UUID DEFAULT NULL,
    p_daily_limit INTEGER DEFAULT 100
)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COALESCE(calls_made, 0) INTO v_count
    FROM api_usage
    WHERE api_name = p_api_name
      AND (api_key_id = p_api_key_id OR (api_key_id IS NULL AND p_api_key_id IS NULL))
      AND date = CURRENT_DATE;

    RETURN GREATEST(0, p_daily_limit - COALESCE(v_count, 0));
END;
$$ LANGUAGE plpgsql;

-- Add comments
COMMENT ON TABLE api_usage IS 'Daily API call tracking for rate limiting. Tracks calls per API per day.';
COMMENT ON FUNCTION check_and_increment_api_usage IS 'Atomically checks if API call is allowed and increments counter. Returns allowed, remaining, current_count.';
