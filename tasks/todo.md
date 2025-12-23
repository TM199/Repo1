# Signal Mentis Improvement Plan

Based on comprehensive business analysis. Focus: Make the product viable for sales teams.

## Current State Summary
- **Working**: Signal detection (Gov APIs + Firecrawl), Lead enrichment (LeadMagic + Prospeo), CSV export
- **Fixed (Dec 2024)**: Search/filter on signals page, Domain extraction, Leadership detection
- **Missing**: CRM integration, Activity tracking

---

## Signal Detection Engine v2 - Hard to Fill vs Stale Distinction - COMPLETED

### Goal
Fix pain signal generation to distinguish between:
- **Hard to Fill** (HIGH VALUE): Jobs open 90+ days AND still being actively refreshed
- **Stale/Abandoned** (LOWER VALUE): Jobs open 90+ days but NOT seen recently

### Key Insight
We already track `last_seen_at` in job_postings - we just need to USE it in signal generation.

### Implementation Steps

#### Phase 1: Core Signal Logic Fix (Critical)

- [x] **1. Create signal detection library**
  - File: `src/lib/signals/detection.ts`
  - Add PAIN_SCORES config with hard_to_fill and stale variants
  - Add REFRESH_THRESHOLD_DAYS constant (14 days)
  - Signal types: hard_to_fill_30/60/90, stale_job_30/60/90

- [x] **2. Fix generate-pain-signals cron**
  - File: `src/app/api/cron/generate-pain-signals/route.ts`
  - Import detection functions from @/lib/signals/detection
  - Calculate `daysSinceRefresh` from `last_seen_at`
  - Use determineJobSignalType() to get signal config
  - Use generateSignalTitle() and generateSignalDetail() for signal text
  - Track hard_to_fill_signals in stats
  - Check for both stale and hard_to_fill variants when looking for existing signals
  - Handle signal type transitions (stale->hard_to_fill)

- [x] **3. Update ICP scan route**
  - File: `src/app/api/icp/[id]/scan/route.ts`
  - Apply same hard_to_fill vs stale logic
  - Include `days_since_refresh` in signal detail

- [x] **4. Add days_since_refresh column to pain signals**
  - File: `scripts/migrate-signal-refresh-tracking.sql`
  - Add column to track when signal was last refreshed

#### Phase 2: UI Updates

- [x] **5. Update CompaniesInPainDashboard**
  - File: `src/components/dashboard/CompaniesInPainDashboard.tsx`
  - Show "ACTIVE" badge for hard_to_fill signals
  - Show "POSSIBLY STALE" badge for stale signals
  - Display refresh context on cards
  - Updated stats card to show "Actively Recruiting" count

- [x] **6. Update signal explanations**
  - File: `src/lib/signal-explanations.ts`
  - Add explanations for new signal types (hard_to_fill_30/60/90)
  - Update stale_job explanations to clarify they're potentially abandoned

#### Phase 3: Optimise Enrichment

- [x] **7. Create enrichment priority logic**
  - File: `src/lib/signals/enrichment.ts` (new)
  - Prioritise hard_to_fill signals for Firecrawl enrichment
  - Skip stale signals to save API costs
  - Sort companies by presence of hard_to_fill signals first

- [x] **8. Enrichment cron ready**
  - No existing enrichment cron to update
  - New library ready to use when enrichment cron is created

#### Phase 4: Testing & Verification

- [x] **9. Build passes**
  - All TypeScript compiles correctly
  - No errors

- [ ] **10. Database migration required**
  - Run `scripts/migrate-signal-refresh-tracking.sql` in Supabase SQL Editor
  - Adds `days_since_refresh` column to `company_pain_signals`

---

## Previously Completed (Reference)

### Phase 1: Critical Fixes (P0) - COMPLETED
- [x] Search & Filter on Signals Page
- [x] Domain extraction fix
- [x] Leadership detection fix

### Phase 2: CRM Integration (P1) - COMPLETED
- [x] HubSpot Integration
- [x] Export Improvements

### Phase 3: Data Quality (P2) - COMPLETED
- [x] Industry Detection
- [x] Signal Confidence Scoring
- [x] Enrichment Data Quality

### Phase 5: Agency Finder - COMPLETED
- [x] Agency website analysis
- [x] Signal search with SSE streaming
- [x] Results with CSV export

### Signal Mentis v2.0 - ICP Architecture - COMPLETED
- [x] ICP profile system
- [x] Contract/Tender signal filtering
- [x] Search profile to pain analysis

---

## Review - Signal Detection Engine v2 Complete

### Summary of Changes

**Core Problem Fixed:**
The system was ignoring `last_seen_at` when generating pain signals, showing jobs as "stale" even when companies were actively refreshing them. Now we distinguish between:
- **Hard to Fill** (high value): Old job + recently refreshed = confirmed active pain
- **Stale** (lower value): Old job + not refreshed = possibly abandoned

### Files Created
- `src/lib/signals/detection.ts` - Central config for pain scores and signal type determination
- `src/lib/signals/enrichment.ts` - Enrichment priority logic (prioritize hard_to_fill)
- `scripts/migrate-signal-refresh-tracking.sql` - Database migration for days_since_refresh column

### Files Modified
- `src/app/api/cron/generate-pain-signals/route.ts` - Uses new detection logic, tracks hard_to_fill vs stale
- `src/app/api/icp/[id]/scan/route.ts` - Uses new detection logic for ICP scans
- `src/components/dashboard/CompaniesInPainDashboard.tsx` - Shows ACTIVE/STALE badges, updated stats
- `src/lib/signal-explanations.ts` - Added explanations for new signal types

### Key Implementation Details

**Pain Scores (from detection.ts):**
| Signal Type | Pain Score | Urgency |
|-------------|------------|---------|
| hard_to_fill_90 | 35 | immediate |
| hard_to_fill_60 | 20 | immediate |
| hard_to_fill_30 | 8 | short_term |
| stale_job_90 | 25 | immediate |
| stale_job_60 | 15 | short_term |
| stale_job_30 | 5 | medium_term |

**Refresh Threshold:** 14 days
- Jobs seen within 14 days = "actively recruiting" = hard_to_fill
- Jobs NOT seen in 14+ days = "possibly abandoned" = stale

**UI Updates:**
- Green "ACTIVE" badge for hard_to_fill signals
- Amber "POSSIBLY STALE" badge for stale signals
- New "Actively Recruiting" stat in dashboard header

### Database Migration Required
Run in Supabase SQL Editor:
```sql
ALTER TABLE company_pain_signals
ADD COLUMN IF NOT EXISTS days_since_refresh INTEGER;
```

### Build Status
- Build successful
- All TypeScript compiles
- No errors
