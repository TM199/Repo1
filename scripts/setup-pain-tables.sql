-- Signal Mentis v2.0 - Pain Signal Tables Setup
-- Run this in Supabase SQL Editor
-- This is ADDITIVE - does not modify existing tables except adding company_id to signals

-- ============================================
-- 1. COMPANIES MASTER TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    name_normalized TEXT NOT NULL,
    domain TEXT,
    companies_house_number TEXT UNIQUE,
    sic_codes TEXT[],
    registered_address TEXT,
    industry TEXT,
    employee_count_estimate INTEGER,
    region TEXT,
    hiring_pain_score INTEGER DEFAULT 0,
    pain_score_updated_at TIMESTAMPTZ,
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companies_name_normalized ON companies (name_normalized);
CREATE INDEX IF NOT EXISTS idx_companies_domain ON companies (domain);
CREATE INDEX IF NOT EXISTS idx_companies_ch_number ON companies (companies_house_number);
CREATE INDEX IF NOT EXISTS idx_companies_pain_score ON companies (hiring_pain_score DESC);
CREATE INDEX IF NOT EXISTS idx_companies_industry ON companies (industry);
CREATE INDEX IF NOT EXISTS idx_companies_region ON companies (region);
CREATE INDEX IF NOT EXISTS idx_companies_name_fts ON companies USING gin(to_tsvector('english', name));

-- ============================================
-- 2. JOB POSTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS job_postings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id),
    reed_job_id TEXT,
    adzuna_job_id TEXT,
    fingerprint TEXT NOT NULL,
    title TEXT NOT NULL,
    title_normalized TEXT NOT NULL,
    location TEXT,
    location_normalized TEXT,
    salary_min INTEGER,
    salary_max INTEGER,
    salary_type TEXT,
    salary_normalized_annual INTEGER,
    contract_type TEXT,
    industry TEXT,
    source TEXT NOT NULL,
    source_url TEXT,
    original_posted_date DATE NOT NULL,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    -- NOTE: days_open is calculated dynamically in queries as (CURRENT_DATE - original_posted_date)
    -- PostgreSQL doesn't allow non-immutable expressions in generated columns
    repost_count INTEGER DEFAULT 0,
    previous_posting_id UUID REFERENCES job_postings(id),
    salary_increase_from_previous INTEGER,
    mentions_referral_bonus BOOLEAN DEFAULT FALSE,
    referral_bonus_amount INTEGER,
    is_contractor_to_perm BOOLEAN DEFAULT FALSE,
    raw_description TEXT,
    employer_name_from_source TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_postings_fingerprint ON job_postings (fingerprint);
CREATE INDEX IF NOT EXISTS idx_job_postings_company ON job_postings (company_id);
CREATE INDEX IF NOT EXISTS idx_job_postings_posted_date ON job_postings (original_posted_date ASC) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_job_postings_source ON job_postings (source, source_url);
CREATE INDEX IF NOT EXISTS idx_job_postings_reed_id ON job_postings (reed_job_id) WHERE reed_job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_job_postings_adzuna_id ON job_postings (adzuna_job_id) WHERE adzuna_job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_job_postings_active ON job_postings (is_active, last_seen_at);
CREATE INDEX IF NOT EXISTS idx_job_postings_repost ON job_postings (repost_count DESC) WHERE repost_count > 0;
CREATE INDEX IF NOT EXISTS idx_job_postings_industry ON job_postings (industry);

CREATE UNIQUE INDEX IF NOT EXISTS idx_job_postings_source_unique
ON job_postings (source, COALESCE(reed_job_id, adzuna_job_id, source_url));

-- ============================================
-- 3. JOB OBSERVATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS job_observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_posting_id UUID NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
    observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    salary_min INTEGER,
    salary_max INTEGER,
    was_active BOOLEAN DEFAULT TRUE,
    source_response JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_observations_posting ON job_observations (job_posting_id, observed_at DESC);

-- ============================================
-- 4. CONTRACT AWARDS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS contract_awards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id),
    contracts_finder_id TEXT UNIQUE,
    find_a_tender_id TEXT UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    value_gbp NUMERIC(15,2),
    buyer_organisation TEXT,
    award_date DATE NOT NULL,
    start_date DATE,
    end_date DATE,
    category TEXT,
    industry TEXT,
    region TEXT,
    jobs_posted_within_30_days INTEGER DEFAULT 0,
    jobs_posted_within_60_days INTEGER DEFAULT 0,
    jobs_posted_within_90_days INTEGER DEFAULT 0,
    hiring_bottleneck_flag BOOLEAN DEFAULT FALSE,
    source TEXT NOT NULL,
    source_url TEXT,
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contract_awards_company ON contract_awards (company_id);
CREATE INDEX IF NOT EXISTS idx_contract_awards_date ON contract_awards (award_date DESC);
CREATE INDEX IF NOT EXISTS idx_contract_awards_bottleneck ON contract_awards (hiring_bottleneck_flag)
WHERE hiring_bottleneck_flag = TRUE;
CREATE INDEX IF NOT EXISTS idx_contract_awards_value ON contract_awards (value_gbp DESC);

-- ============================================
-- 5. COMPANY PAIN SIGNALS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS company_pain_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    pain_signal_type TEXT NOT NULL,
    source_job_posting_id UUID REFERENCES job_postings(id),
    source_contract_id UUID REFERENCES contract_awards(id),
    signal_title TEXT NOT NULL,
    signal_detail TEXT,
    signal_value INTEGER,
    pain_score_contribution INTEGER NOT NULL,
    urgency TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    resolved_at TIMESTAMPTZ,
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_pain_company ON company_pain_signals (company_id);
CREATE INDEX IF NOT EXISTS idx_company_pain_type ON company_pain_signals (pain_signal_type);
CREATE INDEX IF NOT EXISTS idx_company_pain_active ON company_pain_signals (is_active, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_company_pain_urgency ON company_pain_signals (urgency, is_active);

-- ============================================
-- 6. ADD COMPANY_ID TO EXISTING SIGNALS TABLE
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'signals' AND column_name = 'company_id'
    ) THEN
        ALTER TABLE signals ADD COLUMN company_id UUID REFERENCES companies(id);
        CREATE INDEX idx_signals_company ON signals (company_id);
    END IF;
END $$;

-- ============================================
-- 7. ROW LEVEL SECURITY (Match existing patterns)
-- ============================================
-- Note: Using service_role for cron jobs, so policies allow full access

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_postings ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_awards ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_pain_signals ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (for cron jobs)
CREATE POLICY "Service role has full access to companies" ON companies
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to job_postings" ON job_postings
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to job_observations" ON job_observations
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to contract_awards" ON contract_awards
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to company_pain_signals" ON company_pain_signals
    FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- DONE
-- ============================================
-- After running this, tables will be ready for use
-- Run migration script later to link existing signals to companies
