# Implementation Prompts for Signal Deduplication & Job Queue Fix

Use these prompts in separate Claude Code chat windows to implement the fix in phases.

---

## Pre-requisites

Before starting, ensure you have read:
- `tasks/ui-ux-overhaul-implementation.md` - Project context
- `/Users/trisdenmills/.claude/plans/wiggly-kindling-origami.md` - Full analysis plan

---

## PHASE 1A: Database Migration (Manual Step)

**Run this SQL in Supabase Dashboard:**

```sql
-- Step 1: Clean up existing duplicate contract signals (keep oldest)
DELETE FROM company_pain_signals a
USING company_pain_signals b
WHERE a.id > b.id
  AND a.company_id = b.company_id
  AND a.source_contract_id = b.source_contract_id
  AND a.pain_signal_type = b.pain_signal_type
  AND COALESCE(a.icp_profile_id, '00000000-0000-0000-0000-000000000000') = COALESCE(b.icp_profile_id, '00000000-0000-0000-0000-000000000000')
  AND a.source_contract_id IS NOT NULL;

-- Step 2: Clean up existing duplicate job signals (keep oldest)
DELETE FROM company_pain_signals a
USING company_pain_signals b
WHERE a.id > b.id
  AND a.company_id = b.company_id
  AND a.source_job_posting_id = b.source_job_posting_id
  AND a.pain_signal_type = b.pain_signal_type
  AND COALESCE(a.icp_profile_id, '00000000-0000-0000-0000-000000000000') = COALESCE(b.icp_profile_id, '00000000-0000-0000-0000-000000000000')
  AND a.source_job_posting_id IS NOT NULL;

-- Step 3: Add unique constraint for contract signals
ALTER TABLE company_pain_signals
ADD CONSTRAINT unique_contract_signal
UNIQUE NULLS NOT DISTINCT (company_id, source_contract_id, pain_signal_type, icp_profile_id);

-- Step 4: Add unique constraint for job signals
ALTER TABLE company_pain_signals
ADD CONSTRAINT unique_job_signal
UNIQUE NULLS NOT DISTINCT (company_id, source_job_posting_id, pain_signal_type, icp_profile_id);
```

---

## PHASE 1B: Fix Contract Signal Generation

**Copy this prompt to a new Claude Code chat:**

```
# Task: Fix Contract Signal Duplication

## Context
We have duplicate contract signals being created because:
1. Three different code paths create signals from the same contracts
2. No database unique constraint existed (now added)
3. The code uses non-atomic check-then-insert pattern

## Signal Lifecycle Rules
- Signal created when we FIRST SEE data that triggers it
- Re-scanning UNCHANGED data → NO new signal
- Re-scanning MODIFIED data → UPDATE existing signal

## Your Task
Change all contract signal INSERT operations to use UPSERT pattern.

## Files to Modify

### 1. src/inngest/functions/generate-contract-signals.ts
Find all `supabase.from('company_pain_signals').insert()` calls and change to:
```typescript
await supabase.from('company_pain_signals').upsert({
  company_id,
  source_contract_id,
  pain_signal_type,
  icp_profile_id,
  signal_title,
  signal_detail,
  signal_value,
  pain_score_contribution,
  urgency,
  detected_at: new Date().toISOString(),
}, {
  onConflict: 'company_id,source_contract_id,pain_signal_type,icp_profile_id',
});
```

### 2. src/lib/contracts-finder/signals.ts
- Remove the `signalExists()` function (no longer needed)
- Change all INSERT to UPSERT pattern

### 3. src/app/api/cron/contracts-finder-signals/route.ts
- Add comment at top: "// DEPRECATED: Use Inngest generate-contract-signals instead"
- Change to trigger Inngest event instead of processing directly

## Constraints
- Keep all existing signal fields (don't remove any)
- The unique constraint columns are: company_id, source_contract_id, pain_signal_type, icp_profile_id
- Test with: npm run build

## Deliverables
1. Update the files listed above
2. Run npm run build to verify no errors
3. Deploy with: npx vercel --prod
```

---

## PHASE 1C: Fix Job Signal Generation

**Copy this prompt to a new Claude Code chat:**

```
# Task: Fix Job-Based Signal Duplication

## Context
Similar to contract signals, job-based pain signals can duplicate because:
1. Multiple code paths process the same jobs
2. Non-atomic check-then-insert pattern
3. Database unique constraint now exists

## Signal Lifecycle Rules
- Signal created when we FIRST SEE data that triggers it
- Re-scanning UNCHANGED data → NO new signal
- Re-scanning MODIFIED data → UPDATE existing signal

## Your Task
Change all job signal INSERT operations to use UPSERT pattern.

## Files to Modify

### 1. src/inngest/functions/generate-pain-signals.ts
Find all `supabase.from('company_pain_signals').insert()` calls for job signals and change to:
```typescript
await supabase.from('company_pain_signals').upsert({
  company_id,
  source_job_posting_id,
  pain_signal_type,
  icp_profile_id,
  signal_title,
  signal_detail,
  pain_score_contribution,
  urgency,
  detected_at: new Date().toISOString(),
}, {
  onConflict: 'company_id,source_job_posting_id,pain_signal_type,icp_profile_id',
});
```

### 2. src/lib/signals/job-signal-generator.ts
Change all INSERT to UPSERT pattern for job-based signals.

### 3. src/lib/signals/detection.ts (if it has signal creation)
Change any INSERT to UPSERT pattern.

## Constraints
- Keep all existing signal fields
- Unique constraint columns: company_id, source_job_posting_id, pain_signal_type, icp_profile_id
- Test with: npm run build

## Deliverables
1. Update the files listed above
2. Run npm run build to verify no errors
3. Deploy with: npx vercel --prod
```

---

## PHASE 2: Simplify Job Queue Architecture

**Copy this prompt to a new Claude Code chat:**

```
# Task: Simplify Job Queue Architecture

## Context
Read the full plan at: /Users/trisdenmills/.claude/plans/wiggly-kindling-origami.md

Currently we have 3 Inngest functions doing overlapping work:
- ingest-jobs (every 4 hours)
- process-scan-queue (every 15 minutes)
- schedule-daily-jobs (6 AM daily)

This causes:
- Same jobs searched multiple times
- 100 Reed calls/day limit exhausted quickly
- Unnecessary complexity

## User Preferences
- Keep LIGHT queueing (core jobs immediate, expanded locations queued)
- 100 Reed calls/day limit must be respected
- Circuit breaker for API budget

## New Architecture
```
ICP Scan:
  ├→ Fetch core jobs immediately (primary roles × user locations)
  ├→ Generate initial pain signals
  ├→ Queue: expanded locations only (not role variations)
  └→ Return results with "syncing more in background"

Single Daily Sync (6 AM):
  ├→ Fetch jobs for all active ICPs
  ├→ Respect 100 call/day limit (circuit breaker)
  ├→ Mark stale jobs
  └→ Regenerate pain signals for CHANGED jobs only
```

## Your Task
1. Merge the 3 Inngest functions into a single `daily-job-sync` function
2. Simplify ICP scan to NOT queue role_variation tasks (do them immediately)
3. Keep expanded_location tasks for background processing
4. Add circuit breaker that stops when API budget exhausted

## Files to Modify
- src/inngest/functions/ingest-jobs.ts → becomes `daily-job-sync`
- src/app/api/icp/[id]/scan/route.ts → simplify queueing
- src/inngest/functions/index.ts → update exports

## Files to Deprecate (add DEPRECATED comment, don't delete yet)
- src/inngest/functions/process-scan-queue.ts
- src/inngest/functions/schedule-daily-jobs.ts

## Constraints
- Don't break existing functionality
- Keep the 100 calls/day Reed limit
- Test with: npm run build

## Deliverables
1. Update the files
2. Run npm run build
3. Deploy with: npx vercel --prod
```

---

## PHASE 3: Clean Up Dead Code

**Copy this prompt to a new Claude Code chat:**

```
# Task: Clean Up Deprecated Code

## Context
After Phase 1 and 2, we have deprecated code that can be removed.

## Your Task
1. Remove deprecated files (or move to archived folder)
2. Remove unused exports from index files
3. Clean up unused imports

## Files to Remove/Archive
- src/inngest/functions/process-scan-queue.ts (if merged in Phase 2)
- src/inngest/functions/schedule-daily-jobs.ts (if merged in Phase 2)
- src/app/api/cron/contracts-finder-signals/route.ts (replaced by Inngest)

## Files to Clean Up
- src/inngest/functions/index.ts → remove deprecated function exports
- src/lib/scan-queue.ts → remove unused queue functions (keep table)
- src/lib/job-fetch-queue.ts → remove if unused

## Constraints
- Only remove code that is confirmed unused
- Keep database tables (for audit history)
- Test with: npm run build

## Deliverables
1. Archive/remove deprecated files
2. Run npm run build
3. Deploy with: npx vercel --prod
```

---

## Verification Checklist

After all phases complete, verify:

- [ ] No duplicate signals created when running contract sync
- [ ] No duplicate signals created when running job sync
- [ ] ICP scan completes without queueing role_variation tasks
- [ ] Daily sync respects 100 Reed calls/day limit
- [ ] npm run build succeeds
- [ ] Production deployment works
- [ ] Check Inngest dashboard shows correct number of functions

---

## Rollback Plan

If something breaks:

1. **Database constraints causing issues:**
```sql
ALTER TABLE company_pain_signals DROP CONSTRAINT IF EXISTS unique_contract_signal;
ALTER TABLE company_pain_signals DROP CONSTRAINT IF EXISTS unique_job_signal;
```

2. **Code rollback:**
```bash
git checkout HEAD~1 -- src/inngest/functions/
npx vercel --prod
```
