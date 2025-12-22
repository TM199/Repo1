# Signal Mentis Improvement Plan

Based on comprehensive business analysis. Focus: Make the product viable for sales teams.

## Current State Summary
- **Working**: Signal detection (Gov APIs + Firecrawl), Lead enrichment (LeadMagic + Prospeo), CSV export
- **Fixed (Dec 2024)**: Search/filter on signals page, Domain extraction, Leadership detection
- **Missing**: CRM integration, Activity tracking

---

## Phase 1: Critical Fixes (P0) - COMPLETED

### 1.1 Add Search & Filter to Signals Page
**Files**: `SignalsPageClient.tsx`, `/api/signals/route.ts`, `queries.ts`

- [x] Add search input for company name filtering
- [x] Add signal type dropdown filter
- [x] Add "has contacts" checkbox filter
- [x] Add date range filter
- [x] Update API route to accept filter parameters
- [x] Update queries.ts with filter logic
- [x] Add clear filters button
- [x] Add pagination (50 per page with Previous/Next)

### 1.2 Fix Company Domain Extraction
**Files**: `contracts-finder.ts`, `find-a-tender.ts`, `planning-data.ts`, `companies-house.ts`

- [x] Create domain lookup utility (`domain-resolver.ts`)
- [x] Update contracts-finder.ts - extract from OCDS party contact info
- [x] Update find-a-tender.ts - extract from OCDS party contact info
- [x] Update planning-data.ts - return empty instead of guessing
- [x] Update companies-house.ts - return empty instead of guessing
- [x] Fallback: return empty string instead of guessing domains

### 1.3 Fix Leadership Change Detection
**Files**: `companies-house.ts`

- [x] Changed from "recently incorporated" to actual officer appointment dates
- [x] Filter by appointed_on date to find recent appointments
- [x] Alternative fallback method for when advanced search unavailable
- [x] Filter to only executive appointments (not secretaries)
- [x] Added proper date filtering for recent appointments

---

## Phase 2: CRM Integration (P1) - COMPLETED

### 2.1 HubSpot Integration
**New Files**: `src/lib/integrations/hubspot.ts`, `/api/integrations/hubspot/`

- [x] Create HubSpot API client
- [x] Add OAuth connection flow (authorize, callback, token refresh)
- [x] Create API routes for connection management
- [x] Implement push signals as Companies (upsert by domain)
- [x] Implement push contacts as Contacts (upsert by email)
- [x] Auto-associate contacts to companies
- [ ] Add "Push to HubSpot" button on signal cards (UI pending)
- [ ] Create settings page for HubSpot connection (UI pending)

### 2.2 Export Improvements
**Files**: `export.ts`, `/api/signals/export/route.ts`

- [x] Add email_status column to CSV export
- [x] Add JSON export option (`?format=json`)
- [x] Add date range filter for export (`?date_from=&date_to=`)
- [x] Add "export only with contacts" option (`?has_contacts=true`)

---

## Phase 3: Data Quality (P2)

### 3.1 Add Industry Detection
**Files**: Gov API files, `search.ts`

- [ ] Map SIC codes from Companies House to industry names
- [ ] Add industry classification for Firecrawl signals (LLM)
- [ ] Store industry on all signals
- [ ] Add industry filter to signals page

### 3.2 Add Signal Confidence Scoring
**New File**: `src/lib/signal-scoring.ts`

- [ ] Create scoring algorithm based on source reliability
- [ ] Factor in domain verification status
- [ ] Factor in company match confidence
- [ ] Display confidence score on signal cards

### 3.3 Improve Enrichment Data Quality
**Files**: `enrichment/index.ts`, `enrichment/leadmagic.ts`

- [ ] Parse LinkedIn profile to get actual job title
- [ ] Store actual title (not just searched role)
- [ ] Add seniority detection from titles
- [ ] Store enrichment failure reasons

---

## Phase 4: Advanced Features (P3)

### 4.1 Activity Tracking
- [ ] Create activities database table
- [ ] Track when contact was exported/copied
- [ ] Track outreach attempts
- [ ] Show activity history on signal card
- [ ] Prevent duplicate outreach warnings

### 4.2 Slack Integration
- [ ] Create Slack API client
- [ ] Add Slack OAuth connection
- [ ] Post new signals to channel
- [ ] Filter by signal type for notifications

### 4.3 Email Notifications
- [ ] Daily/weekly signal digest emails
- [ ] Alert on specific signal types
- [ ] Summary of enriched contacts

---

## Previously Completed (Reference)

### Signal Detection Infrastructure
- [x] Government APIs (Contracts Finder, Find a Tender, Companies House, Planning Data)
- [x] Firecrawl AI search with real-time streaming
- [x] 14 signal types defined and detectable
- [x] Hash-based deduplication
- [x] Daily cron jobs for automatic sync

### Lead Enrichment
- [x] LeadMagic integration (role-based contact discovery)
- [x] Prospeo integration (email + phone lookup)
- [x] Real-time progress UI with streaming SSE
- [x] Email validation status display
- [x] Contact storage in signal_contacts table

### User Interface
- [x] Signal cards with company, type, title, detail
- [x] 5-step search wizard
- [x] Copy-to-clipboard for email/phone
- [x] CSV export (full and selective)
- [x] Cards vs Table view toggle
- [x] Bulk enrichment

---

## Review - Phase 1 Completion

### Summary of Changes Made

**1.1 Search & Filter (SignalsPageClient.tsx)**
- Added company name search with instant search on Enter key
- Added signal type dropdown filter with all 14 signal types
- Added "has contacts" filter (All/Has Contacts/Needs Enrichment)
- Added date range filters (from/to date pickers)
- Added collapsible filter panel (toggle with button)
- Added active filter count badge
- Added clear all filters button
- Added pagination with 50 signals per page
- Changed from server-side to client-side data fetching for dynamic filtering

**1.2 API Updates (/api/signals/route.ts)**
- Added `search` parameter for company name search (ilike)
- Added `has_contacts` parameter (true/false)
- Added `date_from` and `date_to` parameters
- Added `offset` parameter for pagination
- Updated response format to include `{ data, total, hasMore }`
- Added global signals filter (government data) to query

**1.3 Domain Extraction Fix**
- Created `src/lib/domain-resolver.ts` utility
- `extractDomainFromOCDSParty()` - extracts domain from contact URL if available
- `extractDomainFromUrl()` - validates and extracts domain from URL
- All gov API files now return empty string instead of guessing domains
- Contracts Finder and Find a Tender try OCDS party contact info first

**1.4 Leadership Detection Fix (companies-house.ts)**
- Rewrote `fetchRecentAppointments()` to filter by actual `appointed_on` date
- Added `fetchRecentAppointmentsAlternative()` fallback method
- Changed default lookback from 1 day to 7 days for better coverage
- Added `getFilingHistory()` helper for future enhancements
- Now properly filters to only executive roles (director, LLP designated member, etc.)

### Files Created
- `src/lib/domain-resolver.ts`

### Files Modified
- `src/app/(dashboard)/signals/SignalsPageClient.tsx` - Complete rewrite with filtering
- `src/app/(dashboard)/signals/page.tsx` - Simplified to just render client component
- `src/app/api/signals/route.ts` - Added all filter parameters
- `src/lib/contracts-finder.ts` - Fixed domain extraction
- `src/lib/find-a-tender.ts` - Fixed domain extraction
- `src/lib/planning-data.ts` - Fixed domain extraction
- `src/lib/companies-house.ts` - Fixed leadership detection + domain extraction

### Build Status
- Successfully builds with `npm run build`
- No TypeScript errors
- All routes compile correctly

---

## Review - Phase 2 Completion

### Summary of Changes Made

**2.1 Export Improvements (export.ts, /api/signals/export/route.ts)**
- Added `contact_email_status` column to CSV export
- Added `signalsToJson()` function for JSON export
- Added `?format=json` parameter for JSON export
- Added `?has_contacts=true/false` filter for exporting only signals with/without contacts
- Added `?date_from=` and `?date_to=` parameters for date range filtering
- Export now includes contacts via `signal_contacts` join
- Export now includes global signals (government data)

**2.2 HubSpot Integration (src/lib/integrations/hubspot.ts)**
- Full OAuth 2.0 flow implementation
- `getAuthorizationUrl()` - generates authorization URL with required scopes
- `exchangeCodeForTokens()` - exchanges auth code for access/refresh tokens
- `refreshAccessToken()` - refreshes expired access tokens
- `upsertCompany()` - creates or updates company (searches by domain first)
- `upsertContact()` - creates or updates contact (searches by email first)
- `pushSignalToHubSpot()` - pushes signal + contacts, auto-associates
- `testConnection()` - validates access token
- Required scopes: companies.read/write, contacts.read/write, deals.read/write

**2.3 HubSpot API Routes**
- `GET /api/integrations/hubspot` - returns connection status
- `POST /api/integrations/hubspot` - initiates OAuth or exchanges code
- `DELETE /api/integrations/hubspot` - disconnects integration
- `GET /api/integrations/hubspot/callback` - OAuth callback handler
- `POST /api/integrations/hubspot/push` - pushes signal to HubSpot

### Files Created
- `src/lib/integrations/hubspot.ts`
- `src/app/api/integrations/hubspot/route.ts`
- `src/app/api/integrations/hubspot/callback/route.ts`
- `src/app/api/integrations/hubspot/push/route.ts`

### Files Modified
- `src/lib/export.ts` - Added email_status column, JSON export
- `src/app/api/signals/export/route.ts` - Added all export filters
- `src/types/index.ts` - Added HubSpot token fields to UserSettings

### Database Migration Required
```sql
-- Add HubSpot integration columns to user_settings
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS hubspot_access_token text;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS hubspot_refresh_token text;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS hubspot_expires_at bigint;
```

### Environment Variables Required
```
HUBSPOT_CLIENT_ID=your_hubspot_client_id
HUBSPOT_CLIENT_SECRET=your_hubspot_client_secret
NEXT_PUBLIC_APP_URL=https://your-app-url.com
```

### Build Status
- Successfully builds with `npm run build`
- All new routes included: /api/integrations/hubspot/*
- No TypeScript errors

---

## Review - Phase 3 Completion

### Summary of Changes Made

**3.1 SIC Code to Industry Mapping (sic-codes.ts)**
- Created comprehensive SIC code mapping for UK industries
- `getIndustryFromSicCode()` - maps individual SIC codes to industry names
- `getIndustryFromSicCodes()` - handles multiple SIC codes, returns first match
- 100+ specific SIC codes mapped, plus section-level fallbacks

**3.2 Industry Detection for Companies House (companies-house.ts)**
- Updated `fetchRecentAppointments()` to fetch company details for SIC codes
- Updated alternative approach with same industry detection
- Industry field now populated in signals from Companies House

**3.3 Industry Filter (SignalsPageClient.tsx, route.ts)**
- Added industry dropdown filter with 15 common industries
- Added `industry` query parameter to signals API
- Filter uses ilike for partial matching

**3.4 Signal Confidence Scoring (signal-scoring.ts)**
- Created scoring algorithm (0-100 points):
  - Source reliability: 0-40 points (government highest)
  - Domain verification: 0-30 points
  - Data completeness: 0-30 points
- Score labels: High (70+), Medium (40-69), Low (<40)
- Added confidence badge to SignalCard with tooltip

**3.5 HubSpot UI Components**
- Settings page: Connect/disconnect HubSpot section
- Signal cards: "Push to HubSpot" button (orange upload icon)
- Real-time connection status display

### Files Created
- `src/lib/sic-codes.ts` - SIC code to industry mapping
- `src/lib/signal-scoring.ts` - Confidence scoring algorithm

### Files Modified
- `src/app/(dashboard)/signals/SignalsPageClient.tsx` - Industry filter
- `src/app/api/signals/route.ts` - Industry query parameter
- `src/lib/companies-house.ts` - Industry detection
- `src/components/dashboard/SignalCard.tsx` - Confidence badge + HubSpot button
- `src/app/(dashboard)/settings/page.tsx` - HubSpot connection section

### Build Status
- Successfully builds with `npm run build`
- Deployed to https://signal-mentis.vercel.app

