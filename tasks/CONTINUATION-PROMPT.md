# CONTINUATION: User Data Isolation Implementation

**Context**: Signal Mentis is a B2B SaaS that tracks "pain signals" (hiring difficulties, contract wins) to help users find companies needing services. Users create ICP (Ideal Customer Profile) profiles to filter signals.

## Critical Problem Discovered

**Original Task**: Fix ICP deletion cleanup and default dashboard filter.

**During implementation, discovered CRITICAL business model flaw**:
- Companies table is GLOBAL (shared across all users)
- When User A enriches "Google UK" (pays for contacts), User B can see those contacts
- When User B deletes their ICP, User A loses their paid data
- **THIS BREAKS THE ENTIRE BUSINESS MODEL**

## Architecture Decision: Option B (Deferred Company Creation)

After analyzing 3 options (see `tasks/user-isolation-implementation-plan.md`), we chose:

**Option B: Each user gets their own company records**
- User A tracks "Google UK" → Creates User A's "Google UK" record
- User B tracks "Google UK" → Creates User B's "Google UK" record
- Separate enrichments, separate data, full isolation
- No data theft, no accidental deletion

**Trade-off:** More company records (acceptable - storage is cheap, security is priceless)

## What's Been Completed

### 1. Default ICP Filter Fixed ✅
**File**: `src/components/dashboard/CompaniesInPainDashboard.tsx`
- Line 55: Changed `useState('all')` → `useState('')`
- Lines 464-469: Added useEffect to auto-select first ICP
- **Impact**: Dashboard defaults to first ICP, not "all"

### 2. SQL Migration Created ✅
**File**: `scripts/migrate-user-data-isolation.sql`
```sql
-- Add user_id to companies
ALTER TABLE companies ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Backfill from existing pain signals
UPDATE companies c SET user_id = (
  SELECT icp.user_id FROM company_pain_signals cps
  JOIN icp_profiles icp ON icp.id = cps.icp_profile_id
  WHERE cps.company_id = c.id
  ORDER BY cps.created_at ASC LIMIT 1
);

-- Delete orphans
DELETE FROM companies WHERE user_id IS NULL;

-- Make required
ALTER TABLE companies ALTER COLUMN user_id SET NOT NULL;

-- Add RLS policies (users only see their companies)
-- See full file for complete policies
```

### 3. Core Function Updated ✅
**File**: `src/lib/companies/company-matcher.ts`

**Updated `findOrCreateCompany()`**:
- Added required `user_id` parameter to `CompanyInput`
- All matching strategies now filter by `user_id` (lines 106, 127, 146, 164)
- Company creation includes `user_id` (line 192)
- **Result**: Each user has isolated company records

### 4. Code Deployed ✅
- Dashboard fix deployed to production
- `findOrCreateCompany()` updated (NOT yet deployed - breaks existing callers)

## What Needs To Be Done

### Current State:
- ✅ Migration SQL ready (NOT run yet)
- ✅ Core function updated (breaks existing code until callers updated)
- ❌ All callers of `findOrCreateCompany()` need updating

### Step 1: Update All Callers (CRITICAL - Code Currently Broken)

**Files that call `findOrCreateCompany()` (need `user_id` parameter added):**

1. **`src/inngest/functions/ingest-jobs.ts`** (lines 308, 483)
   - Gets ICP profiles, has `user_id` in context
   - Change needed:
   ```typescript
   // BEFORE
   const { company } = await findOrCreateCompany({
     name: reedJob.employerName,
     location: reedJob.locationName,
     industry: detectedIndustry,
     is_likely_agency_pattern: isLikelyAgency,
   });

   // AFTER - Get user_id from ICP profile
   const { data: icp } = await supabase
     .from('icp_profiles')
     .select('user_id')
     .eq('id', icpProfileId)  // You have this from the loop
     .single();

   const { company } = await findOrCreateCompany({
     name: reedJob.employerName,
     location: reedJob.locationName,
     industry: detectedIndustry,
     is_likely_agency_pattern: isLikelyAgency,
     user_id: icp.user_id,  // ADD THIS
   });
   ```

2. **`src/inngest/functions/rescan-icp-jobs.ts`** (line 317)
3. **`src/inngest/functions/process-job-queue.ts`** (line 277)
4. **`src/lib/companies-house/company-sync.ts`** (line 61)
5. **`src/lib/contracts-finder/supplier-sync.ts`** (line 55)
6. **`src/app/api/cron/rescan-icp-jobs/route.ts`** (line 246)
7. **`src/app/api/cron/ingest-jobs/route.ts`** (line 526)
8. **`src/app/api/admin/backfill-jobs/route.ts`** (line 228)

**Pattern for all callers:**
```typescript
// All these functions are called in context of an ICP profile
// You need to:
// 1. Get the ICP profile (you already have the ID)
// 2. Extract user_id
// 3. Pass to findOrCreateCompany()

const { data: icp } = await supabase
  .from('icp_profiles')
  .select('user_id')
  .eq('id', icpProfileId)
  .single();

const { company } = await findOrCreateCompany({
  name: companyName,
  // ... other fields
  user_id: icp.user_id,  // ADD THIS LINE
});
```

### Step 2: Run SQL Migration

**In Supabase SQL Editor, run:**
`scripts/migrate-user-data-isolation.sql`

This will:
- Add `user_id` column to companies
- Backfill from existing pain signals
- Delete orphaned companies
- Make `user_id` required
- Add RLS policies for user isolation

### Step 3: Remove Old Cleanup Code

**Files to update:**

1. **`src/app/api/icp/[id]/route.ts`** (lines 147-158)
   - Remove the cleanup function call
   - It's no longer needed (CASCADE handles deletion)

2. **Delete file**: `scripts/cleanup-orphaned-companies.sql`
   - No longer needed with user_id isolation

### Step 4: Test User Isolation

**Test scenarios:**
1. Create User A → Create ICP → Companies appear
2. Create User B → Create ICP (same criteria) → Different companies created
3. User A enriches company → User B cannot see contacts
4. User A deletes ICP → User A's companies remain (might have other ICPs)
5. User B deletes ICP → User A's data unaffected

### Step 5: Deploy

1. Update all callers (Step 1)
2. Build and test locally
3. Run migration (Step 2)
4. Deploy code
5. Verify user isolation

## Key Files Modified

1. `src/components/dashboard/CompaniesInPainDashboard.tsx` - Default filter fix
2. `src/lib/companies/company-matcher.ts` - User isolation in findOrCreateCompany()
3. `scripts/migrate-user-data-isolation.sql` - Database migration
4. 8+ files calling findOrCreateCompany() - Need user_id parameter

## Success Criteria

✅ User A cannot see User B's companies
✅ User A cannot see User B's enrichments (contacts)
✅ Deleting ICP does NOT delete companies (user might recreate ICP)
✅ Deleting USER deletes all their companies (CASCADE on user_id)
✅ No data theft between users
✅ Business model protected

## Important Notes

- **Job postings stay SHARED** (they're public API data - caching saves costs)
- **Pain signals already have user context** via icp_profile_id (correct)
- **Companies become user-specific** (each user has own records)
- **Contacts stay isolated** (linked to user's companies via FK)

## Next Steps for New Chat

Ask Claude to:
1. "Update all callers of findOrCreateCompany() to include user_id parameter"
2. "Build and test to verify no TypeScript errors"
3. "Guide me through running the SQL migration"
4. "Help test user isolation after deployment"

## Files to Reference

- Implementation plan: `tasks/user-isolation-implementation-plan.md`
- Architecture doc: `tasks/architecture-fix-user-isolation.md`
- Migration SQL: `scripts/migrate-user-data-isolation.sql`
- Core matcher: `src/lib/companies/company-matcher.ts`
