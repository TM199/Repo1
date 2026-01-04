# CRITICAL: User Data Isolation Architecture Fix

## Problem Statement

**Current Architecture (BROKEN for multi-user):**
- Companies are GLOBAL (shared across all users)
- Pain signals reference global companies
- Contacts are stored on global company records
- Deleting one user's ICP can delete another user's paid data

**Business Model Break:**
- User A enriches company → pays for contacts
- User B tracks same company → gets FREE contacts (data theft)
- User A deletes ICP → User B loses data
- User B deletes ICP → User A loses paid contacts

## Correct Architecture Principles

### 1. User Owns Their Data
Every user should have:
- ✅ Their own company records (isolated)
- ✅ Their own contacts (they paid for them)
- ✅ Their own pain signals (already correct via ICP)
- ✅ Their own job postings? (OR shared raw data - TBD)

### 2. Shared vs Private Data

**SHARED (Public API responses - cached for efficiency):**
- Raw job board listings (Reed/Adzuna API responses)
- Government contracts (public data)
- Companies House filings (public data)

**PRIVATE (User paid for or user-specific):**
- Companies (user's list)
- Company contacts (user paid to enrich)
- Pain signals (user's ICP detected them)

## Three Architecture Options

### Option 1: Full User Isolation (Recommended)

**Add user_id to companies table:**

```sql
-- Migration 1: Add user_id to companies
ALTER TABLE companies
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Backfill existing companies (get user_id from pain signals)
UPDATE companies c
SET user_id = (
  SELECT icp.user_id
  FROM company_pain_signals cps
  JOIN icp_profiles icp ON icp.id = cps.icp_profile_id
  WHERE cps.company_id = c.id
  LIMIT 1
);

-- Make it required
ALTER TABLE companies
ALTER COLUMN user_id SET NOT NULL;

-- Add index for user queries
CREATE INDEX idx_companies_user_id ON companies(user_id);

-- Update RLS policies
DROP POLICY IF EXISTS "Users can view companies" ON companies;
CREATE POLICY "Users can view their own companies"
  ON companies FOR SELECT
  USING (auth.uid() = user_id);
```

**Impact:**
- ✅ Each user has their own company records
- ✅ Enrichments (contacts) are isolated
- ✅ Deleting ICP only affects user's data
- ✅ No data theft between users
- ⚠️ Duplicate companies across users (acceptable - isolation is worth it)

**Job Postings:**
Keep shared OR duplicate per user:

```sql
-- Option A: Keep job_postings shared (raw API cache)
-- No changes needed - just reference data

-- Option B: Add user_id to job_postings
ALTER TABLE job_postings
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
```

**Recommendation:** Keep job_postings **shared** (they're public API data), but companies are user-specific.

### Option 2: Soft Isolation (Multi-tenant with shared records)

**Add user_company junction table:**

```sql
CREATE TABLE user_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  enriched_at TIMESTAMPTZ,
  pain_score INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, company_id)
);

-- Move contacts to user_companies
ALTER TABLE company_contacts
DROP COLUMN company_id,
ADD COLUMN user_company_id UUID REFERENCES user_companies(id) ON DELETE CASCADE;
```

**Impact:**
- Companies stay global
- Each user "claims" companies via junction table
- Contacts linked to user's claim, not global company
- More complex queries

**Verdict:** Too complex, Option 1 is cleaner.

### Option 3: Namespace by ICP (Current + Fix)

**Keep current structure, add proper filters:**

```sql
-- Add user_id to companies for isolation
ALTER TABLE companies ADD COLUMN user_id UUID;

-- All queries MUST filter by user_id
-- When deleting ICP, delete companies WHERE user_id = X
```

**Verdict:** Same as Option 1 but less explicit.

## Recommended Solution: Option 1 (Full User Isolation)

### Migration Steps

#### Step 1: Add user_id to companies
```sql
-- Add column (nullable first)
ALTER TABLE companies
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Backfill from existing pain signals
UPDATE companies c
SET user_id = (
  SELECT icp.user_id
  FROM company_pain_signals cps
  JOIN icp_profiles icp ON icp.id = cps.icp_profile_id
  WHERE cps.company_id = c.id
  LIMIT 1
);

-- Make required
ALTER TABLE companies
ALTER COLUMN user_id SET NOT NULL;

-- Index for performance
CREATE INDEX idx_companies_user_id ON companies(user_id);
```

#### Step 2: Update RLS Policies
```sql
-- Drop old policies
DROP POLICY IF EXISTS "Service role has full access to companies" ON companies;

-- User can only see their companies
CREATE POLICY "Users can view their own companies"
  ON companies FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own companies"
  ON companies FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own companies"
  ON companies FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own companies"
  ON companies FOR DELETE
  USING (auth.uid() = user_id);

-- Service role still needs full access (for cron jobs)
CREATE POLICY "Service role has full access to companies"
  ON companies FOR ALL
  USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');
```

#### Step 3: Update Application Code

**Pain signal creation (signal generators):**
```typescript
// Before (WRONG):
const company = await findOrCreateCompany(companyName);

// After (CORRECT):
const company = await findOrCreateCompany(companyName, icpProfile.user_id);
```

**Company fetching (dashboard):**
```typescript
// Already correct - uses RLS via auth.uid()
const { data } = await supabase
  .from('companies')
  .select('*')
  // RLS automatically filters by user_id
```

**ICP deletion:**
```typescript
// DELETE /api/icp/[id]
// No cleanup function needed!
// CASCADE from icp_profiles -> company_pain_signals -> companies (via user_id)
```

#### Step 4: Remove cleanup_orphaned_companies()

**Not needed anymore!** Companies are owned by user, deleted when user is deleted via CASCADE.

When ICP is deleted:
1. ICP deleted
2. CASCADE deletes pain signals
3. Companies stay (user might have other ICPs)
4. When USER is deleted, all companies deleted (CASCADE on user_id)

### Job Postings Decision

**Keep job_postings SHARED (recommended):**
- They're public API data (Reed, Adzuna)
- Caching saves API calls
- No business value in duplicating them

**Structure:**
```sql
job_postings (SHARED - no user_id)
  └── source_url (public data)

company_pain_signals (USER-SPECIFIC)
  ├── company_id (FK to user's company)
  └── source_job_posting_id (FK to shared job)
```

This way:
- Job data is cached (efficient)
- Users don't "own" job postings
- Each user's company references shared jobs

### Contacts Decision

**Contacts MUST be user-specific:**
```sql
company_contacts
  - id
  - company_id (FK to user-specific company)
  - email
  - ...
```

Already correct! Company is now user-specific, so contacts are isolated via FK.

## Testing Plan

### Test 1: User Isolation
1. User A creates ICP, finds "Google UK"
2. User B creates ICP, finds "Google UK"
3. Verify: TWO company records (different user_id)
4. User A enriches → contacts added to User A's Google UK
5. User B cannot see User A's contacts ✅

### Test 2: ICP Deletion Safety
1. User A has 100 companies
2. User A deletes ICP #1 (50 companies)
3. Verify: Pain signals deleted, companies remain (might have other ICPs)
4. User A deletes ICP #2 (other 50 companies)
5. Verify: Pain signals deleted, companies remain (user still exists)

### Test 3: User Deletion Cascade
1. User A has 100 companies with enrichments
2. Delete User A (account deletion)
3. Verify: All User A's companies deleted (CASCADE on user_id)
4. Verify: No orphaned data

## Migration Checklist

- [ ] Run SQL migration to add user_id to companies
- [ ] Backfill user_id from existing pain signals
- [ ] Update RLS policies
- [ ] Update signal generation code (contracts, jobs, CH)
- [ ] Update company creation code
- [ ] Remove cleanup_orphaned_companies() function
- [ ] Remove cleanup call from DELETE /api/icp/[id]
- [ ] Test user isolation
- [ ] Test ICP deletion (companies should remain)
- [ ] Deploy to production

## Breaking Changes

**None for existing users!** Backfill handles migration.

**For new users:** Companies are now isolated (expected behavior).

## Success Criteria

✅ User A cannot see User B's companies
✅ User A cannot see User B's enrichments
✅ Deleting ICP does NOT delete companies (user might re-create ICP)
✅ Deleting USER deletes all their companies (CASCADE)
✅ No data theft between users
✅ Each user pays for their own enrichments
✅ Business model protected
