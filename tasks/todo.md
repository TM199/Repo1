# Sprint 5: Companies House Signal Integration

## Status: COMPLETE

## Review

### Summary of Changes
All Companies House signal integration tasks completed successfully:

1. **Migration SQL** - Created `scripts/migrate-ch-filings.sql` with:
   - `companies_house_filings` table for tracking processed filings
   - New columns on `companies`: `companies_house_last_checked`, `sic_codes`, `company_status`, `incorporation_date`
   - New columns on `company_pain_signals`: `confidence`, `source`, `source_filing_id`, `metadata`

2. **Domain Resolver** - Removed Clearbit (dead service), simplified to:
   - URL extraction (100% confidence)
   - Google search via Firecrawl (60% confidence)
   - DNS guessing with validation (40% confidence)

3. **Pain Scores** - Added 4 CH signal types to `detection.ts`:
   - `new_director_appointment` (25 pts)
   - `leadership_reorganisation` (30 pts)
   - `director_gap` (20 pts)
   - `capital_raise` (25 pts)

4. **Signal Detection** - Created `src/lib/companies-house/signals.ts`:
   - `detectLeadershipSignals()` - AP01/TM01 filings
   - `detectExpansionSignals()` - SH01/CC01 filings

5. **Company Sync** - Created `src/lib/companies-house/company-sync.ts`:
   - `syncCompanyFromCH()` - fetch CH → match/create company → resolve domain

6. **Cron Job** - Created `/api/cron/companies-house-signals`:
   - Processes companies with CH numbers (100/run)
   - 600ms rate limiting between API calls
   - Inserts to `company_pain_signals` table

7. **Schedule** - Added to `vercel.json`: runs 5:30am daily

### Files Changed
| File | Action |
|------|--------|
| `scripts/migrate-ch-filings.sql` | Created |
| `src/lib/domain-resolver.ts` | Modified (removed Clearbit) |
| `src/lib/signals/detection.ts` | Modified (added CH signals) |
| `src/lib/companies-house.ts` | Modified (exported getFilingHistory) |
| `src/lib/companies-house/signals.ts` | Created |
| `src/lib/companies-house/company-sync.ts` | Created |
| `src/app/api/cron/companies-house-signals/route.ts` | Created |
| `vercel.json` | Modified (added cron) |
| `src/lib/enrichment/index.ts` | Fixed (removed clearbit references) |

### Next Steps
1. Run `scripts/migrate-ch-filings.sql` in Supabase
2. Deploy to Vercel
3. Test by triggering `/api/cron/companies-house-signals` manually

---

## Implementation Tasks

### Phase 1: Database & Configuration
- [x] **A. Create migration SQL** (`scripts/migrate-ch-filings.sql`)
  - Create `companies_house_filings` table
  - Add columns to `companies`: `companies_house_last_checked`, `sic_codes`, `company_status`, `incorporation_date`
  - Add columns to `company_pain_signals`: `confidence`, `source`, `source_filing_id`, `metadata`

- [x] **B. Remove Clearbit from domain resolver** (`src/lib/domain-resolver.ts`)
  - Remove `lookupViaClearbit()` function (Clearbit acquired by HubSpot - dead)
  - Keep: URL extraction (100%), DNS guessing (40%), Firecrawl Google search (60%)

- [x] **C. Add CH pain scores** (`src/lib/signals/detection.ts`)
  - `new_director_appointment`: 25 points, immediate, 85% confidence
  - `leadership_reorganisation`: 30 points, immediate, 80% confidence
  - `director_gap`: 20 points, short_term, 70% confidence
  - `capital_raise`: 25 points, short_term, 75% confidence

- [x] **D. Export getFilingHistory** (`src/lib/companies-house.ts`)
  - Change line 266 from `async function` to `export async function`

### Phase 2: Signal Detection
- [x] **E. Create signal detection** (`src/lib/companies-house/signals.ts`)
  - `detectLeadershipSignals(companyId, chNumber, lookbackDays)` - AP01, TM01 filings
  - `detectExpansionSignals(companyId, chNumber, lookbackDays)` - SH01, CC01 filings
  - Export `SignalCandidate` type

- [x] **F. Create company sync** (`src/lib/companies-house/company-sync.ts`)
  - `syncCompanyFromCH(chNumber)` - fetch CH details → findOrCreateCompany → resolveDomain
  - Updates CH-specific fields (sic_codes, status, incorporation_date)

### Phase 3: Cron Job
- [x] **G. Create cron job** (`src/app/api/cron/companies-house-signals/route.ts`)
  - Verify CRON_SECRET
  - Get ICPs with 'leadership' signal type
  - Process companies with `companies_house_number` (limit 100)
  - Detect signals → insert to `company_pain_signals` (NOT legacy `signals` table)
  - Rate limit: 600ms between CH API calls
  - Recalculate company pain scores

- [x] **H. Update vercel.json**
  - Add cron schedule: `"30 5 * * *"` (5:30am daily, after government cron)

### Phase 4: Testing
- [ ] **I. End-to-end test** (Manual)
  - CH filing → signal → company with domain → enrichable
  - Verify signals appear with `source='companies_house'`

---

## Files to Modify

| File | Change |
|------|--------|
| `scripts/migrate-ch-filings.sql` | CREATE - Migration SQL |
| `src/lib/domain-resolver.ts` | MODIFY - Remove Clearbit |
| `src/lib/signals/detection.ts` | MODIFY - Add CH pain scores |
| `src/lib/companies-house.ts` | MODIFY - Export getFilingHistory |
| `src/lib/companies-house/signals.ts` | CREATE - Signal detection |
| `src/lib/companies-house/company-sync.ts` | CREATE - Company sync |
| `src/app/api/cron/companies-house-signals/route.ts` | CREATE - Cron job |
| `vercel.json` | MODIFY - Add cron schedule |

---

## Key Decisions

1. **Remove Clearbit** - Service acquired by HubSpot, no longer reliable free tier
2. **Use `company_pain_signals` table** - NOT the legacy `signals` table
3. **Rate limit** - 600ms between CH API calls (600 req/5min limit)
4. **Process limit** - 100 companies per cron run to stay within timeout

---

## Previous Sprints (Reference)

### Sprint 4: Smart Job Ingestion (Completed)
Fixed timeout by splitting job ingestion into 3 location groups.

### Sprint 3: Simplify Backend (Completed)
Removed Adzuna, Companies House from government cron.

### Sprint 2: Remove Low-Value Features (Completed)
Removed Search Profiles, Agency Finder, URL Sources.

### Sprint 1: Create Labs Page (Completed)
Created `/labs` page with Companies House, Planning, Tenders search.
