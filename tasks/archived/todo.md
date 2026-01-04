# Sprint 3: Enhanced Job Board Analysis

## Status: COMPLETE ✓

## Deployment Summary

- **Migration**: ✓ Run in Supabase
- **Deployment**: ✓ Deployed to Vercel
- **Domain Backfill**: ✓ Executed

### Domain Coverage Results
```
Total companies: 813
With domain: 216 (26.6%)
Without domain: 597 (73.4%)
```

**Note:** The 26.6% coverage is realistic for Reed data. Many companies are small UK businesses (care homes, local services) that don't have searchable web presence. The domain resolver uses:
- Google search via Firecrawl (12 domains resolved)
- DNS validation guessing (97 domains resolved)
- Many small businesses simply don't have discoverable websites

### Key Finding: Reed API Does NOT Provide Employer URLs

Reed only provides `employerId`, `employerName`, `employerProfileId` - NO website URL.
Domain resolution happens via our domain-resolver for all Reed companies.

---

## Implementation Completed

### PRIORITY 1: Domain Backfill (CRITICAL - 86.7% missing)

- [x] 1.1 Create `/src/lib/company/backfill-domains.ts`
  - `backfillDomainResolution(batchSize)` function
  - Uses existing `resolveDomain()` from domain-resolver.ts
  - Rate limit: 500ms between attempts
  - Tracks results: { total, resolved, still_unresolved }

- [x] 1.2 Create admin endpoint `/api/admin/backfill-domains/route.ts`
  - Trigger backfill manually with query params
  - Returns stats before/after

- [x] 1.3 Run backfill - achieved 26.6% coverage (realistic for Reed data)

### PRIORITY 2: Update Job Ingestion Pipeline

- [x] 2.1 Update job ingestion to resolve domains for NEW companies
  - After creating a NEW company, triggers `resolveDomain()`
  - Stores result in `domain` and `domain_source` columns

- [x] 2.2 Add department classification
  - Created `/src/lib/jobs/department-classifier.ts`
  - DEPARTMENT_PATTERNS: Engineering, Sales, Operations, Finance, HR, Marketing, Customer Success, Product, Legal
  - Function: `classifyJobByDepartment(title)`

- [x] 2.3 Add urgency detection
  - Created `/src/lib/jobs/urgency-detector.ts`
  - HIGH: urgent, immediately, asap, critical, must start
  - MEDIUM: growing team, expanding, scaling, building out
  - Function: `detectUrgencyLevel(description)`

- [x] 2.4 Create migration for job_postings columns
  - `scripts/migrate-job-postings-sprint3.sql`
  - Adds: `department`, `urgency_level`, `has_urgency_keywords`

- [x] 2.5 Update job ingestion cron with classifiers

### PRIORITY 3: New Signal Types

- [x] 3.1 Implement `detectMultipleOpenRoles(companyId)`
  - Created `/src/lib/signals/job-analysis-signals.ts`
  - Thresholds: 5-9 (10pts), 10-19 (20pts), 20+ (30pts)

- [x] 3.2 Implement `detectDepartmentConcentration(companyId)`
  - Triggers when 50%+ of open roles in one department
  - Minimum 3 roles in department
  - Pain score: 25 + (percentage/10), max 40

- [x] 3.3 Implement urgency boost
  - High urgency: +10 pain score
  - Medium urgency: +5 pain score
  - Stored in signal metadata

- [x] 3.4 Add signal types to PAIN_SCORES config
  - `department_hiring_concentration`
  - `multiple_open_roles_significant`
  - `multiple_open_roles_mass`

- [x] 3.5 Update generate-pain-signals cron
  - Added STEP 6: Multiple open roles + department concentration
  - Updated step numbers (7 = recalculate, 8 = deactivate, 9 = notify)
  - Includes new signals in notification count

---

## Deployment Steps (DONE)

1. ✓ **Run migration** in Supabase SQL Editor
2. ✓ **Deploy to Vercel**
3. ✓ **Run domain backfill** - achieved 26.6% coverage

**Check stats command**:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://signal-mentis.vercel.app/api/admin/backfill-domains?statsOnly=true"
```

---

## Review

### Summary of Changes

Sprint 3 Enhanced Job Board Analysis implemented:

1. **Domain Backfill Utility** (`src/lib/company/backfill-domains.ts`):
   - `backfillDomainResolution()` - processes companies without domains
   - `getDomainCoverageStats()` - returns coverage statistics
   - Uses existing domain-resolver with rate limiting (500ms)

2. **Admin Endpoint** (`src/app/api/admin/backfill-domains/route.ts`):
   - Protected by CRON_SECRET
   - Query params: `batch`, `skipGoogle`, `statsOnly`
   - Returns before/after coverage stats

3. **Department Classifier** (`src/lib/jobs/department-classifier.ts`):
   - 9 departments: Engineering, Sales, Operations, Finance, HR, Marketing, Customer Success, Product, Legal
   - Pattern-based classification from job titles
   - `classifyJobByDepartment()`, `classifyJobsByDepartment()`

4. **Urgency Detector** (`src/lib/jobs/urgency-detector.ts`):
   - High urgency patterns: urgent, asap, immediately, critical
   - Medium urgency patterns: growing team, scaling, expanding
   - `detectUrgencyLevel()`, `getUrgencyBoost()`, `hasUrgencyKeywords()`

5. **Job Analysis Signals** (`src/lib/signals/job-analysis-signals.ts`):
   - `detectMultipleOpenRoles()` - 5+ open roles (10-30 pts)
   - `detectDepartmentConcentration()` - 50%+ in one dept (25-40 pts)

6. **Updated Job Ingestion** (`src/app/api/cron/ingest-jobs/route.ts`):
   - Domain resolution for NEW companies
   - Department classification on ingest
   - Urgency detection on ingest

7. **Updated Signal Generation** (`src/app/api/cron/generate-pain-signals/route.ts`):
   - Added STEP 6: Multiple open roles + department concentration signals
   - Urgency boost applied to stale job signals (+10 high, +5 medium)
   - New stats: `multiple_open_roles_signals`, `department_concentration_signals`, `urgency_boosts_applied`

8. **Updated Detection Config** (`src/lib/signals/detection.ts`):
   - Added `department_hiring_concentration` (30 pts)
   - Added `multiple_open_roles_significant` (20 pts)
   - Added `multiple_open_roles_mass` (30 pts)

9. **Migration SQL** (`scripts/migrate-job-postings-sprint3.sql`):
   - Adds columns: `department`, `urgency_level`, `has_urgency_keywords`
   - Adds indexes for performance

### Files Changed

| File | Action | Description |
|------|--------|-------------|
| `src/lib/company/backfill-domains.ts` | Created | Domain backfill utility |
| `src/app/api/admin/backfill-domains/route.ts` | Created | Admin endpoint |
| `src/lib/jobs/department-classifier.ts` | Created | Department classification |
| `src/lib/jobs/urgency-detector.ts` | Created | Urgency detection |
| `src/lib/signals/job-analysis-signals.ts` | Created | New signal detection |
| `scripts/migrate-job-postings-sprint3.sql` | Created | Database migration |
| `src/app/api/cron/ingest-jobs/route.ts` | Modified | Added classifiers + domain resolution |
| `src/app/api/cron/generate-pain-signals/route.ts` | Modified | Added new signals + urgency boost |
| `src/lib/signals/detection.ts` | Modified | Added signal type configs |

### Next Steps

1. ✓ Run the database migration
2. ✓ Deploy to Vercel
3. ✓ Run domain backfill (achieved 26.6% coverage)
4. Run signal generation cron to verify new signals appear
5. Check dashboard displays new signal types correctly

---

## Enrichment & Contract Signal Improvements (Post-Sprint 3)

### LeadMagic Domain Extraction
- [x] Updated `src/lib/enrichment/leadmagic.ts` to capture `company_website` from response
- [x] Updated `src/lib/enrichment/index.ts` to extract domain from LeadMagic when we don't have one

### Custom Role Selection for Enrichment
- [x] Added `default_enrichment_roles` column to `user_settings` (migration: `scripts/migrate-enrichment-roles.sql`)
- [x] Updated Settings page with checkboxes for 10 default roles
- [x] Added role picker dropdown to SignalCard before enrichment
- [x] Updated enrichment API to accept `?roles=` query parameter
- [x] Created `enrichSignalWithRoles()` function for custom role selection

### Contract Signal Improvements
- [x] Added award date to signal detail (the most important info)
- [x] Improved signal titles with value tier (£1.5m, £100k format)
- [x] Added contract period, buyer, location to context
- [x] Cleaner description - first sentence only, max 200 chars

**Signal Detail Format:**
`[Description] | Awarded: 15 Dec 2024 • By NHS England • Value: £1.5m • Period: Jan 2025 - Dec 2025 • Location: London`

---

## Previous Sprints

### Sprint 2: Contracts Finder Integration (COMPLETE)
- CPV code mapping for industry classification
- Supplier sync with domain resolution
- Contract award signals (small, medium, large, first, multiple)
- Cron job at 6:00am daily

### Sprint 1: Companies House Integration (COMPLETE)
- Company matching with fuzzy logic
- Domain resolution (3 strategies)
- Leadership & expansion signal detection
- Cron job at 5:30am daily
