# Signal Mentis Simplification Plan

## Overview

This document outlines the plan to simplify Signal Mentis by removing low-value features and focusing on the core value proposition: **identifying companies with hiring pain through job board analysis**.

**Goal:** Reduce complexity by ~40% while maintaining and improving core functionality.

---

## Current State Summary

### What Works Well (KEEP)
- ICP Profiles + Scan system
- Companies in Pain Dashboard
- Pain signal detection (hard-to-fill, reposts, salary increases, referral bonuses)
- Contact enrichment (LeadMagic + Prospeo)
- CSV export
- Reed job ingestion
- Background queue for rate limiting

### What Doesn't Add Value (REMOVE)
- Search Profiles (AI Web Search) - duplicates ICP, poor results
- Agency Finder - unreliable domain analysis
- URL Sources - scraping doesn't work
- Adzuna integration - inferior to Reed
- Companies House leadership signals - data quality issues
- Planning Data signals - too niche, indirect signal
- Weekly/Monthly crons - consolidate to daily

### Move to "Labs" Page (EXPERIMENTAL)
- Companies House search
- Planning Data search
- Find a Tender (keep in main app but also in labs)

---

## Phase 1: Create Labs/Experimental Page

### Task 1.1: Create /labs route (outside dashboard)

**File:** `/src/app/labs/page.tsx`

Create a standalone page (not in dashboard layout) for experimental features:

```
/labs
├── Header: "Signal Mentis Labs - Experimental Features"
├── Warning banner: "These features are experimental and may not work reliably"
├── Cards for each experimental feature:
│   ├── Companies House Search
│   │   ├── Input: Company name or number
│   │   ├── Button: Search
│   │   ├── Results: Recent appointments, directors
│   │   └── Note: "Testing only - not integrated with main app"
│   │
│   ├── Planning Data Search
│   │   ├── Input: Location, keywords
│   │   ├── Button: Search
│   │   ├── Results: Recent planning applications
│   │   └── Note: "Testing only - not integrated with main app"
│   │
│   └── Find a Tender Search
│       ├── Input: Keywords, min value
│       ├── Button: Search
│       ├── Results: Recent tender awards
│       └── Note: "Also available in main app via ICP profiles"
```

### Task 1.2: Create Labs API routes

**Files to create:**
- `/src/app/api/labs/companies-house/route.ts` - Search Companies House
- `/src/app/api/labs/planning/route.ts` - Search Planning Data
- `/src/app/api/labs/tenders/route.ts` - Search Find a Tender

These are standalone endpoints that:
- Don't require authentication (or simple auth)
- Return raw results for testing
- Don't save to database
- Don't create signals

### Task 1.3: Create Labs layout

**File:** `/src/app/labs/layout.tsx`

Simple layout without dashboard sidebar:
- Minimal header with logo and "Labs" badge
- Link back to main app
- Footer with disclaimer

---

## Phase 2: Remove Low-Value Features

### Task 2.1: Remove Search Profiles (AI Web Search)

**Files to delete:**
```
/src/app/(dashboard)/search/page.tsx
/src/app/(dashboard)/search/new/page.tsx
/src/app/(dashboard)/search/[id]/page.tsx
/src/app/(dashboard)/search/[id]/run/page.tsx
/src/app/api/search/profiles/route.ts
/src/app/api/search/profiles/[id]/route.ts
/src/app/api/search/profiles/[id]/analyze/route.ts
/src/app/api/search/run/route.ts
/src/app/api/search/run/stream/route.ts
/src/app/api/search/history/route.ts
```

**Files to modify:**
- `/src/components/Sidebar.tsx` - Remove "Search" nav item
- `/src/types/index.ts` - Remove SearchProfile, SearchRun types (keep for now, mark deprecated)

**Database:** Keep `search_profiles` and `search_runs` tables for historical data, but stop using them.

### Task 2.2: Remove Agency Finder

**Files to delete:**
```
/src/app/(dashboard)/agency/page.tsx
/src/app/(dashboard)/agency/AgencyFinderClient.tsx (if separate)
/src/app/api/agency/analyze/route.ts
/src/app/api/agency/search/route.ts
/src/app/api/agency/save/route.ts
```

**Files to modify:**
- `/src/components/Sidebar.tsx` - Remove "Agency" nav item

### Task 2.3: Remove URL Sources

**Files to delete:**
```
/src/app/(dashboard)/sources/page.tsx
/src/app/(dashboard)/sources/add/page.tsx
/src/app/api/sources/route.ts
/src/app/api/sources/[id]/route.ts
/src/app/api/sources/[id]/scrape/route.ts
```

**Files to modify:**
- `/src/components/Sidebar.tsx` - Remove "Sources" nav item

**Database:** Keep `sources` table for historical data.

### Task 2.4: Remove Adzuna Integration

**Files to modify:**
- `/src/lib/job-boards.ts` - Remove Adzuna functions, keep Reed only
- `/src/app/api/cron/ingest-jobs/route.ts` - Remove Adzuna ingestion

### Task 2.5: Remove Companies House & Planning from Government Cron

**File to modify:** `/src/app/api/cron/government/route.ts`

Remove these sections:
- Companies House sync (leadership signals)
- Planning Data sync

Keep:
- Contracts Finder sync
- Find a Tender sync

The removed features will be available in /labs for testing.

### Task 2.6: Remove signal types from ICP creation

**File to modify:** `/src/app/(dashboard)/icp/new/page.tsx`

Remove these signal type options:
- `leadership` (Companies House)
- `planning` (Planning Data)
- `funding` (Firecrawl - not implemented)

Keep:
- `job_pain` (core feature)
- `contracts_awarded` (Contracts Finder)
- `tenders` (Find a Tender)

### Task 2.7: Consolidate Cron Jobs

**Files to modify:**
- `/vercel.json` - Remove weekly/monthly cron schedules
- Optionally merge weekly/monthly logic into daily cron

**Current crons to keep:**
```json
{
  "crons": [
    { "path": "/api/cron/ingest-jobs", "schedule": "0 */4 * * *" },
    { "path": "/api/cron/generate-pain-signals", "schedule": "30 6 * * *" },
    { "path": "/api/cron/government", "schedule": "0 5 * * *" },
    { "path": "/api/cron/process-scan-queue", "schedule": "*/15 * * * *" },
    { "path": "/api/cron/rescan-icp-jobs", "schedule": "0 6,12,18 * * *" }
  ]
}
```

**Remove:**
- `/api/cron/daily` (merge into generate-pain-signals if needed)
- `/api/cron/weekly`
- `/api/cron/monthly`

---

## Phase 3: Update Navigation & UI

### Task 3.1: Simplify Sidebar

**File:** `/src/components/Sidebar.tsx`

New navigation structure:
```
Dashboard (/)
ICP Profiles (/icp)
Companies in Pain (/pain)
All Signals (/signals)
Export (/export)
Settings (/settings)
---
Labs (/labs) [NEW - external link or subtle link]
```

Remove:
- Search
- Agency
- Sources

### Task 3.2: Update Dashboard Home

**File:** `/src/app/(dashboard)/dashboard/page.tsx`

Simplify to show:
- Total companies in pain
- New signals today
- Top 5 highest pain companies
- Quick link to create ICP if none exist

Remove:
- Generic signals count (focus on pain signals)
- Sources count

### Task 3.3: Add "Labs" link to footer or settings

Add a subtle link to /labs from:
- Settings page footer
- Or a small "Labs" badge in sidebar

---

## Phase 4: Clean Up Types & Code

### Task 4.1: Mark deprecated types

**File:** `/src/types/index.ts`

Add comments:
```typescript
// DEPRECATED - Search Profiles (removed in v2)
export interface SearchProfile { ... }

// DEPRECATED - Search Runs (removed in v2)
export interface SearchRun { ... }
```

### Task 4.2: Remove unused imports

After removing features, clean up imports in:
- Layout files
- Sidebar
- Any components that imported removed features

### Task 4.3: Update ICPSignalType

**File:** `/src/types/index.ts`

Change from:
```typescript
export type ICPSignalType =
  | 'job_pain'
  | 'contracts_awarded'
  | 'tenders'
  | 'planning'      // REMOVE
  | 'leadership'    // REMOVE
  | 'funding';      // REMOVE
```

To:
```typescript
export type ICPSignalType =
  | 'job_pain'
  | 'contracts_awarded'
  | 'tenders';

// Experimental signal types (available in /labs only)
export type LabsSignalType =
  | 'planning'
  | 'leadership'
  | 'funding';
```

---

## Phase 5: Database Cleanup (Optional)

### Task 5.1: Create migration to clean old data

**File:** `/scripts/cleanup-deprecated-features.sql`

```sql
-- Mark old search profiles as inactive
UPDATE search_profiles SET is_active = false WHERE is_active = true;

-- Mark old sources as inactive
UPDATE sources SET is_active = false WHERE is_active = true;

-- Optionally: Delete signals from deprecated sources
-- DELETE FROM signals WHERE signal_type IN ('planning_submitted', 'planning_approved', 'leadership_change');
```

**Note:** Don't delete data, just deactivate. Can be cleaned up later.

---

## Phase 6: Improve Core Value (Post-Simplification)

These improvements should be done AFTER the simplification is complete.

### Task 6.1: Better Repost Detection

**Problem:** Current fingerprint matching for detecting job reposts is imperfect.

**Current Logic:**
- Fingerprint = `company_id + job_title + location`
- If same fingerprint appears again = repost

**Improvements:**
- Add fuzzy title matching (handle "Senior Developer" vs "Sr. Developer")
- Normalize location strings (handle "London" vs "London, UK")
- Track `job_id` from Reed to detect true reposts vs similar jobs
- Add confidence score to repost detection

**Files to modify:**
- `/src/lib/signals/job-signal-generator.ts` - Improve fingerprint logic
- `/src/app/api/cron/rescan-icp-jobs/route.ts` - Better duplicate detection

### Task 6.2: Better Salary Tracking

**Problem:** Not all jobs have salary data, and salary increases aren't tracked well.

**Current State:**
- `job_observations` table exists but underutilized
- Only records salary at first observation

**Improvements:**
- Record every salary observation with timestamp
- Calculate salary change percentage over time
- Handle salary ranges (min/max) separately
- Flag jobs where salary was added (from none to some)

**Files to modify:**
- `/src/lib/signals/job-signal-generator.ts` - Track salary history
- `/src/app/api/cron/rescan-icp-jobs/route.ts` - Compare salary changes

### Task 6.3: Better Domain Resolution

**Problem:** Many companies have no domain, making enrichment impossible.

**Current State:**
- Reed provides `employerProfileName` but not domain
- We guess domain from company name (unreliable)

**Improvements:**
- Use company name + location for Google search to find domain
- Cache successful domain lookups
- Add manual domain entry in UI
- Try LeadMagic company enrichment before contact enrichment

**Files to modify:**
- `/src/lib/domain-resolver.ts` - Improve resolution logic
- `/src/app/api/companies/[id]/enrich/route.ts` - Try company lookup first

### Task 6.4: Rate Limit UI

**Problem:** Users don't know how many API calls they've used.

**Improvements:**
- Add usage display to settings page
- Show "X/100 Reed API calls used today"
- Show "Y ICP profiles using Z% of daily budget"
- Warning when approaching limit

**Files to modify:**
- `/src/app/(dashboard)/settings/page.tsx` - Add usage display
- `/src/app/api/settings/usage/route.ts` - NEW: Return usage stats

---

## Phase 7: Enhance UX (Post-Simplification)

### Task 7.1: Onboarding Flow

**Problem:** New users don't know where to start.

**Improvements:**
- If no ICP profiles exist, show onboarding wizard on dashboard
- Step 1: "What industry do you recruit for?"
- Step 2: "What roles do you typically place?"
- Step 3: "Where are your clients based?"
- Auto-create first ICP profile from answers
- Trigger initial scan automatically

**Files to create:**
- `/src/components/OnboardingWizard.tsx` - Multi-step wizard

**Files to modify:**
- `/src/app/(dashboard)/dashboard/page.tsx` - Show wizard if no ICPs

### Task 7.2: Signal Explanations

**Problem:** Users don't understand why signals matter.

**Current State:**
- Shows "Hard to fill 90+ days" but no explanation

**Improvements:**
- Add "Why this matters" tooltip/expand to each signal type
- Example: "This job has been open 90+ days AND is still being actively promoted. The company is paying to advertise but failing to hire - a clear sign of hiring pain."
- Add recommended actions: "Reach out offering your candidates"

**Files to modify:**
- `/src/app/(dashboard)/pain/page.tsx` - Add explanations
- `/src/components/PainSignalCard.tsx` - NEW or modify existing

### Task 7.3: One-Click Actions

**Problem:** Too many clicks to take action on a lead.

**Current State:**
- Must enrich, then view contacts, then copy email

**Improvements:**
- Add quick action buttons to company cards:
  - "Copy Email" - Copy first contact email
  - "Add to HubSpot" - One-click push
  - "View Job" - Open job posting
  - "Start Sequence" - Future integration
- Keyboard shortcuts for power users

**Files to modify:**
- `/src/app/(dashboard)/pain/page.tsx` - Add action buttons

### Task 7.4: Dashboard Metrics

**Problem:** No way to measure effectiveness.

**Improvements:**
- Track how many leads were exported
- Track how many contacts were enriched
- Show weekly/monthly trends
- (Future) Track response rates if HubSpot connected

**Files to create:**
- `/src/app/api/analytics/route.ts` - Return metrics

**Files to modify:**
- `/src/app/(dashboard)/dashboard/page.tsx` - Show metrics

---

## Phase 8: Technical Debt (Low Priority)

### Task 8.1: Consolidate Signal Tables

**Problem:** Two signal tables with overlapping data.

**Current State:**
- `signals` - Generic signals from various sources
- `company_pain_signals` - Job-related pain signals

**Recommendation:** Keep both for now, but consider merging in future.
- Add `source` column to unified table
- Migrate existing data
- Update all queries

### Task 8.2: Add Tests

**Problem:** No automated tests for signal calculation.

**Improvements:**
- Unit tests for `job-signal-generator.ts`
- Test each signal type: hard-to-fill, stale, repost, salary increase
- Test edge cases: missing dates, zero salaries, etc.

**Files to create:**
- `/src/lib/signals/__tests__/job-signal-generator.test.ts`

### Task 8.3: Error Monitoring

**Problem:** Cron failures go unnoticed.

**Improvements:**
- Add Sentry or similar error tracking
- Log cron execution times and results
- Alert on consecutive failures
- Dashboard widget for cron health

**Files to modify:**
- All cron routes - Add error reporting

---

## Implementation Order

### Sprint 1: Create Labs Page (Low Risk)
1. [ ] Create `/src/app/labs/layout.tsx`
2. [ ] Create `/src/app/labs/page.tsx`
3. [ ] Create `/src/app/api/labs/companies-house/route.ts`
4. [ ] Create `/src/app/api/labs/planning/route.ts`
5. [ ] Create `/src/app/api/labs/tenders/route.ts`
6. [ ] Test labs page works independently
7. [ ] Deploy

### Sprint 2: Remove Features (Medium Risk)
1. [ ] Remove Search Profiles pages and routes
2. [ ] Remove Agency Finder pages and routes
3. [ ] Remove URL Sources pages and routes
4. [ ] Update Sidebar navigation
5. [ ] Test navigation works
6. [ ] Deploy

### Sprint 3: Simplify Backend (Medium Risk)
1. [ ] Remove Adzuna from job-boards.ts
2. [ ] Remove Companies House from government cron
3. [ ] Remove Planning Data from government cron
4. [ ] Remove deprecated signal types from ICP creation
5. [ ] Consolidate cron jobs
6. [ ] Test cron jobs still work
7. [ ] Deploy

### Sprint 4: Cleanup (Low Risk)
1. [ ] Update types with deprecation comments
2. [ ] Remove unused imports
3. [ ] Update dashboard home page
4. [ ] Add Labs link to settings
5. [ ] Run database cleanup migration
6. [ ] Deploy

---

### Sprint 5: Improve Core Value (Medium Effort)
1. [ ] Improve repost detection fingerprint logic
2. [ ] Better salary tracking with history
3. [ ] Improve domain resolution
4. [ ] Add rate limit usage display to settings
5. [ ] Test improvements
6. [ ] Deploy

### Sprint 6: Enhance UX (Medium Effort)
1. [ ] Create onboarding wizard component
2. [ ] Add signal explanations with "Why this matters"
3. [ ] Add one-click actions (Copy Email, View Job)
4. [ ] Add dashboard metrics display
5. [ ] Test UX improvements
6. [ ] Deploy

### Sprint 7: Technical Debt (Low Priority)
1. [ ] Add unit tests for signal generator
2. [ ] Add error monitoring/logging
3. [ ] (Optional) Consolidate signal tables
4. [ ] Deploy

---

## Files Summary

### Files to Create

**Simplification (Sprints 1-4):**
```
/src/app/labs/layout.tsx
/src/app/labs/page.tsx
/src/app/api/labs/companies-house/route.ts
/src/app/api/labs/planning/route.ts
/src/app/api/labs/tenders/route.ts
/scripts/cleanup-deprecated-features.sql
```

**Improvements (Sprints 5-7):**
```
/src/app/api/settings/usage/route.ts        # Rate limit display
/src/components/OnboardingWizard.tsx        # New user onboarding
/src/components/PainSignalCard.tsx          # Signal explanations
/src/app/api/analytics/route.ts             # Dashboard metrics
/src/lib/signals/__tests__/job-signal-generator.test.ts  # Unit tests
```

### Files to Delete
```
/src/app/(dashboard)/search/page.tsx
/src/app/(dashboard)/search/new/page.tsx
/src/app/(dashboard)/search/[id]/page.tsx
/src/app/(dashboard)/search/[id]/run/page.tsx
/src/app/(dashboard)/agency/page.tsx
/src/app/(dashboard)/sources/page.tsx
/src/app/(dashboard)/sources/add/page.tsx
/src/app/api/search/profiles/route.ts
/src/app/api/search/profiles/[id]/route.ts
/src/app/api/search/profiles/[id]/analyze/route.ts
/src/app/api/search/run/route.ts
/src/app/api/search/run/stream/route.ts
/src/app/api/search/history/route.ts
/src/app/api/agency/analyze/route.ts
/src/app/api/agency/search/route.ts
/src/app/api/agency/save/route.ts
/src/app/api/sources/route.ts
/src/app/api/sources/[id]/route.ts
/src/app/api/sources/[id]/scrape/route.ts
/src/app/api/cron/weekly/route.ts
/src/app/api/cron/monthly/route.ts
```

### Files to Modify

**Simplification (Sprints 1-4):**
```
/src/components/Sidebar.tsx
/src/app/(dashboard)/dashboard/page.tsx
/src/app/(dashboard)/icp/new/page.tsx
/src/app/api/cron/government/route.ts
/src/app/api/cron/ingest-jobs/route.ts
/src/lib/job-boards.ts
/src/types/index.ts
/vercel.json
```

**Improvements (Sprints 5-7):**
```
/src/lib/signals/job-signal-generator.ts    # Better repost/salary detection
/src/app/api/cron/rescan-icp-jobs/route.ts  # Salary change detection
/src/lib/domain-resolver.ts                 # Better domain resolution
/src/app/api/companies/[id]/enrich/route.ts # Company lookup first
/src/app/(dashboard)/settings/page.tsx      # Rate limit display
/src/app/(dashboard)/pain/page.tsx          # Signal explanations, one-click actions
```

---

## Expected Outcomes

### After Simplification (Sprints 1-4)

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| API routes | 37 | ~22 | -40% |
| UI pages | 15 | ~10 | -33% |
| Signal types | 6 | 3 core + 3 labs | Focused |
| Cron jobs | 7 | 5 | -29% |
| Navigation items | 8+ | 6 | Simplified |

### After Improvements (Sprints 5-7)

| Feature | Current | Improved |
|---------|---------|----------|
| Repost detection | ~60% accurate | ~85% accurate |
| Salary tracking | First observation only | Full history |
| Domain resolution | ~40% success | ~70% success |
| New user experience | Blank dashboard | Guided onboarding |
| Signal clarity | Technical labels | "Why this matters" |
| Action time | 3-4 clicks | 1 click |

### Benefits
1. **Easier maintenance** - Less code to maintain
2. **Better UX** - Users focus on what works
3. **Faster development** - Can iterate on core features
4. **Lower costs** - Fewer API calls to broken services
5. **Clearer value prop** - "Find companies struggling to hire"
6. **Higher accuracy** - Better signal detection
7. **Better onboarding** - New users succeed faster
8. **Actionable insights** - Users understand why signals matter

---

## Success Criteria

### Simplification (Sprints 1-4)
1. [ ] Labs page accessible at /labs with all experimental features
2. [ ] Main app navigation only shows working features
3. [ ] All cron jobs run without errors
4. [ ] Pain signals still generate correctly
5. [ ] Contact enrichment still works
6. [ ] CSV export still works
7. [ ] No broken links in navigation
8. [ ] Build passes with no TypeScript errors

### Improvements (Sprints 5-7)
9. [ ] Rate limit usage visible in settings
10. [ ] Onboarding wizard shown for new users with no ICPs
11. [ ] Signal explanations visible on pain dashboard
12. [ ] One-click copy email works
13. [ ] Repost detection correctly identifies repeated job postings
14. [ ] Salary increases tracked over time
15. [ ] Unit tests pass for signal generator

---

## Rollback Plan

If issues arise:
1. Features are only hidden, not deleted from database
2. Git history preserves all deleted code
3. Can re-add features by reverting commits
4. Database tables remain intact

---

## Questions to Resolve

1. Should /labs require authentication?
   - Recommendation: No auth for simplicity, but rate limit

2. Should we keep historical data from removed features?
   - Recommendation: Yes, just mark inactive

3. Should HubSpot integration be removed?
   - Recommendation: Keep for now, it's low maintenance

4. Should we add analytics to track feature usage?
   - Recommendation: Yes, add basic tracking to know what's used

---

*Document created: December 2024*
*Last updated: December 2024*
*Author: Claude Code Assistant*
