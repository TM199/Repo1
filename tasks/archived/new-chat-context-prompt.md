# Context Prompt for New Chat

Copy and paste this to give a new Claude Code session full context on the Signal Mentis v2.0 implementation.

---

## PROMPT TO COPY:

I'm working on Signal Mentis, a "Hiring Pain Intelligence" platform for recruitment agencies. The goal is to identify companies struggling to hire BEFORE competitors.

**Read the full plan first:** `tasks/signal-mentis-v2-plan.md`

## Current State Summary:

**What's Working:**
- Reed API → job_postings → pain signal generation → /pain dashboard
- Pain detection: stale jobs (30/60/90 days), reposts, salary increases, referral bonuses
- Pain score calculation (0-100)
- View Job links in pain dashboard
- Government data sync (Contracts Finder, Find a Tender)
- Cron jobs scheduled (jobs every 4h, pain signals daily)

**What's Broken:**
- Search profiles don't use the pain detection engine (they use Firecrawl which costs $$$)
- Two disconnected signal systems: `signals` table vs `company_pain_signals` table
- No contact enrichment - we detect pain but can't ACTION it
- Many companies missing domains

## User Decisions (Confirmed):
1. Find ALL contacts: job poster + hiring manager + company directors
2. Create new `company_contacts` table with confidence scores
3. Rename "New Job Postings" → "Hiring Pain Signals" in UI
4. Filter /pain dashboard to user's industry only
5. Manual trigger for now, scheduled scans + email notifications later

## Implementation Priority:

**Start with Phase 1-3 (Core Flow):**
1. Create `src/app/api/search/profiles/[id]/analyze/route.ts` - connects profiles to pain detection
2. Add "Analyze ICP" button to `src/app/(dashboard)/search/[id]/page.tsx`
3. Create `src/lib/jobs/contact-parser.ts` - parse emails/phones from job descriptions

**Then Phase 4-6 (Enrichment):**
4. Create `src/lib/companies/domain-resolver.ts` - guess/verify domains
5. Enhance `src/lib/companies-house.ts` - fetch directors
6. Update `src/components/dashboard/CompaniesInPainDashboard.tsx` - show contacts

## Key Files to Review:
- `src/app/api/admin/backfill-jobs/route.ts` - existing job backfill (working)
- `src/app/api/cron/generate-pain-signals/route.ts` - pain signal generation (working)
- `src/lib/job-boards.ts` - Reed API integration
- `src/lib/companies/company-matcher.ts` - company matching logic
- `src/components/dashboard/CompaniesInPainDashboard.tsx` - pain dashboard

## Database Changes Needed:
```sql
-- New columns on job_postings
ALTER TABLE job_postings ADD COLUMN contact_name TEXT;
ALTER TABLE job_postings ADD COLUMN contact_email TEXT;
ALTER TABLE job_postings ADD COLUMN contact_phone TEXT;
ALTER TABLE job_postings ADD COLUMN urgency_keywords TEXT[];

-- New columns on companies
ALTER TABLE companies ADD COLUMN linkedin_url TEXT;
ALTER TABLE companies ADD COLUMN employees_estimate INTEGER;
ALTER TABLE companies ADD COLUMN last_enriched_at TIMESTAMPTZ;

-- New table for contacts
CREATE TABLE company_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  name TEXT,
  role TEXT,
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,
  source TEXT,  -- 'job_description', 'companies_house', 'hunter', 'manual'
  confidence_score INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Start implementing Phase 1: Connect Search Profiles to Pain Detection

Create the analyze endpoint that:
1. Takes a search profile ID
2. Extracts keywords from `specific_roles` and locations from `locations`
3. Calls Reed API (via existing `fetchAllReedResults`) with 90-day lookback
4. Stores results in `job_postings` table (reuse logic from backfill-jobs)
5. Triggers pain signal generation
6. Returns stats and redirects to `/pain?industry=X`

Reference: `src/app/api/admin/backfill-jobs/route.ts` for the job ingestion pattern.
