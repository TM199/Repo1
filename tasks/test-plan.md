# Database Reset & Test Plan

## Tables to Clear

| Table | Purpose | Clear? |
|-------|---------|--------|
| `job_postings` | Stored jobs from Reed/Adzuna | YES |
| `company_pain_signals` | Detected pain signals | YES |
| `scan_queue` | Task queue (job_fetch_reed, job_fetch_adzuna) | YES |
| `api_usage` | Rate limit tracking | YES |
| `companies` | Company records | YES (jobs reference them) |
| `icp_profiles` | User ICP configurations | NO (keep for testing) |

## Test Steps

1. **Clear all tables above**
2. **Queue tasks for James Chase 2 ICP only**
3. **Process tasks in batches**
4. **Verify results**

## Expected Results

- James Chase 2 ICP has 9 roles × 3 locations = 27 Reed + 27 Adzuna = 54 tasks
- Each task fetches ~50 jobs
- Jobs should be inserted (no duplicate detection since DB is clean)
- Pain signals should be generated for jobs meeting criteria:
  - `hard_to_fill_30`: Job open > 30 days
  - `hard_to_fill_60`: Job open > 60 days
  - `hard_to_fill_90`: Job open > 90 days
  - `repost`: Job reposted
  - `salary_increase`: Salary increased from previous posting
  - `referral_bonus`: Job mentions referral bonus

## Verification Queries

```sql
-- Total jobs
SELECT COUNT(*) FROM job_postings;

-- Jobs by source
SELECT source, COUNT(*) FROM job_postings GROUP BY source;

-- Pain signals by type
SELECT pain_signal_type, COUNT(*) FROM company_pain_signals GROUP BY pain_signal_type;

-- Signals for James Chase 2 ICP
SELECT pain_signal_type, COUNT(*)
FROM company_pain_signals
WHERE icp_profile_id = '9f45f3ff-9be8-4cd8-885b-2348058b1fe1'
GROUP BY pain_signal_type;
```
