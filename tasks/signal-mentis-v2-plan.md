# Signal Mentis v2.0 - Business Analysis & Architecture Redesign

## Executive Summary

Signal Mentis is a "Hiring Pain Intelligence" platform for recruitment agencies. The goal: identify companies struggling to hire BEFORE competitors, using deep-rooted signals from job boards, government contracts, and business events.

**Current Problem:** The system has good foundations but is fragmented. Two separate signal systems exist (general `signals` table vs `company_pain_signals` table), search profiles don't use the pain detection engine, and web scraping costs money while free APIs are underutilized.

**Vision:** A unified, API-first system where users define their ICP (industry, roles, locations), and the system continuously monitors FREE data sources to surface the strongest hiring pain signals.

---

## 1. CURRENT STATE ANALYSIS

### 1.1 Data Sources Available

| Source | Cost | Data Type | Currently Used? | Status |
|--------|------|-----------|-----------------|--------|
| **Reed API** | FREE | UK Jobs | ✅ Yes | Working well |
| **Adzuna API** | FREE | UK Jobs | ⚠️ Disabled | Timeout issues |
| **Contracts Finder** | FREE | Gov contracts | ✅ Yes | Working |
| **Find a Tender** | FREE | High-value contracts | ✅ Yes | Working |
| **Companies House** | FREE | Company/director data | ⚠️ Limited | Underutilized |
| **Planning Data API** | FREE | Planning apps (England) | ⚠️ Limited | Underutilized |
| **Firecrawl** | PAID | Web scraping | ✅ Yes | Overused |

### 1.2 What's Working Well ✅

**Job Pain Detection Pipeline:**
- Reed API → `job_postings` → pain signal generation → `/pain` dashboard
- Detects: Stale jobs (30/60/90 days), Reposts, Salary increases, Referral bonuses
- Pain score calculation (0-100) working
- View Job links now working

**Government Data Sync:**
- Contracts Finder API pulling contract awards
- Find a Tender pulling high-value contracts
- Contract-without-hiring detection built

### 1.3 What's Broken/Disconnected ❌

**TWO SEPARATE SIGNAL SYSTEMS:**
```
System A (Working):
  Reed API → job_postings → company_pain_signals → /pain

System B (Disconnected):
  Firecrawl → signals → /signals

PROBLEM: These don't integrate!
```

**Search Profiles Don't Use Pain Engine:**
- User creates profile with industry/roles/locations
- Clicks "Run Search" → Uses FIRECRAWL ($$$)
- Results go to `signals` table (not job_postings)
- NO pain detection runs
- User sees generic signals, not HIRING PAIN

**Profile Keywords Not Used for API Searches:**
- Profile captures: industry, roles, locations
- But cron uses HARDCODED regions for Reed API
- Massive missed opportunity

---

## 2. API-FIRST ARCHITECTURE

### 2.1 Signal Types & Data Sources

| Signal Type | FREE API? | Current Method | Proposed Method |
|-------------|-----------|----------------|-----------------|
| Stale Jobs | ✅ Reed | Reed API | Keep (working) |
| Reposted Jobs | ✅ Reed | Reed API | Keep (working) |
| Salary Increases | ✅ Reed | Reed API | Keep (working) |
| Contract Awards | ✅ Gov APIs | API ✓ | Keep (working) |
| Contract-No-Hiring | ✅ Combined | API ✓ | Keep (working) |
| Leadership Changes | ✅ Companies House | Limited | **EXPAND** |
| Planning Approvals | ✅ Planning API | Limited | **EXPAND** |
| Funding Rounds | ❌ None | Firecrawl | Keep Firecrawl |
| Company Expansion | ❌ None | Firecrawl | Keep Firecrawl |

### 2.2 Pain Signal Scoring

| Signal Type | Score | Urgency |
|-------------|-------|---------|
| stale_job_90 | 25 | immediate |
| stale_job_60 | 15 | immediate |
| stale_job_30 | 5 | short_term |
| job_reposted_3x+ | 30 | immediate |
| job_reposted_2x | 20 | immediate |
| job_reposted_1x | 10 | immediate |
| salary_increase_20%+ | 25 | immediate |
| salary_increase_10%+ | 15 | immediate |
| contract_no_hiring_60d | 35 | immediate |
| contract_no_hiring_30d | 20 | short_term |
| referral_bonus | 15 | short_term |

---

## 3. PROPOSED USER FLOW

### 3.1 Current Flow (Fragmented)
```
Create Profile → Run Search → Firecrawl ($$$) → signals table → /signals page
                                                    ↑
                    (Completely separate from pain detection!)
```

### 3.2 Proposed Flow (Unified)
```
Create Search Profile
  ├─ Industry: Construction
  ├─ Roles: Site Manager, QS, Project Manager
  ├─ Locations: London, Manchester
  └─ Signal Types: [Hiring Pain ✓] [Contract Awards ✓] [Leadership ✓]
           ↓
    Click "Analyze ICP"
           ↓
    ┌──────┴──────┐
    ↓             ↓
Hiring Pain    Contract Awards
    ↓             ↓
Reed API       Contracts Finder API
(uses profile   (filter by industry)
keywords)            ↓
    ↓          Match to companies
job_postings        ↓
    ↓          Check hiring correlation
Pain Detection      ↓
    ↓         ←──────┘
company_pain_signals
    ↓
/pain dashboard (filtered by profile industry)
    ↓
Enrich contacts → Push to CRM
```

---

## 4. SIGNAL TO ACTION: Making Data Valuable

**The Core Problem:** Detecting a signal is worthless if you can't ACT on it.

### 4.1 What Makes a Signal Actionable?

For every signal, the user needs:

| Required Data | Source | Current State |
|---------------|--------|---------------|
| **Company Name** | Job/Contract/Planning | ✅ Have it |
| **Company Domain** | Enrichment | ⚠️ Partially stored |
| **Role/Job Title** | Job posting | ✅ Have it |
| **Location** | Job posting | ✅ Have it |
| **Signal Type & Urgency** | Pain detection | ✅ Have it |
| **Pain Score** | Calculation | ✅ Have it |
| **Link to Source** | Job URL | ✅ Fixed (View Job) |
| **Hiring Manager Name** | Job desc / Scrape | ❌ Not captured |
| **Hiring Manager Email** | Job desc / Enrichment | ❌ Not captured |
| **Hiring Manager LinkedIn** | Enrichment | ❌ Not captured |

### 4.2 The Enrichment Chain

```
SIGNAL DETECTED
     ↓
┌────────────────────────────────────────┐
│ Step 1: IDENTIFY THE COMPANY           │
│ ────────────────────────────────────── │
│ • Job posting → employerName           │
│ • Match to companies table (fuzzy)     │
│ • If new, create company record        │
│ • STATUS: ✅ WORKING                    │
└────────────────────────────────────────┘
     ↓
┌────────────────────────────────────────┐
│ Step 2: GET THE DOMAIN                 │
│ ────────────────────────────────────── │
│ • Check companies.domain column        │
│ • If empty: Guess from company name    │
│   e.g., "Acme Ltd" → acme.co.uk        │
│ • Verify domain is reachable           │
│ • Companies House → registered website │
│ • STATUS: ⚠️ PARTIAL (domain often null)│
└────────────────────────────────────────┘
     ↓
┌────────────────────────────────────────┐
│ Step 3: IDENTIFY THE HIRING MANAGER    │
│ ────────────────────────────────────── │
│ Source 1: Job Description Parsing      │
│   • Regex for "Contact:", email, phone │
│   • Extract names like "Apply to John" │
│                                        │
│ Source 2: Job Page Scraping (Firecrawl)│
│   • Scrape actual job URL              │
│   • Extract contact section            │
│   • Look for Apply/Contact buttons     │
│                                        │
│ Source 3: Role-Based Guess             │
│   • "Site Manager" role → look for     │
│     "Head of Construction" at company  │
│                                        │
│ STATUS: ❌ NOT IMPLEMENTED              │
└────────────────────────────────────────┘
     ↓
┌────────────────────────────────────────┐
│ Step 4: ENRICH CONTACTS                │
│ ────────────────────────────────────── │
│ Option A: Hunter.io (has free tier)    │
│   • Domain → all emails at company     │
│   • Find pattern (first.last@domain)   │
│                                        │
│ Option B: Apollo.io                    │
│   • Company + role → decision makers   │
│   • Direct email/phone                 │
│                                        │
│ Option C: LinkedIn Sales Navigator     │
│   • Company → employees by role        │
│   • InMail or connection request       │
│                                        │
│ Option D: Companies House Directors    │
│   • FREE API                           │
│   • Company → director names           │
│   • Director name + domain → guess email│
│                                        │
│ STATUS: ❌ NOT IMPLEMENTED              │
└────────────────────────────────────────┘
     ↓
┌────────────────────────────────────────┐
│ Step 5: DISPLAY TO USER                │
│ ────────────────────────────────────── │
│ For each company in pain, show:        │
│ • Company name (clickable → website)   │
│ • Pain score (color coded)             │
│ • All active pain signals              │
│ • Open roles (linked to job posts)     │
│ • KEY CONTACTS section:                │
│   - Hiring manager (if found)          │
│   - Directors (from Companies House)   │
│   - Email/Phone/LinkedIn               │
│ • One-click actions:                   │
│   - "Find Contacts" (trigger enrich)   │
│   - "View on LinkedIn"                 │
│   - "Push to HubSpot"                  │
│                                        │
│ STATUS: ⚠️ PARTIAL (no contacts shown) │
└────────────────────────────────────────┘
```

### 4.3 Data We Can Extract From Job Descriptions

Job descriptions often contain hidden gold:

```
PARSE JOB DESCRIPTION FOR:
├── Contact Email (regex: xxx@xxx.xxx)
├── Contact Phone (regex: UK phone patterns)
├── Contact Name ("Contact: John Smith", "Apply to Sarah")
├── Team Size ("join a team of 15", "managing 8 engineers")
├── Urgency Language ("ASAP", "immediate start", "urgent")
├── Budget/Salary range (already captured)
├── Referral Bonus (already captured)
└── Reporting Line ("report to CTO", "working with the MD")
```

### 4.4 Proposed Database Changes

**New columns on `companies` table:**
- `domain` (already exists, need to populate)
- `linkedin_url`
- `employees_estimate`
- `last_enriched_at`

**New table: `company_contacts`**
```sql
CREATE TABLE company_contacts (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  name TEXT,
  role TEXT,
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,
  source TEXT,  -- 'job_description', 'companies_house', 'hunter', 'manual'
  confidence_score INTEGER,  -- 1-100
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

**New columns on `job_postings` table:**
- `contact_name` (parsed from description)
- `contact_email` (parsed from description)
- `contact_phone` (parsed from description)
- `team_size_mentioned` (parsed: "team of 12")
- `urgency_keywords` (parsed: contains "ASAP", "urgent")

### 4.5 FREE Enrichment Sources

| Source | Cost | Data | API? |
|--------|------|------|------|
| Companies House | FREE | Directors, registered address | ✅ Yes |
| Job Description | FREE | Contact info (already have data) | N/A |
| Domain Guess | FREE | company name → domain | N/A |
| Hunter.io | Free tier (25/mo) | Email patterns | ✅ Yes |
| LinkedIn (manual) | FREE | Profiles | No API |

---

## 5. IMPLEMENTATION PLAN

### Phase 1: Connect Search Profiles to Pain Detection
**Priority: HIGH | Effort: Medium**

Create endpoint that:
1. Takes search profile ID
2. Extracts keywords from `specific_roles`
3. Extracts locations from `locations`
4. Calls Reed API with 90-day lookback
5. Stores in `job_postings`
6. Runs pain signal generation
7. Returns results filtered by industry

**New file:** `src/app/api/search/profiles/[id]/analyze/route.ts`

### Phase 2: Add "Analyze ICP" Button to Profile UI
**Priority: HIGH | Effort: Low**

Add button on `/search/[id]` page that:
- Calls the analyze endpoint
- Shows progress (streaming)
- Redirects to `/pain?industry=X` when complete

**Modify:** `src/app/(dashboard)/search/[id]/page.tsx`

### Phase 3: Parse Contact Info from Job Descriptions
**Priority: HIGH | Effort: Medium**

When ingesting jobs, extract:
- Email addresses (regex)
- Phone numbers (UK patterns)
- Contact names ("Contact: John", "Apply to Sarah")
- Urgency keywords ("ASAP", "immediate", "urgent")

Store in new `job_postings` columns.

**Modify:** `src/app/api/admin/backfill-jobs/route.ts`
**Modify:** `src/app/api/cron/ingest-jobs/route.ts`
**New file:** `src/lib/jobs/contact-parser.ts`

### Phase 4: Domain Resolution for Companies
**Priority: HIGH | Effort: Medium**

For companies without domains:
1. Guess domain from name (strip Ltd, PLC → add .co.uk)
2. Verify domain is reachable (HEAD request)
3. Use Companies House registered website if available
4. Store in `companies.domain`

**New file:** `src/lib/companies/domain-resolver.ts`
**Modify:** `src/lib/companies/company-matcher.ts`

### Phase 5: Companies House Director Enrichment
**Priority: MEDIUM | Effort: Medium**

For each company in pain:
1. Look up company in Companies House (by name/number)
2. Fetch current directors
3. Store in `company_contacts` table
4. Generate email guesses (first.last@domain)

**Modify:** `src/lib/companies-house.ts`
**New file:** `src/app/api/companies/[id]/enrich/route.ts`

### Phase 6: Enhanced Pain Dashboard with Contacts
**Priority: HIGH | Effort: Medium**

Update `/pain` dashboard to show:
- Company domain (clickable)
- Contacts found (name, role, email, phone)
- "Find Contacts" button (triggers enrichment)
- LinkedIn search link
- Filter by industry URL param

**Modify:** `src/components/dashboard/CompaniesInPainDashboard.tsx`

### Phase 7: One-Click Actions
**Priority: MEDIUM | Effort: Low**

Add action buttons:
- "Copy Email" - copies contact email
- "View on LinkedIn" - opens search
- "Push to HubSpot" - creates contact/company

**Modify:** `src/components/dashboard/CompaniesInPainDashboard.tsx`

### Phase 8 (Future): Data Provider Integrations
**Priority: MEDIUM | Effort: Medium**

Build modular enrichment system that can plug into:

| Provider | Data Type | Cost |
|----------|-----------|------|
| **Lead Magic** | Email verification, enrichment | Paid |
| **Prospeo** | Email finder, LinkedIn | Paid |
| **Better Connect** | B2B contact data | Paid |
| **Hunter.io** | Email patterns | Free tier (25/mo) |
| **Apollo.io** | Full contact profiles | Paid |
| **Clearbit** | Company enrichment | Paid |

**Architecture:**
```typescript
// src/lib/enrichment/providers.ts
interface EnrichmentProvider {
  name: string;
  enrichCompany(domain: string): Promise<CompanyData>;
  findContacts(company: Company, role?: string): Promise<Contact[]>;
  verifyEmail(email: string): Promise<boolean>;
}

// Easy to add new providers
const providers: EnrichmentProvider[] = [
  new CompaniesHouseProvider(),  // FREE - always first
  new HunterProvider(),          // Free tier
  new LeadMagicProvider(),       // Paid fallback
  new ProspeoProvider(),         // Paid fallback
];
```

### Phase 9 (Future): CRM Integrations
**Priority: MEDIUM | Effort: Medium**

Push enriched companies/contacts to CRMs:

| CRM | Integration Method |
|-----|-------------------|
| **HubSpot** | REST API (already have some code) |
| **Salesforce** | REST API |
| **Pipedrive** | REST API |
| **Zoho CRM** | REST API |

**Features:**
- One-click "Push to CRM" button
- Create company + contacts + deal
- Link pain signals as notes/activities
- Avoid duplicates (match by domain/email)

**New files:**
- `src/lib/crm/hubspot.ts`
- `src/lib/crm/salesforce.ts`
- `src/app/api/crm/push/route.ts`

### Phase 10 (Future): Deprecate Firecrawl
**Priority: LOW | Effort: Low**

Remove Firecrawl for:
- Contract awards (use Contracts Finder API)
- Planning approvals (use Planning Data API)

Keep Firecrawl ONLY for:
- Funding rounds (no free API)
- Company expansion (no free API)

---

## 6. FILES TO MODIFY

### New Files:
- `src/app/api/search/profiles/[id]/analyze/route.ts` - Profile-based job search
- `src/lib/jobs/contact-parser.ts` - Extract emails/phones from job descriptions
- `src/lib/companies/domain-resolver.ts` - Guess/verify company domains
- `src/app/api/companies/[id]/enrich/route.ts` - Trigger contact enrichment

### Modify:
- `src/app/(dashboard)/search/[id]/page.tsx` - Add "Analyze ICP" button
- `src/components/dashboard/CompaniesInPainDashboard.tsx` - Show contacts, filter by industry
- `src/app/api/admin/backfill-jobs/route.ts` - Parse contact info during ingestion
- `src/app/api/cron/ingest-jobs/route.ts` - Parse contact info during ingestion
- `src/lib/companies/company-matcher.ts` - Add domain resolution
- `src/lib/companies-house.ts` - Add director fetching

### Database Migrations:
- Add columns to `job_postings`: `contact_name`, `contact_email`, `contact_phone`, `urgency_keywords`
- Add columns to `companies`: `linkedin_url`, `employees_estimate`, `last_enriched_at`
- Create table `company_contacts`

### Already Complete:
- ✅ `src/app/api/admin/backfill-jobs/route.ts` - Working (needs contact parsing)
- ✅ `src/app/api/cron/generate-pain-signals/route.ts` - Working
- ✅ View Job links in pain dashboard - Working
- ✅ Government cron scheduled - Working

---

## 7. SUCCESS METRICS

1. **Cost Reduction:** 80% less Firecrawl usage
2. **Signal Quality:** User sees pain signals specific to their ICP
3. **Time to Value:** Results within 2 minutes of creating profile
4. **Data Freshness:** Jobs updated every 4 hours (already done)
5. **Actionability:** 50%+ of signals have at least one contact method
6. **Contact Coverage:** Director info for 80% of companies (via Companies House)

---

## 8. RECOMMENDED PRIORITY ORDER

Start with the minimum to make signals actionable:

**Week 1 (Core Flow):**
1. Phase 1: Connect profiles to pain detection ← Makes profiles useful
2. Phase 2: Add Analyze button to UI ← User can trigger it
3. Phase 3: Parse contacts from job descriptions ← FREE data extraction

**Week 2 (Enrichment):**
4. Phase 4: Domain resolution ← Every company gets a domain
5. Phase 5: Companies House directors ← FREE contact data
6. Phase 6: Enhanced dashboard with contacts ← User sees actionable data

**Week 3 (Polish):**
7. Phase 7: One-click actions ← Copy email, LinkedIn, HubSpot

---

## 9. USER DECISIONS (All Confirmed)

1. **Contact Types:** Find ALL contacts - job poster + likely hiring manager + company directors

2. **Data Storage:** Create new `company_contacts` table with confidence scores

3. **Priority:** Get core flow working first, then add data providers + CRMs

4. **Naming:** Rename "New Job Postings" → "Hiring Pain Signals" in UI

5. **Filtering:** Filter /pain dashboard to user's selected industry only

6. **Scheduling:** Manual trigger for now, BUT add ability to:
   - Select schedule (hourly/daily/weekly) per profile
   - Email notifications when new signals appear
   - "New signals awaiting action" alerts in UI

## 10. FUTURE: Notification System (Phase 11)

Add to search profiles:
- `schedule_frequency`: 'manual' | 'hourly' | 'daily' | 'weekly'
- `notify_email`: boolean
- `last_notified_at`: timestamp

When cron runs and finds new signals:
- Mark signals as "new" / "awaiting action"
- Send email digest: "X new hiring pain signals match your profile"
- Show badge in UI: "5 new signals"

**New files:**
- `src/app/api/cron/notify-signals/route.ts`
- `src/lib/email/signal-digest.ts`
