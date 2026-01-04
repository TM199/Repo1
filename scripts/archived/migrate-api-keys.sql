-- Migration: API Keys Management
-- Purpose: Support multiple Reed API keys for scaling beyond 3 ICP profiles

-- Store user API keys (encrypted)
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,  -- References auth.users in Supabase
    api_name TEXT NOT NULL DEFAULT 'reed',
    api_key_encrypted TEXT NOT NULL,  -- Store encrypted, decrypt at runtime
    label TEXT,  -- User-friendly label, e.g., "Reed Account 2"
    daily_limit INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT true,
    is_unlimited BOOLEAN DEFAULT false,  -- For future paid tier
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys (user_id, api_name, is_active);

-- Track which ICP profiles use which API key
ALTER TABLE icp_profiles ADD COLUMN IF NOT EXISTS api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL;

-- Update api_usage to reference api_keys
ALTER TABLE api_usage ADD CONSTRAINT fk_api_usage_key
    FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE;

-- Function to count available ICP slots for a user
CREATE OR REPLACE FUNCTION get_icp_slots(p_user_id UUID)
RETURNS TABLE(used INTEGER, total INTEGER, remaining INTEGER) AS $$
DECLARE
    v_key_count INTEGER;
    v_profile_count INTEGER;
    v_total_slots INTEGER;
BEGIN
    -- Count active API keys (minimum 1 for default env key)
    SELECT COALESCE(COUNT(*), 0) INTO v_key_count
    FROM api_keys
    WHERE user_id = p_user_id AND is_active = true;

    -- If no user keys, assume 1 default key from env
    v_key_count := GREATEST(v_key_count, 1);

    -- Count active ICP profiles
    SELECT COALESCE(COUNT(*), 0) INTO v_profile_count
    FROM icp_profiles
    WHERE user_id = p_user_id AND is_active = true;

    -- 3 slots per key
    v_total_slots := v_key_count * 3;

    RETURN QUERY SELECT
        v_profile_count AS used,
        v_total_slots AS total,
        GREATEST(0, v_total_slots - v_profile_count) AS remaining;
END;
$$ LANGUAGE plpgsql;

-- Function to check if user can create another ICP profile
CREATE OR REPLACE FUNCTION can_create_icp_profile(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_remaining INTEGER;
BEGIN
    SELECT remaining INTO v_remaining FROM get_icp_slots(p_user_id);
    RETURN v_remaining > 0;
END;
$$ LANGUAGE plpgsql;

-- RLS policies for api_keys
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own API keys"
    ON api_keys FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own API keys"
    ON api_keys FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own API keys"
    ON api_keys FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own API keys"
    ON api_keys FOR DELETE
    USING (auth.uid() = user_id);

-- Comments
COMMENT ON TABLE api_keys IS 'User-provided API keys for Reed/other services. Each key allows 3 ICP profiles.';
COMMENT ON FUNCTION get_icp_slots IS 'Returns used/total/remaining ICP profile slots for a user. 3 slots per API key.';
COMMENT ON FUNCTION can_create_icp_profile IS 'Returns true if user has available ICP profile slots.';
