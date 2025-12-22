# Recruitment Agency Signal Finder - Implementation Plan

## Overview
A new feature that allows users to input a recruitment agency's domain, analyze their website to detect industry specializations, and generate 5-10 targeted signals that can be enriched and exported as CSV to send directly to the agency.

## User Flow
1. User enters agency website domain (+ optional LinkedIn URL)
2. System scrapes website with Firecrawl AI to detect industries/roles they recruit for
3. User reviews/adjusts detected specializations
4. System generates 5-10 relevant signals based on industry → signal type mapping
5. User can enrich signals with contacts, then export as CSV
6. Optionally save configuration as a reusable profile

---

## Phase 1: Core Infrastructure

### 1.1 Database Migration
Add columns to `search_profiles` table:
```sql
ALTER TABLE search_profiles ADD COLUMN IF NOT EXISTS is_agency_profile boolean DEFAULT false;
ALTER TABLE search_profiles ADD COLUMN IF NOT EXISTS agency_domain text;
ALTER TABLE search_profiles ADD COLUMN IF NOT EXISTS agency_linkedin text;
ALTER TABLE search_profiles ADD COLUMN IF NOT EXISTS agency_analysis jsonb;
```

### 1.2 Create Industry → Signal Mapping
**File:** `src/lib/agency-signal-mapping.ts`

```typescript
export const AGENCY_INDUSTRY_SIGNAL_MAP: Record<string, string[]> = {
  healthcare: ['cqc_rating_change', 'company_expansion', 'funding_announced', 'leadership_change'],
  construction: ['contract_awarded', 'planning_approved', 'planning_submitted', 'company_expansion'],
  technology: ['funding_announced', 'company_hiring', 'leadership_change', 'company_expansion'],
  manufacturing: ['contract_awarded', 'company_expansion', 'project_announced', 'funding_announced'],
  finance: ['funding_announced', 'leadership_change', 'acquisition_merger', 'regulatory_change'],
  energy: ['contract_awarded', 'project_announced', 'funding_announced', 'company_expansion'],
  logistics: ['contract_awarded', 'company_expansion', 'planning_approved'],
  property: ['planning_approved', 'planning_submitted', 'company_expansion', 'funding_announced'],
  retail: ['company_expansion', 'funding_announced', 'acquisition_merger'],
  education: ['funding_announced', 'company_expansion', 'regulatory_change'],
  legal: ['leadership_change', 'acquisition_merger', 'company_expansion'],
  hospitality: ['company_expansion', 'funding_announced', 'acquisition_merger'],
};
```

### 1.3 Create Agency Analyzer
**File:** `src/lib/agency-analyzer.ts`

Uses Firecrawl to scrape agency website with AI extraction prompt:
- Detect industries they specialize in
- Detect types of roles they recruit
- Detect focus (permanent/contract/temp)
- Return confidence scores

### 1.4 Create Analyze API Endpoint
**File:** `src/app/api/agency/analyze/route.ts`

- POST endpoint accepting `{ domain, linkedInUrl? }`
- Calls `analyzeAgencyWebsite()` from agency-analyzer.ts
- Returns detected industries, roles, focus, confidence scores

---

## Phase 2: Search & Results

### 2.1 Create Agency Search Endpoint
**File:** `src/app/api/agency/search/route.ts`

SSE streaming endpoint:
- Accepts `{ industries, signalTypes, locations, maxSignals: 10 }`
- Generates queries using existing `generateSearchQueries()` logic
- Limits to 2-3 queries, 5-10 signals max
- Streams signals as found
- Does NOT persist signals to DB (temporary until enriched/saved)

### 2.2 Create Results Panel Component
**File:** `src/components/dashboard/AgencyResultsPanel.tsx`

Displays found signals with:
- Signal cards (reuse existing `SignalCard` component)
- "Enrich" button per signal
- "Enrich All" button
- "Export CSV" button
- "Save as Profile" button

---

## Phase 3: UI & Navigation

### 3.1 Create Main Page
**File:** `src/app/(dashboard)/agency/page.tsx`

### 3.2 Create Client Component
**File:** `src/app/(dashboard)/agency/AgencyFinderClient.tsx`

Multi-step flow:
1. **Input Step**: Domain + LinkedIn URL inputs, "Analyze Agency" button
2. **Review Step**: Show detected industries (editable checkboxes), recommended signal types, location selector
3. **Searching Step**: Progress indicator while finding signals
4. **Results Step**: Signal list with enrich/export/save actions

### 3.3 Update Sidebar Navigation
**File:** `src/components/dashboard/Sidebar.tsx`

Add new nav item after "AI Search":
```typescript
{ href: '/agency', label: 'Agency Finder', icon: Building2 },
```

---

## Phase 4: Integration & Polish

### 4.1 Save as Profile
When user clicks "Save as Profile":
- POST to `/api/search/profiles` with agency-specific fields

### 4.2 Error Handling
- Invalid domain → validation error
- Website unreachable → retry suggestion
- Not a recruitment agency → manual industry selection
- No signals found → broaden criteria suggestion

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/lib/agency-signal-mapping.ts` | Industry → signal type mapping config |
| `src/lib/agency-analyzer.ts` | Website analysis with Firecrawl AI |
| `src/app/api/agency/analyze/route.ts` | Analyze agency endpoint |
| `src/app/api/agency/search/route.ts` | Signal search SSE endpoint |
| `src/app/(dashboard)/agency/page.tsx` | Main page (server) |
| `src/app/(dashboard)/agency/AgencyFinderClient.tsx` | Main UI (client) |
| `src/components/dashboard/AgencyResultsPanel.tsx` | Results display |

## Files to Modify

| File | Change |
|------|--------|
| `src/components/dashboard/Sidebar.tsx` | Add "Agency Finder" nav item |
| `src/types/index.ts` | Add `AgencyAnalysis` interface |

---

## Implementation Order

- [ ] 1. Database migration (SQL)
- [ ] 2. `agency-signal-mapping.ts`
- [ ] 3. `agency-analyzer.ts`
- [ ] 4. `/api/agency/analyze` endpoint
- [ ] 5. Test analysis with real agency websites
- [ ] 6. `/api/agency/search` endpoint
- [ ] 7. `AgencyResultsPanel` component
- [ ] 8. `AgencyFinderClient` with full flow
- [ ] 9. `/agency/page.tsx`
- [ ] 10. Update Sidebar
- [ ] 11. Save as profile integration
- [ ] 12. End-to-end testing

---

## Key Technical Decisions

1. **Signal Limit (5-10)**: Limit at query generation level - 2-3 queries max, stop once 10 signals found
2. **LinkedIn Fallback**: Try LinkedIn if provided, catch and ignore blocking errors, continue with domain-only
3. **Temporary Signals**: Store in client state initially, only persist when enriched or saved as profile
4. **Reuse Existing Code**: Use existing search.ts query generation, firecrawl.ts patterns, export.ts, and enrichment pipeline

---

## Estimated Effort: 7-8 hours
