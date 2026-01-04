-- Signal Mentis - Search Profiles Table Setup
-- Run this in Supabase SQL Editor

-- ============================================
-- SEARCH PROFILES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS search_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    industry TEXT,
    role_categories TEXT[] DEFAULT '{}',
    specific_roles TEXT[] DEFAULT '{}',
    seniority_levels TEXT[] DEFAULT '{}',
    locations TEXT[] DEFAULT '{}',
    signal_types TEXT[] DEFAULT '{}',
    target_company_types TEXT,
    additional_keywords TEXT[] DEFAULT '{}',
    excluded_keywords TEXT[] DEFAULT '{}',
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    last_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_search_profiles_user ON search_profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_search_profiles_active ON search_profiles (is_active, user_id);

-- Row Level Security
ALTER TABLE search_profiles ENABLE ROW LEVEL SECURITY;

-- Users can only access their own profiles
CREATE POLICY "Users can view own search profiles" ON search_profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own search profiles" ON search_profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own search profiles" ON search_profiles
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own search profiles" ON search_profiles
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- SEARCH RESULTS TABLE (for caching results)
-- ============================================
CREATE TABLE IF NOT EXISTS search_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    search_profile_id UUID NOT NULL REFERENCES search_profiles(id) ON DELETE CASCADE,
    signal_id UUID REFERENCES signals(id),
    company_pain_signal_id UUID REFERENCES company_pain_signals(id),
    relevance_score INTEGER DEFAULT 0,
    is_dismissed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_search_results_profile ON search_results (search_profile_id);
CREATE INDEX IF NOT EXISTS idx_search_results_dismissed ON search_results (is_dismissed, search_profile_id);

-- Row Level Security for search results
ALTER TABLE search_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view search results for own profiles" ON search_results
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM search_profiles
            WHERE search_profiles.id = search_results.search_profile_id
            AND search_profiles.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can modify search results for own profiles" ON search_results
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM search_profiles
            WHERE search_profiles.id = search_results.search_profile_id
            AND search_profiles.user_id = auth.uid()
        )
    );

-- ============================================
-- DONE
-- ============================================
