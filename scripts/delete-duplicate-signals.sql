-- Delete Duplicate Signals Script
-- Run this in Supabase SQL Editor
-- This keeps the OLDEST signal for each unique combination

-- Step 1: Preview duplicates (run this first to see what will be deleted)
WITH duplicates AS (
  SELECT
    id,
    company_id,
    source_contract_id,
    source_job_posting_id,
    pain_signal_type,
    icp_profile_id,
    detected_at,
    ROW_NUMBER() OVER (
      PARTITION BY company_id, COALESCE(source_contract_id, ''), COALESCE(source_job_posting_id, ''), pain_signal_type, icp_profile_id
      ORDER BY detected_at ASC
    ) as rn
  FROM company_pain_signals
  WHERE is_active = true
)
SELECT
  COUNT(*) FILTER (WHERE rn > 1) as duplicates_to_delete,
  COUNT(*) FILTER (WHERE rn = 1) as signals_to_keep,
  COUNT(*) as total_signals
FROM duplicates;

-- Step 2: Delete duplicates (keeping oldest)
-- UNCOMMENT AND RUN AFTER VERIFYING STEP 1
/*
DELETE FROM company_pain_signals
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY company_id, COALESCE(source_contract_id, ''), COALESCE(source_job_posting_id, ''), pain_signal_type, icp_profile_id
        ORDER BY detected_at ASC
      ) as rn
    FROM company_pain_signals
    WHERE is_active = true
  ) ranked
  WHERE rn > 1
);
*/

-- Step 3: Recalculate pain scores for all companies with signals
-- UNCOMMENT AND RUN AFTER STEP 2
/*
UPDATE companies c
SET
  hiring_pain_score = LEAST(COALESCE(scores.total_score, 0), 100),
  pain_score_updated_at = NOW()
FROM (
  SELECT
    company_id,
    SUM(pain_score_contribution) as total_score
  FROM company_pain_signals
  WHERE is_active = true
  GROUP BY company_id
) scores
WHERE c.id = scores.company_id;
*/

-- Step 4: Verify no duplicates remain
-- Run this after cleanup to confirm
/*
SELECT
  company_id,
  source_contract_id,
  source_job_posting_id,
  pain_signal_type,
  icp_profile_id,
  COUNT(*) as count
FROM company_pain_signals
WHERE is_active = true
GROUP BY company_id, source_contract_id, source_job_posting_id, pain_signal_type, icp_profile_id
HAVING COUNT(*) > 1;
*/
