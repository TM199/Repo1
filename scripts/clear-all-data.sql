-- Clear all data for fresh testing
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/xjzznsqbfnphlsqhanbd/sql

-- Disable triggers for faster deletion
SET session_replication_role = replica;

-- Clear in dependency order (child tables first)
TRUNCATE TABLE job_observations CASCADE;
TRUNCATE TABLE company_pain_signals CASCADE;
TRUNCATE TABLE job_postings CASCADE;
TRUNCATE TABLE contract_awards CASCADE;
TRUNCATE TABLE signals CASCADE;
TRUNCATE TABLE companies CASCADE;
TRUNCATE TABLE icp_profiles CASCADE;
TRUNCATE TABLE scan_queue CASCADE;
TRUNCATE TABLE api_usage CASCADE;

-- Re-enable triggers
SET session_replication_role = DEFAULT;

-- Verify cleanup
SELECT 'companies' as table_name, COUNT(*) as rows FROM companies
UNION ALL SELECT 'job_postings', COUNT(*) FROM job_postings
UNION ALL SELECT 'job_observations', COUNT(*) FROM job_observations
UNION ALL SELECT 'company_pain_signals', COUNT(*) FROM company_pain_signals
UNION ALL SELECT 'signals', COUNT(*) FROM signals
UNION ALL SELECT 'icp_profiles', COUNT(*) FROM icp_profiles
UNION ALL SELECT 'contract_awards', COUNT(*) FROM contract_awards
ORDER BY table_name;
