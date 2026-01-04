# User Data Isolation - Implementation Decision

## Current Architecture Discovery

### How Jobs & Companies Work Now:
```
1. Job Ingestion (ingest-jobs.ts) - Runs for ALL users
   ├── Fetch jobs from Reed/Adzuna APIs
   ├── Create companies via findOrCreateCompany()  <-- PROBLEM: No user_id context
   └── Store job_postings (shared)

2. Signal Generation (generate-pain-signals.ts) - Runs for ALL users
   ├── Match jobs to ICP profiles
   ├── Create pain_signals (has icp_profile_id, so has user context)
   └── Update company pain scores
```

**The Problem:**
- Companies are created in Step 1 (job ingestion) WITHOUT user_id
- At that point, we don't know which user will track that company
- Multiple ICPs from different users might be interested in the same company

## Three Implementation Options

### Option A: First-To-Track Ownership (Simplest Migration)

**How it works:**
1. Job ingestion creates companies with `user_id = NULL`
2. When generating signals, if company has no owner, assign to current user
3. First user to get a signal for that company "claims" it

**Pros:**
- ✅ Minimal code changes
- ✅ Easy migration (backfill assigns to first signal's user)
- ✅ Jobs stay shared

**Cons:**
- ❌ First user "wins" - not fair
- ❌ If User A claims "Google UK", User B can't track it
- ❌ Doesn't solve multi-user problem

**Verdict:** ❌ Doesn't achieve user isolation goal

---

### Option B: Deferred Company Creation (Recommended)

**How it works:**
1. Job ingestion stores ONLY job_postings (no companies)
2. When generating signals for an ICP:
   - Extract company name from job
   - Call `findOrCreateCompany(name, icp.user_id)`
   - Each user gets their own company record
3. Pain signals link to user's company

**Pros:**
- ✅ True user isolation (each user has own companies)
- ✅ No data theft (enrichments isolated)
- ✅ No accidental deletion
- ✅ Jobs stay shared (public API cache)

**Cons:**
- ⚠️ More company records (acceptable - storage is cheap)
- ⚠️ Requires refactoring job ingestion

**Changes Required:**
```typescript
// BEFORE (ingest-jobs.ts line 308)
const { company } = await findOrCreateCompany({
  name: reedJob.employerName,
  location: reedJob.locationName,
  industry: detectedIndustry,
  is_likely_agency_pattern: isLikelyAgency,
});

// AFTER
// Skip company creation - just store job_posting
// Company will be created when generating signals for each ICP
```

```typescript
// NEW: In generate-pain-signals.ts
for (const job of jobs) {
  for (const icp of matchingICPs) {
    // Create user-specific company
    const { company } = await findOrCreateCompany({
      name: job.company_name,
      location: job.location,
      industry: job.industry,
      user_id: icp.user_id,  // USER ISOLATION
    });

    // Create signal
    await createPainSignal({
      company_id: company.id,
      icp_profile_id: icp.id,
      ...
    });
  }
}
```

**Verdict:** ✅ **RECOMMENDED** - Achieves full user isolation

---

### Option C: User-Company Junction Table

**How it works:**
1. Companies table stays global (no user_id)
2. Create `user_companies` junction table:
   ```sql
   CREATE TABLE user_companies (
     user_id UUID,
     company_id UUID,
     enriched_at TIMESTAMPTZ,
     PRIMARY KEY (user_id, company_id)
   );
   ```
3. Contacts link to user_companies, not companies
4. RLS filters through junction table

**Pros:**
- ✅ Companies deduped globally
- ✅ User isolation via junction

**Cons:**
- ❌ Complex queries (always need JOIN)
- ❌ RLS becomes complicated
- ❌ More tables to maintain
- ❌ Still have data theft risk (contacts visible via company_id)

**Verdict:** ❌ Too complex, doesn't fully solve problem

---

## Recommended Approach: Option B (Deferred Company Creation)

### Implementation Steps

#### 1. Update Job Ingestion (Remove Company Creation)
**Files:**
- `src/inngest/functions/ingest-jobs.ts`
- `src/app/api/cron/ingest-jobs/route.ts`

**Change:**
```typescript
// REMOVE company creation from job ingestion
// Just store job_postings with company_name as text field

// Add company_name to job_postings if not exists
ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS company_name TEXT;
```

#### 2. Update Signal Generation (Add Company Creation)
**Files:**
- `src/inngest/functions/generate-pain-signals.ts`
- `src/inngest/functions/generate-contract-signals.ts`
- `src/inngest/functions/generate-ch-signals.ts`

**Change:**
```typescript
// When processing job for ICP:
const { company } = await findOrCreateCompany({
  name: job.company_name,
  domain: extractedDomain,
  location: job.location,
  industry: job.industry,
  user_id: icp.user_id,  // KEY: User isolation
});
```

#### 3. Companies House & Contracts Finder
These already have user context via ICP:

**lib/companies-house/company-sync.ts:**
```typescript
// Already called in context of ICP
export async function syncCompaniesHouseCompany(
  chNumber: string,
  icpProfileId: string  // Add this parameter
) {
  const { data: icp } = await supabase
    .from('icp_profiles')
    .select('user_id')
    .eq('id', icpProfileId)
    .single();

  const { company } = await findOrCreateCompany({
    ...companyData,
    user_id: icp.user_id,  // USER ISOLATION
  });
}
```

#### 4. Migration Strategy

**Phase 1: Add user_id column (nullable)**
```sql
ALTER TABLE companies ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
```

**Phase 2: Backfill existing companies**
```sql
-- Assign companies to first user that has a signal for them
UPDATE companies c
SET user_id = (
  SELECT icp.user_id
  FROM company_pain_signals cps
  JOIN icp_profiles icp ON icp.id = cps.icp_profile_id
  WHERE cps.company_id = c.id
  ORDER BY cps.created_at ASC
  LIMIT 1
);
```

**Phase 3: Handle orphans**
```sql
-- Delete companies with no signals (orphaned during migration)
DELETE FROM companies WHERE user_id IS NULL;
```

**Phase 4: Make required**
```sql
ALTER TABLE companies ALTER COLUMN user_id SET NOT NULL;
```

**Phase 5: Add RLS**
```sql
-- See migrate-user-data-isolation.sql
```

**Phase 6: Deploy code changes**
- Update job ingestion to skip company creation
- Update signal generation to create companies
- Deploy

---

## Decision Needed

**Question for you:**

Do you want **Option B (Deferred Company Creation)**?

This means:
- Each user gets their OWN company records (isolated)
- "Google UK" tracked by User A is separate from "Google UK" tracked by User B
- Enrichments are completely isolated
- No risk of data theft or accidental deletion

**Trade-off:**
- More company records in database (acceptable - storage is cheap)
- Small refactor of job ingestion and signal generation

**Alternative:** Stick with shared companies and accept the business model risk?

Let me know and I'll proceed with implementation!
