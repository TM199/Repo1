# Signal Mentis Implementation Plan

## Phase 1: Fix Search Reliability
- [x] Add timeout wrapper function to `src/lib/search.ts`
- [x] Apply timeout to Firecrawl search calls (10s)
- [x] Apply timeout to Firecrawl scrape calls (15s)
- [x] Reduce default queries from 3 to 2

## Phase 2: Decision Maker Mapping Framework
- [x] Create `src/lib/contact-mapping.ts` with department detection
- [x] Add signal type to role mapping
- [x] Add `getTargetRoles` function

## Phase 3: Lead Enrichment Integration
- [x] Create `src/lib/enrichment/leadmagic.ts` - LeadMagic API wrapper
- [x] Create `src/lib/enrichment/prospeo.ts` - Prospeo API wrapper
- [x] Create `src/lib/enrichment/index.ts` - Enrichment orchestrator
- [x] Create `src/app/api/signals/[id]/enrich/route.ts` - API endpoint
- [x] Update `src/types/index.ts` with Contact interfaces
- [x] Update `src/app/(dashboard)/settings/page.tsx` with API key fields
- [x] Update `src/components/dashboard/SignalCard.tsx` with Enrich button
- [x] Update `src/components/dashboard/SignalsTable.tsx` with contacts column

## Phase 4: Enhanced Exports
- [x] Update `src/lib/export.ts` to include contact fields

## Database Migrations (Manual - YOU NEED TO DO THIS)

Run this SQL in your Supabase dashboard:

```sql
-- 1. Add API key columns to user_settings
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS leadmagic_api_key text;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS prospeo_api_key text;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS enrichment_include_phone boolean DEFAULT false;

-- 2. Create signal_contacts table
CREATE TABLE IF NOT EXISTS signal_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id uuid REFERENCES signals(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  first_name text,
  last_name text,
  job_title text,
  email text,
  email_status text,
  phone text,
  linkedin_url text,
  enrichment_source text,
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signal_contacts_signal_id ON signal_contacts(signal_id);
```

---

## Review

### Summary of Changes

**Phase 1: Search Reliability**
- Added `withTimeout()` wrapper function to `search.ts`
- Wrapped Firecrawl search calls with 10s timeout
- Wrapped Firecrawl scrape calls with 15s timeout
- Reduced default query count from 3 to 2 for faster searches

**Phase 2: Contact Mapping**
- Created `contact-mapping.ts` with smart role detection
- Maps signal types to relevant decision maker titles (e.g., funding → CEO/CFO/VP Sales)
- Detects department from job titles for hiring signals

**Phase 3: Enrichment Integration**
- Created LeadMagic API wrapper (finds people by role at company)
- Created Prospeo API wrapper (finds email + phone)
- Created enrichment orchestrator that loops through roles (one API call per role)
- Created `/api/signals/[id]/enrich` endpoint
- Added API key fields to Settings page (LeadMagic, Prospeo, phone toggle)
- Added Enrich button to SignalCard (shows when no contacts exist)
- Added contacts display section to SignalCard (name, title, email/phone/LinkedIn icons)
- Added Contacts column to SignalsTable

**Phase 4: Export**
- Updated CSV export to include contact fields
- One row per contact (signal info repeated)

### Files Created
- `src/lib/contact-mapping.ts`
- `src/lib/enrichment/leadmagic.ts`
- `src/lib/enrichment/prospeo.ts`
- `src/lib/enrichment/index.ts`
- `src/app/api/signals/[id]/enrich/route.ts`

### Files Modified
- `src/lib/search.ts` - timeout wrapper + reduced queries
- `src/types/index.ts` - added SignalContact interface + UserSettings fields
- `src/app/(dashboard)/settings/page.tsx` - API key inputs
- `src/components/dashboard/SignalCard.tsx` - Enrich button + contacts display
- `src/components/dashboard/SignalsTable.tsx` - contacts column
- `src/lib/export.ts` - contact fields in CSV

### Next Steps
1. **Run the database migrations** in Supabase (see SQL above)
2. Add your LeadMagic and Prospeo API keys in Settings
3. Test the Enrich button on a signal

---

## Signal Insertion Bug Fix (December 2024)

### Problem
Signals from Firecrawl API were not being inserted into the Supabase signals table.

### Root Causes Identified

1. **BUG 1 (CRITICAL)**: Signals API at `src/app/api/signals/route.ts:21` was filtering on `.eq('user_id', user.id)` but the `user_id` column **does not exist** in the signals table. This caused the API to return 0 results silently.

2. **BUG 2 (DATA LEAK)**: Dashboard and Signals pages used admin client without filtering by user - ALL users could see ALL signals.

3. **BUG 3 (MINOR)**: TypeScript `Source` interface had `updated_at` field that doesn't exist in the database.

4. **BUG 5 (CRITICAL)**: Deduplication only checked within same source/type, but database has GLOBAL UNIQUE constraint on `hash`. This caused batch insert failures when the same signal was scraped from different sources.

### Changes Made

- [x] Created `src/lib/supabase/queries.ts` - Helper functions for user-filtered signals
- [x] Fixed `src/app/api/signals/route.ts` - Removed invalid user_id filter, added user filtering through sources/search_runs
- [x] Fixed `src/app/(dashboard)/dashboard/page.tsx` - Now filters signals by user
- [x] Fixed `src/app/(dashboard)/signals/page.tsx` - Now filters signals by user
- [x] Fixed `src/app/api/signals/export/route.ts` - Now filters signals by user
- [x] Fixed `src/types/index.ts` - Removed `updated_at` from Source interface
- [x] Fixed `src/lib/signals.ts` - Global deduplication (checks ALL hashes, not just current source)
- [x] Fixed `src/lib/search.ts` - Global deduplication (checks ALL hashes, not just search type)

### Impact

- **Minimal code changes**: Each fix is targeted and only changes necessary lines
- **No breaking changes**: All existing functionality preserved
- **Security improvement**: Users now only see their own signals
- **Data integrity improvement**: Global deduplication prevents hash constraint violations

---

## UX Enhancement: Real-Time Streaming (December 2024)

### Goal
Create a sleek, Clay.com-like experience for enrichment and search with real-time feedback, progress indicators, and clear status displays.

### Changes Made

**Phase 1: Bug Fixes**
- [x] Fixed contact persistence - contacts now load after page refresh
- [x] Fixed signal count API - now counts only current user's signals (was counting ALL users)

**Phase 2: SSE Streaming Enrichment**
- [x] Created `/api/signals/[id]/enrich/stream` - SSE endpoint for real-time enrichment
- [x] Updated enrichment library with `onProgress` callback
- [x] Updated SignalCard with live enrichment progress panel
- [x] Added email status badges (verified=green, risky=red, unknown=gray)
- [x] Added re-enrich button for existing contacts

**Phase 3: SSE Streaming Search**
- [x] Created `/api/search/run/stream` - SSE endpoint for real-time search
- [x] Updated search run page with live progress display
- [x] Shows signals as they're discovered during search
- [x] Shows query progress and current action

**Phase 4: Enhanced Notifications**
- [x] Reduced sidebar polling to 10 seconds (from 30)
- [x] Added toast notifications when new signals arrive

### Files Created
- `src/app/api/signals/[id]/enrich/stream/route.ts` - SSE enrichment endpoint
- `src/app/api/search/run/stream/route.ts` - SSE search endpoint

### Files Modified
- `src/lib/supabase/queries.ts` - Added contacts join to signal queries
- `src/app/api/signals/route.ts` - Added contacts join
- `src/app/api/signals/count/route.ts` - Fixed user filtering
- `src/lib/enrichment/index.ts` - Added onProgress callback
- `src/components/dashboard/SignalCard.tsx` - SSE enrichment + progress panel + email badges + re-enrich
- `src/app/(dashboard)/search/[id]/run/page.tsx` - SSE search + live signals
- `src/components/dashboard/Sidebar.tsx` - Faster polling + toast notifications

### Deployment
- Successfully deployed to https://signal-mentis.vercel.app

---

## UK Government Data Sources Integration (December 2024)

### Goal
Add free UK Government APIs as data sources for automatic signal detection.

### Sources Added

**1. Contracts Finder API** (FREE)
- Fetches UK public sector contract awards
- OCDS format (Open Contracting Data Standard)
- Signal type: `contract_awarded`
- File: `src/lib/contracts-finder.ts`

**2. Find a Tender Service API** (FREE)
- Fetches high-value UK contracts (>£118,000)
- Replaced EU TED for UK post-Brexit
- Signal type: `contract_awarded`
- File: `src/lib/find-a-tender.ts`

**3. Companies House API** (FREE - requires key)
- Detects leadership changes (director appointments)
- Company verification for enrichment
- Signal type: `leadership_change`
- File: `src/lib/companies-house.ts`
- Requires: `COMPANIES_HOUSE_API_KEY` in env

**4. Planning Data API** (FREE)
- Fetches planning applications (England only)
- Government beta service
- Signal types: `planning_approved`, `planning_submitted`
- File: `src/lib/planning-data.ts`

### Implementation

- All sources sync automatically with daily cron job
- New endpoint: `/api/cron/government` for manual sync
- Integrated into existing daily cron at `/api/cron/daily`
- Uses existing signal deduplication (hash fingerprint)

### Files Created
- `src/lib/contracts-finder.ts`
- `src/lib/find-a-tender.ts`
- `src/lib/companies-house.ts`
- `src/lib/planning-data.ts`
- `src/app/api/cron/government/route.ts`

### Files Modified
- `src/app/api/cron/daily/route.ts` - Added government sync calls

### Environment Variables Needed
```
COMPANIES_HOUSE_API_KEY=your_key_here  # Get free at developer.company-information.service.gov.uk
FIND_A_TENDER_API_KEY=your_key_here    # Optional, get free at find-tender.service.gov.uk
```

### Deployment
- Successfully deployed to https://signal-mentis.vercel.app
