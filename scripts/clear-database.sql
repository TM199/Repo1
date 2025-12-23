-- Clear all data from Signal Mentis tables for clean testing
-- Run this in Supabase SQL Editor
-- Note: This preserves table structure and auth.users

-- Disable triggers temporarily for faster deletion
SET session_replication_role = replica;

-- Clear in dependency order (child tables first)

-- Search-related tables
TRUNCATE TABLE search_results CASCADE;
TRUNCATE TABLE search_profiles CASCADE;

-- Job/Company pain tables (in dependency order)
TRUNCATE TABLE job_observations CASCADE;
TRUNCATE TABLE job_postings CASCADE;
TRUNCATE TABLE contract_awards CASCADE;
TRUNCATE TABLE company_pain_signals CASCADE;
TRUNCATE TABLE companies CASCADE;

-- Signals table
TRUNCATE TABLE signals CASCADE;

-- ICP Profiles (new system - start fresh)
TRUNCATE TABLE icp_profiles CASCADE;

-- Re-enable triggers
SET session_replication_role = DEFAULT;

-- Verify cleanup
SELECT 'search_profiles' as table_name, COUNT(*) as rows FROM search_profiles
UNION ALL SELECT 'search_results', COUNT(*) FROM search_results
UNION ALL SELECT 'companies', COUNT(*) FROM companies
UNION ALL SELECT 'job_postings', COUNT(*) FROM job_postings
UNION ALL SELECT 'job_observations', COUNT(*) FROM job_observations
UNION ALL SELECT 'contract_awards', COUNT(*) FROM contract_awards
UNION ALL SELECT 'company_pain_signals', COUNT(*) FROM company_pain_signals
UNION ALL SELECT 'signals', COUNT(*) FROM signals
UNION ALL SELECT 'icp_profiles', COUNT(*) FROM icp_profiles;
