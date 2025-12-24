# Sprint 1: Create Labs Page

## Overview
Create a standalone `/labs` page for experimental features outside the main dashboard.

## Tasks

- [x] 1. Create `/src/app/labs/layout.tsx` - minimal layout (header + footer, no sidebar)
- [x] 2. Create `/src/app/labs/page.tsx` - page with 3 search cards
- [x] 3. Create `/src/app/api/labs/companies-house/route.ts` - wraps existing lib
- [x] 4. Create `/src/app/api/labs/planning/route.ts` - wraps existing lib
- [x] 5. Create `/src/app/api/labs/tenders/route.ts` - wraps existing lib
- [x] 6. Build passed

## Review

**Files created:**
- `src/app/labs/layout.tsx` - Simple layout with header (logo + Labs badge), footer disclaimer
- `src/app/labs/page.tsx` - Client component with 3 search cards
- `src/app/api/labs/companies-house/route.ts` - Wraps searchCompanies/getCompanyOfficers
- `src/app/api/labs/planning/route.ts` - Wraps fetchPlanningApplications
- `src/app/api/labs/tenders/route.ts` - Wraps fetchFTSAwards

**Features:**
- Companies House: Search by name, see company list with status
- Planning Data: Fetch recent significant applications by days
- Find a Tender: Fetch recent contract awards by days

**No changes to existing code** - just added new files

---

# Sprint 2: Remove Low-Value Features

## Overview
Remove Search Profiles, Agency Finder, and URL Sources from the app.

## Tasks

- [x] 1. Remove Search Profiles pages and API routes
- [x] 2. Remove Agency Finder pages and API routes
- [x] 3. Remove URL Sources pages and API routes
- [x] 4. Update Sidebar navigation (removed Agency, added Labs)
- [x] 5. Build passed and deployed

## Review

**Files deleted (17 total):**
- `src/app/(dashboard)/search/` - 6 files
- `src/app/api/search/` - 6 files
- `src/app/(dashboard)/agency/` - 2 files
- `src/app/api/agency/` - 3 files
- `src/app/(dashboard)/sources/` - 2 files
- `src/app/api/sources/` - 3 files

**Files modified:**
- `src/components/dashboard/Sidebar.tsx` - Removed Agency Finder, added Labs link

**Result:**
- Routes reduced from 52 to 39 (-25%)
- Sidebar simplified: 7 items (was 8)
- Labs now accessible from main nav

---

# Sprint 3: Simplify Backend

## Overview
Remove Adzuna, Companies House, Planning Data from cron jobs. Consolidate cron schedules.

## Tasks

- [x] 1. Remove Adzuna lib and references from ingest-jobs cron
- [x] 2. Remove Companies House from government cron
- [x] 3. Remove Planning Data from government cron
- [x] 4. Delete daily/weekly/monthly cron routes
- [x] 5. Update vercel.json cron config
- [x] 6. Build passed and deployed

## Review

**Files deleted:**
- `src/lib/adzuna.ts` - Adzuna API integration
- `src/app/api/cron/daily/` - Unused daily cron
- `src/app/api/cron/weekly/` - Unused weekly cron
- `src/app/api/cron/monthly/` - Unused monthly cron

**Files modified:**
- `src/app/api/cron/ingest-jobs/route.ts` - Removed all Adzuna references (now Reed-only)
- `src/app/api/cron/government/route.ts` - Simplified to only Contracts Finder + Find a Tender
- `vercel.json` - Removed daily/weekly cron entries

**Result:**
- Routes: 39 → 36 (-8%)
- Cron jobs: 7 → 5
- Government sync now only fetches high-value data (contracts/tenders)
- Job ingestion simplified to Reed-only

---

# Sprint 4: Smart Job Ingestion (Timeout Fix)

## Overview
Fix the `ingest-jobs` cron timeout by splitting job ingestion into 3 location groups.

**Problem:** Processing 6,440+ jobs in one run = ~296s processing time → TIMEOUT at 300s

**Solution:** Split into 3 location groups running on separate schedules.

## Tasks

- [x] 1. Add `LOCATION_GROUPS` constant to `ingest-jobs/route.ts`
- [x] 2. Add `group` query parameter handling in GET handler
- [x] 3. Filter ICP locations by group before Reed API call
- [x] 4. Update `vercel.json` with 3 location-based cron entries
- [x] 5. Build passed

## Review

**Files modified:**
- `src/app/api/cron/ingest-jobs/route.ts` - Added location group support (~15 lines)
- `vercel.json` - Updated cron config (1 entry → 3 entries)

**Location Groups:**
| Group | Locations | Est. Jobs | Schedule |
|-------|-----------|-----------|----------|
| `london` | London | ~5,000 | Every 4h |
| `major` | Manchester, Birmingham, Leeds, Bristol | ~3,000 | Every 2h at :15 |
| `regional` | Newcastle, Nottingham, Cardiff, Glasgow, Edinburgh, Liverpool, Sheffield | ~2,000 | Every 2h at :30 |

**Daily Coverage:**
- London: 6 runs/day
- Major cities: 12 runs/day
- Regional cities: 12 runs/day

**What stayed unchanged:**
- `rescan-icp-jobs` (3x daily) - already handles limited job counts
- `process-scan-queue` (every 15min) - processes 2 tasks at a time
- Initial ICP scan - on-demand, parallel searching
- All job processing logic (fingerprinting, company matching, signals)

**Additional change: Pain signal generation frequency**
- Changed from once daily (6:30 AM) to every 2 hours at :45
- Now signals are generated ~15 minutes after each ingestion group completes
- Users see new companies in pain within 2 hours instead of next morning

## Complete Cron Schedule

| Time | Cron |
|------|------|
| :00 | `ingest-jobs?group=london` (every 4h) |
| :15 | `ingest-jobs?group=major` (every 2h) |
| :30 | `ingest-jobs?group=regional` (every 2h) |
| :45 | `generate-pain-signals` (every 2h) |

## Duplicate Handling

When the same job is seen again:
1. **Fingerprint match** → Update `last_seen_at`, don't create duplicate
2. **Similar job at same company (inactive)** → Detect as repost, increment `repost_count`
3. **New job** → Create new record with `original_posted_date`

Pain signals use:
- `original_posted_date` - when job first appeared
- `last_seen_at` - when job was last seen (refreshed)
- If job is old but recently refreshed → **"Hard to Fill"** (high pain)
- If job is old and NOT refreshed → **"Stale"** (lower pain)
