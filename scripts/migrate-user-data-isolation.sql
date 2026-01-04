-- ========================================
-- CRITICAL: User Data Isolation Migration
-- ========================================
-- This migration adds user_id to companies table to prevent:
-- 1. Data theft (users seeing other users' enrichments)
-- 2. Data loss (one user deleting another user's paid data)
-- 3. Business model violations
--
-- After this migration:
-- - Each user has their own company records
-- - Contacts are isolated per user
-- - Deleting ICP doesn't delete companies (user might recreate)
-- - Deleting USER deletes their companies (CASCADE)

-- Step 1: Add user_id column to companies (nullable first)
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 2: Backfill user_id from existing company_pain_signals
-- Get user_id from the ICP profile that created the signal
UPDATE companies c
SET user_id = (
  SELECT icp.user_id
  FROM company_pain_signals cps
  JOIN icp_profiles icp ON icp.id = cps.icp_profile_id
  WHERE cps.company_id = c.id
  ORDER BY cps.created_at ASC
  LIMIT 1
)
WHERE user_id IS NULL;

-- Step 3: Handle orphaned companies (companies without signals)
-- First, NULL out foreign key references for companies that will be deleted
-- (These are old records from before the refactoring that linked to shared companies)

-- NULL out job_postings.company_id
UPDATE job_postings
SET company_id = NULL
WHERE company_id IN (
  SELECT id FROM companies WHERE user_id IS NULL
);

-- NULL out contract_awards.company_id
UPDATE contract_awards
SET company_id = NULL
WHERE company_id IN (
  SELECT id FROM companies WHERE user_id IS NULL
);

-- Now delete orphaned companies (no foreign key violations)
DELETE FROM companies WHERE user_id IS NULL;

-- Option B: Keep them and assign to a default user (if needed)
-- UPDATE companies SET user_id = 'DEFAULT_USER_UUID' WHERE user_id IS NULL;

-- Step 4: Make user_id required
ALTER TABLE companies
ALTER COLUMN user_id SET NOT NULL;

-- Step 5: Add index for performance
CREATE INDEX IF NOT EXISTS idx_companies_user_id ON companies(user_id);
CREATE INDEX IF NOT EXISTS idx_companies_user_domain ON companies(user_id, domain);

-- Step 6: Update RLS policies for user isolation
-- Drop old service role policy (will recreate)
DROP POLICY IF EXISTS "Service role has full access to companies" ON companies;

-- Users can only see their own companies
DROP POLICY IF EXISTS "Users can view their own companies" ON companies;
CREATE POLICY "Users can view their own companies"
  ON companies FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only create their own companies
DROP POLICY IF EXISTS "Users can create their own companies" ON companies;
CREATE POLICY "Users can create their own companies"
  ON companies FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own companies
DROP POLICY IF EXISTS "Users can update their own companies" ON companies;
CREATE POLICY "Users can update their own companies"
  ON companies FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can only delete their own companies
DROP POLICY IF EXISTS "Users can delete their own companies" ON companies;
CREATE POLICY "Users can delete their own companies"
  ON companies FOR DELETE
  USING (auth.uid() = user_id);

-- Service role still needs full access (for cron jobs and signal generation)
CREATE POLICY "Service role has full access to companies"
  ON companies FOR ALL
  USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  )
  WITH CHECK (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

-- Step 7: Verification queries
-- Run these after migration to verify:

-- Count companies per user
-- SELECT user_id, COUNT(*) as company_count
-- FROM companies
-- GROUP BY user_id
-- ORDER BY company_count DESC;

-- Check for any NULL user_ids (should be 0)
-- SELECT COUNT(*) FROM companies WHERE user_id IS NULL;

-- Verify RLS is working (run as authenticated user)
-- SELECT COUNT(*) FROM companies; -- Should only see your companies

COMMENT ON COLUMN companies.user_id IS 'Owner of this company record. Each user has isolated company data to prevent data theft and accidental deletion of paid enrichments.';
