# Signal Mentis - Comprehensive Platform Documentation

> **Last Updated:** December 2024
> **Version:** 1.0 MVP

---

## Table of Contents

1. [Executive Overview](#1-executive-overview)
2. [Signal Types (13 Types)](#2-signal-types)
3. [Signal Detection Methods](#3-signal-detection-methods)
4. [Supported Industries (12)](#4-supported-industries)
5. [UK Location Coverage (13 Regions)](#5-uk-location-coverage)
6. [External API Integrations (11 APIs)](#6-external-api-integrations)
7. [User Workflows](#7-user-workflows)
8. [Confidence Scoring Algorithm](#8-confidence-scoring-algorithm)
9. [Deduplication Logic](#9-deduplication-logic)
10. [Background Processing (Cron Jobs)](#10-background-processing)
11. [Email Notifications](#11-email-notifications)
12. [Database Schema Overview](#12-database-schema)
13. [Technical Architecture](#13-technical-architecture)

---

## 1. Executive Overview

### What is Signal Mentis?

Signal Mentis is a **B2B lead intelligence platform** that automatically detects business growth signals and enriches them with decision-maker contact information. It targets the UK market and serves:

- **Recruitment Agencies** - Find companies actively hiring before competitors
- **B2B Sales Teams** - Identify companies with buying signals (funding, expansion)
- **Commercial Property Agents** - Track planning approvals and company expansions
- **Construction Suppliers** - Monitor contract awards and project announcements
- **Healthcare Suppliers** - Follow CQC rating changes and NHS contracts

### Core Value Proposition

> "Find companies showing growth signals, then get the decision-maker's email in one click."

### Platform Capabilities

| Capability | Description |
|------------|-------------|
| **Signal Detection** | Monitors 13 signal types across 12 industries |
| **Government Data** | UK Contracts Finder, Find a Tender, Companies House, Planning Data |
| **Job Board Integration** | Reed API + Indeed scraping with recruiter filtering |
| **AI-Powered Search** | Custom search profiles with Firecrawl web scraping |
| **Contact Enrichment** | LeadMagic (role discovery) + Prospeo (email/phone) |
| **CRM Integration** | One-click push to HubSpot |
| **Export** | CSV/JSON export with all signal and contact data |
| **Notifications** | Daily/weekly/monthly email digests |

### Tech Stack

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes, Server-Sent Events (SSE)
- **Database:** Supabase (PostgreSQL with Row Level Security)
- **Auth:** Supabase Auth (email/password)
- **Email:** Resend
- **Scraping:** Firecrawl (AI-powered extraction)

---

## 2. Signal Types

Signal Mentis tracks **13 distinct signal types**, each indicating different business opportunities:

### Signal Type Definitions

| Signal Type | Icon | Description | Hiring Urgency |
|-------------|------|-------------|----------------|
| `contract_awarded` | 📜 | Government and private contracts won by companies | **IMMEDIATE** |
| `new_job` | 📄 | Individual job postings detected | **IMMEDIATE** |
| `company_hiring` | 👥 | Hiring announcements at scale | **IMMEDIATE** |
| `cqc_rating_change` | ⭐ | Care Quality Commission inspection results | **IMMEDIATE** |
| `funding_announced` | 💰 | Companies raising investment (Seed, Series A-D, PE) | **SHORT TERM** |
| `company_expansion` | 🏢 | New offices, facilities, warehouses opening | **SHORT TERM** |
| `project_announced` | 🎯 | Major project announcements | **SHORT TERM** |
| `acquisition_merger` | 🤝 | M&A activity | **SHORT TERM** |
| `planning_approved` | 🏗️ | Planning permissions granted for developments | **MEDIUM TERM** |
| `planning_submitted` | 📋 | New planning applications submitted | **MEDIUM TERM** |
| `leadership_change` | 👔 | New CEO, Director, VP appointments | **SPECULATIVE** |
| `regulatory_change` | ⚖️ | Compliance and regulatory changes | **SPECULATIVE** |
| `layoffs_restructure` | 📉 | Company restructuring or layoffs | **SPECULATIVE** |

### Hiring Urgency Explained

For recruitment agencies using the Agency Finder feature, signals are prioritized by hiring urgency:

- **IMMEDIATE** - Companies need people NOW (active job posts, contract wins, staffing issues)
- **SHORT TERM** - Hiring expected within 1-3 months (funding, expansion, new projects)
- **MEDIUM TERM** - Hiring in 3-6 months (planning approvals, pipeline signals)
- **SPECULATIVE** - May lead to hiring, but uncertain timing

### Signal Type Configuration

Each signal type has configured:
- **Search Query Templates** - Dynamic queries for web searches
- **Relevant Industries** - Which industries this signal applies to
- **Relevant Seniorities** - Which job levels to target for enrichment
- **Data Sources** - Where to find this signal type

---

## 3. Signal Detection Methods

### 3.1 Government APIs (Highest Reliability)

#### Contracts Finder API
- **Signal Type:** `contract_awarded`
- **URL:** https://www.contractsfinder.service.gov.uk
- **Data Standard:** OCDS (Open Contracting Data Standard)
- **Authentication:** None required (free public API)
- **Coverage:** UK public sector contracts
- **Update Frequency:** Daily via cron job

**Data Extracted:**
- Supplier/contractor name and contact details
- Contract title, description, and value (GBP)
- Buyer organization
- Contract dates and procurement category

#### Find a Tender Service (FTS)
- **Signal Type:** `contract_awarded` (high-value only)
- **URL:** https://www.find-tender.service.gov.uk
- **Threshold:** Contracts > £118,000
- **Data Standard:** OCDS JSON
- **Authentication:** Optional API key

#### Companies House API
- **Signal Type:** `leadership_change`
- **URL:** https://api.company-information.service.gov.uk
- **Authentication:** Free API key required
- **Rate Limit:** 600 requests per 5 minutes

**Data Extracted:**
- Officer appointments and resignations
- Company registration details
- SIC codes (mapped to industries)
- Filing history

**Filtering Logic:**
- Only executive roles (directors, LLP members, CIC managers)
- Only active officers (no resignations)
- Only recent appointments (last 7 days)

#### Planning Data API
- **Signal Types:** `planning_submitted`, `planning_approved`
- **URL:** https://www.planning.data.gov.uk
- **Authentication:** None required
- **Coverage:** England only (beta service)

**Data Extracted:**
- Application reference and description
- Decision status and date
- Site address and location
- Applicant/developer name

**Filtering Logic:**
- Only "significant developments" containing keywords:
  - commercial, industrial, office, warehouse, factory
  - retail, hotel, residential development, mixed use
  - business park, employment, units, sqm, hectares

### 3.2 Job Board Integration

#### Reed.co.uk API (Primary)
- **Signal Type:** `new_job`
- **URL:** https://www.reed.co.uk/api/1.0/search
- **Authentication:** Basic Auth with API key
- **Features:**
  - Keyword and location search
  - Posted-within date filter (default 7 days)
  - **Direct employer filter** - Excludes recruitment agencies

**Recruiter Detection Patterns:**
```
Company names: recruit, staffing, talent, resourcing, personnel
Known agencies: Hays, Reed, Michael Page, Robert Half, Randstad, Adecco, Manpower
Description: "on behalf of", "our client", "confidential client"
```

#### Indeed.co.uk (Fallback)
- **Signal Type:** `new_job`
- **Method:** Firecrawl web scraping
- **Used When:** Reed returns insufficient results
- **Features:** Same recruiter filtering applied post-scrape

### 3.3 AI-Powered Web Scraping (Firecrawl)

Used for all signal types not covered by direct APIs:
- Funding announcements (TechCrunch, Sifted, UKTech News)
- Company expansions (news sites, company websites)
- CQC rating changes (CQC.org.uk)
- Project announcements (industry publications)
- M&A activity (deal sites)

**How It Works:**
1. Generate search queries from templates
2. Firecrawl searches web and returns URLs
3. Firecrawl scrapes each URL with AI extraction
4. LLM extracts structured data based on signal type
5. Signals saved with confidence scoring

**Extraction Prompt Example (Contract Awards):**
```
Extract contract awards from this page. For each:
- company_name (winner)
- company_domain
- signal_title (contract reference)
- signal_detail (value, buyer, scope)
- signal_url
Focus on {industry} contracts.
```

---

## 4. Supported Industries

Signal Mentis supports **12 major industry categories**, each with defined role categories and seniority levels:

### Industry List

| Industry | Key Role Categories | Seniority Levels |
|----------|---------------------|------------------|
| **Construction & Infrastructure** | Site Manager, Project Manager, Quantity Surveyor, BIM Manager, H&S Manager, Trades | Junior → Executive |
| **Healthcare & Life Sciences** | Nurses, Clinical Directors, Care Managers, Pharmacists, Psychologists | Junior → Executive |
| **Technology & Software** | Frontend/Backend/Full Stack Devs, Data Scientists, DevOps, Security, Product, Architects | Junior → Executive |
| **Manufacturing & Engineering** | Production Manager, Manufacturing Engineer, Quality Manager, Supply Chain, CNC Machinist | Junior → Executive |
| **Financial Services** | Accountants, Auditors, Compliance Officers, Bankers, Fund Managers, FinTech | Junior → Executive |
| **Energy & Utilities** | Renewables Engineer, Oil & Gas, Nuclear Engineer, Network Engineer | Mid → Executive |
| **Logistics & Supply Chain** | Warehouse Manager, Transport Manager, Supply Chain Manager, Freight Forwarder | Mid → Executive |
| **Property & Real Estate** | Estate Agent, Property Manager, Development Manager, Chartered Surveyor, Investment Manager | Mid → Executive |
| **Retail & Consumer** | Store Manager, Buyer, Merchandiser, E-commerce Manager | Mid → Executive |
| **Education** | Teacher, Headteacher, School Business Manager, SENCO | Mid → Executive |
| **Legal & Professional Services** | Solicitor, Partner, Paralegal, General Counsel | Junior → Executive |
| **Hospitality & Leisure** | Hotel Manager, Restaurant Manager, Events Manager, Head Chef | Mid → Executive |

### Industry-to-Signal Mapping

Each signal type is relevant to specific industries:

| Signal Type | Relevant Industries |
|-------------|---------------------|
| Contract Awards | Construction, Healthcare, Technology, Manufacturing, Energy, Logistics |
| Planning Approvals | Construction, Property, Logistics, Manufacturing, Retail, Healthcare |
| Funding Rounds | Technology, Healthcare, Finance, Energy |
| Company Expansion | **All industries** |
| Leadership Changes | **All industries** |
| CQC Rating Changes | Healthcare only |
| New Job Postings | **All industries** |

### SIC Code Mapping

Companies House SIC codes are automatically mapped to system industries:
- 100+ specific SIC codes mapped
- Section-level fallbacks for broader categories
- Used to classify signals by industry

---

## 5. UK Location Coverage

Signal Mentis covers **13 UK regions** with location-specific search filtering:

| Region | Search Terms |
|--------|--------------|
| **UK All** | UK, United Kingdom, Britain |
| **London** | London, City of London, Greater London, Central London |
| **South East** | Surrey, Kent, Sussex, Hampshire, Berkshire, Oxfordshire |
| **South West** | Bristol, Bath, Devon, Cornwall, Exeter, Somerset, Dorset |
| **East of England** | Cambridge, Norfolk, Suffolk, Essex, Hertfordshire |
| **West Midlands** | Birmingham, Coventry, Wolverhampton, Worcestershire |
| **East Midlands** | Nottingham, Leicester, Derby, Northamptonshire |
| **North West** | Manchester, Liverpool, Chester, Lancashire, Cheshire |
| **North East** | Newcastle, Sunderland, Durham, Tees Valley |
| **Yorkshire & Humber** | Leeds, Sheffield, Bradford, Hull, York |
| **Scotland** | Edinburgh, Glasgow, Aberdeen, Inverness, Dundee |
| **Wales** | Cardiff, Swansea, Newport, Wrexham |
| **Northern Ireland** | Belfast, Derry/Londonderry |

---

## 6. External API Integrations

Signal Mentis integrates with **11 external APIs**:

### 6.1 Firecrawl (Web Scraping & AI Extraction)

**Purpose:** AI-powered web scraping for signal detection

| Field | Value |
|-------|-------|
| **API Type** | REST + LLM extraction |
| **Authentication** | API key (FIRECRAWL_API_KEY) |
| **Used For** | All 13 signal types, Agency website analysis |

**Features:**
- Scrapes any website URL
- Extracts structured data using LLM prompts
- Returns company name, domain, signal title, detail, URL
- Auto-detects industry from page content

### 6.2 Reed API (UK Job Board)

**Purpose:** Direct access to UK job postings

| Field | Value |
|-------|-------|
| **API URL** | https://www.reed.co.uk/api/1.0/search |
| **Authentication** | Basic Auth (REED_API_KEY) |
| **Signal Type** | `new_job` |

**Parameters:**
- `keywords` - Job search terms
- `locationName` - UK location
- `postedWithin` - Days (default 7)
- `postedByDirectEmployer` - Filter recruiters (true)
- `resultsToTake` - Limit (default 20)

### 6.3 LeadMagic (Contact Discovery)

**Purpose:** Find contacts by job role at a company

| Field | Value |
|-------|-------|
| **API URL** | https://api.leadmagic.io/v1/people/role-finder |
| **Authentication** | X-API-Key header |
| **Used For** | Enrichment Phase 1 |

**Input:** Company domain + job title
**Output:** Contact name, LinkedIn URL

### 6.4 Prospeo (Email & Phone Lookup)

**Purpose:** Email and phone discovery for contacts

| Field | Value |
|-------|-------|
| **Email API** | https://api.prospeo.io/email-finder |
| **Phone API** | https://api.prospeo.io/mobile-finder |
| **Authentication** | X-KEY header |

**Email Finder Input:** First name, last name, domain
**Email Finder Output:** Email address with verification status (verified/valid/risky/invalid)

**Phone Finder Input:** LinkedIn profile URL
**Phone Finder Output:** Phone number (if found)

### 6.5 Companies House (UK Company Data)

**Purpose:** UK company information, leadership changes

| Field | Value |
|-------|-------|
| **API Base** | https://api.company-information.service.gov.uk |
| **Authentication** | Free API key |
| **Rate Limit** | 600 requests per 5 minutes |
| **Signal Type** | `leadership_change` |

**Endpoints Used:**
- `/search/companies` - Find company by name
- `/company/{number}` - Get company details
- `/company/{number}/officers` - Get officer list
- `/company/{number}/filing-history` - Get filings

### 6.6 Contracts Finder (UK Government Contracts)

**Purpose:** UK public sector contract awards

| Field | Value |
|-------|-------|
| **API URL** | https://www.contractsfinder.service.gov.uk/Published |
| **Data Standard** | OCDS (Open Contracting Data Standard) |
| **Authentication** | None required |
| **Signal Type** | `contract_awarded` |

### 6.7 Find a Tender (High-Value UK Contracts)

**Purpose:** UK contracts >£118,000 (post-Brexit TED replacement)

| Field | Value |
|-------|-------|
| **API URL** | https://www.find-tender.service.gov.uk/api/1.0 |
| **Authentication** | Optional API key |
| **Signal Type** | `contract_awarded` |

### 6.8 Planning Data (UK Planning Applications)

**Purpose:** Planning permission data for construction signals

| Field | Value |
|-------|-------|
| **API URL** | https://www.planning.data.gov.uk |
| **Authentication** | None required |
| **Coverage** | England only (beta) |
| **Signal Types** | `planning_submitted`, `planning_approved` |

### 6.9 HubSpot (CRM Integration)

**Purpose:** Push signals and contacts to HubSpot CRM

| Field | Value |
|-------|-------|
| **Auth Type** | OAuth 2.0 |
| **Scopes** | companies.read/write, contacts.read/write, deals.read/write |

**Features:**
- Create/update companies (upsert by domain)
- Create/update contacts (upsert by email)
- Auto-associate contacts to companies
- Token auto-refresh on expiration

### 6.10 Resend (Email Delivery)

**Purpose:** Send signal digest emails to users

| Field | Value |
|-------|-------|
| **Service** | Resend.com |
| **Authentication** | API key |
| **Sender** | signals@mentisdigital.co.uk |

**Email Types:**
- Daily signal digest
- Weekly signal digest
- Monthly signal digest

### 6.11 Indeed (Fallback Job Board)

**Purpose:** Fallback when Reed returns insufficient results

| Field | Value |
|-------|-------|
| **Method** | Firecrawl web scraping |
| **URL** | https://uk.indeed.com/jobs |
| **Signal Type** | `new_job` |

---

## 7. User Workflows

### 7.1 AI Search Workflow

**Goal:** Create a search profile and discover signals

**Steps:**
1. Navigate to **AI Search** > **Create Profile**
2. **Step 1 - Industry:** Select target industry
3. **Step 2 - Roles:** Select role categories (auto-filters based on industry)
4. **Step 3 - Location:** Select UK regions
5. **Step 4 - Signal Types:** Select which signals to find
6. **Step 5 - Context:** Name, keywords, scheduling
7. Click **Run Search** on profile card
8. Watch real-time signal discovery (SSE streaming)
9. View results, enrich contacts, export CSV

**Scheduling Options:**
- One-time manual search
- Daily automatic search
- Weekly automatic search
- Monthly automatic search

### 7.2 Agency Finder Workflow

**Goal:** Find signals for recruitment agency specializations

**Steps:**
1. Navigate to **Agency Finder**
2. **Step 1 - Analyze:** Enter recruitment agency website URL
   - Firecrawl scrapes and detects industries
   - Shows detected specializations and confidence
3. **Step 2 - Review:** Confirm or modify detected industries
   - Select signal types (auto-selects high urgency)
   - Select locations
4. **Step 3 - Search:** Real-time signal discovery
   - Shows progress messages
   - Streams signals as found
5. **Step 4 - Results:** View and export signals
   - Shows hiring urgency context for each
   - Save selected signals to database
   - Export to CSV

### 7.3 Sources Workflow

**Goal:** Monitor specific URLs for new signals

**Steps:**
1. Navigate to **Sources** > **Add Source**
2. Enter URL, name, signal type, frequency
3. Source is added and scraped immediately
4. Background cron job re-scrapes based on frequency
5. New signals appear in dashboard and signals page

### 7.4 Contact Enrichment Workflow

**Goal:** Find decision-maker contact information for a signal

**Steps:**
1. Click **Enrich** button on any signal card
2. System determines target roles based on signal type
3. **Phase 1 - LeadMagic:** Find contacts by role at company
   - Searches company domain for target job titles
   - Returns matching LinkedIn profiles and names
4. **Phase 2 - Prospeo:** Get email and phone
   - Finds email address with verification status
   - Optionally finds phone number
5. **Seniority Detection:** Categorize by job title
   - Executive, Senior, Manager, Individual, Unknown
6. Contacts appear on signal card with copy buttons

**Enrichment Streaming:**
- Uses Server-Sent Events (SSE) for real-time updates
- Shows "Finding contact...", "Finding email..." states
- Contacts appear as they're found

### 7.5 HubSpot Push Workflow

**Goal:** Sync signal and contacts to HubSpot CRM

**Prerequisites:**
- HubSpot connected in Settings
- Signal has enriched contacts

**Steps:**
1. Click **Push to HubSpot** icon on signal card
2. System creates/updates company in HubSpot (by domain)
3. System creates/updates contacts (by email)
4. Contacts auto-associated to company
5. Success toast shown
6. Button changes to "View in HubSpot"

### 7.6 Export Workflow

**Goal:** Download signals as CSV or JSON

**Options:**
- **All Signals:** Export page > Download CSV
- **Filtered Signals:** Signals page with filters > Export button
- **Search Results:** After search > Export CSV button
- **Agency Results:** Results step > Export CSV

**CSV Columns:**
- company_name, company_domain, industry
- signal_type, signal_title, signal_detail, signal_url
- location, detected_at, confidence_score
- contact_name, contact_email, contact_phone, contact_seniority
- email_status, linkedin_url, enrichment_source

---

## 8. Confidence Scoring Algorithm

Each signal receives a **confidence score from 0-100** based on three factors:

### Score Breakdown

#### Source Reliability (0-40 points)

| Source | Points |
|--------|--------|
| Government APIs (Contracts Finder, Companies House, Planning Data) | 40 |
| Tracked sources with scrape history | 30 |
| AI search with search_run_id | 25 |
| Generic web scrape | 20 |

#### Domain Verification (0-30 points)

| Domain Status | Points |
|---------------|--------|
| .gov.uk or .nhs.uk domain | 30 |
| .co.uk, .com, .org domain | 25 |
| Valid format (contains dot, no spaces) | 20 |
| Invalid or suspicious format | 5 |
| No domain provided | 0 |

#### Data Completeness (0-30 points)

| Field | Points |
|-------|--------|
| Company name (>2 chars) | 5 |
| Signal title (>5 chars) | 5 |
| Signal detail (>20 chars) | 5 |
| Signal URL (valid http/https) | 5 |
| Location provided (>2 chars) | 5 |
| Industry provided (>2 chars) | 5 |

### Confidence Labels

| Score Range | Label | Badge Color |
|-------------|-------|-------------|
| 70-100 | High | Green |
| 40-69 | Medium | Yellow |
| 0-39 | Low | Red |

---

## 9. Deduplication Logic

Signals are deduplicated using a **hash-based fingerprint** to prevent duplicates across all sources.

### Fingerprint Algorithm

```javascript
function generateFingerprint(signal) {
  const str = `${signal.company_name}|${signal.signal_title}|${signal.signal_url}`;
  return Buffer.from(str.toLowerCase()).toString('base64').slice(0, 64);
}
```

### How It Works

1. Each signal generates a deterministic hash from:
   - Company name
   - Signal title
   - Signal URL
2. Hash is stored in `signals.hash` column (UNIQUE constraint)
3. Before inserting, system checks if hash exists
4. Uses UPSERT with `onConflict: 'hash'` and `ignoreDuplicates: true`

### Deduplication Scope

Duplicates are prevented across:
- Multiple scraping sources
- Web search results
- Government APIs
- Job boards
- Multiple search runs

---

## 10. Background Processing

### Cron Jobs

All cron jobs require `Authorization: Bearer {CRON_SECRET}` header.

#### Daily Cron (`GET /api/cron/daily`)

**Runs:** Every day (recommended: 6am)

**Tasks:**
1. Process URL sources with `scrape_frequency = 'daily'`
2. Run scheduled search profiles with `search_frequency = 'daily'`
3. Sync government data:
   - Contracts Finder (last 24 hours)
   - Find a Tender (last 24 hours)
   - Companies House officers (last 7 days)
   - Planning Data (last 24 hours)
4. Send daily email digests to users with `email_frequency = 'daily'`

#### Weekly Cron (`GET /api/cron/weekly`)

**Runs:** Once per week (recommended: Sunday 6am)

**Tasks:**
- Process `scrape_frequency = 'weekly'` sources
- Run `search_frequency = 'weekly'` profiles
- Send weekly email digests

#### Monthly Cron (`GET /api/cron/monthly`)

**Runs:** First of each month

**Tasks:**
- Process `scrape_frequency = 'monthly'` sources
- Run `search_frequency = 'monthly'` profiles
- Send monthly email digests

#### Government Sync (`GET /api/cron/government`)

**Runs:** Can be triggered independently

**Tasks:**
- Sync all 4 government data sources
- Useful for manual updates outside daily cycle

---

## 11. Email Notifications

### Email Digest Settings

Users configure in Settings:
- **Enable/Disable:** Toggle email notifications
- **Frequency:** Daily, Weekly, or Monthly
- **Alert Types:**
  - URL source discoveries
  - AI search discoveries

### Email Content

Digest emails include:
- Signal count summary
- Signal type breakdown table
- Top 5 signals list with details
- Action buttons: "View Signals", "Download CSV"
- Unsubscribe/preference management link

### Email Template

```
From: Mentis Signals <signals@mentisdigital.co.uk>
Subject: Your Signal Digest - {count} new signals

[Header with branding]
[Signal count banner]
[Signal breakdown by type]
[Top 5 signals with company, type, title]
[View Signals button] [Export CSV button]
[Footer with preferences link]
```

---

## 12. Database Schema

### Core Tables

#### signals
```sql
- id: UUID (primary key)
- source_type: TEXT ('scrape' | 'search')
- source_id: UUID (FK to sources)
- search_run_id: UUID (FK to search_runs)
- signal_type: TEXT (one of 13 types)
- company_name: TEXT
- company_domain: TEXT
- signal_title: TEXT
- signal_detail: TEXT
- signal_url: TEXT
- location: TEXT
- industry: TEXT
- detected_at: TIMESTAMPTZ
- is_new: BOOLEAN
- hash: TEXT (UNIQUE - for deduplication)
- confidence_score: INTEGER (0-100)
```

#### signal_contacts
```sql
- id: UUID (primary key)
- signal_id: UUID (FK to signals)
- full_name: TEXT
- first_name: TEXT
- last_name: TEXT
- job_title: TEXT
- seniority: TEXT ('executive' | 'senior' | 'manager' | 'individual' | 'unknown')
- email: TEXT
- email_status: TEXT ('verified' | 'valid' | 'risky' | 'invalid' | 'unknown')
- phone: TEXT
- linkedin_url: TEXT
- enrichment_source: TEXT
- is_primary: BOOLEAN
- created_at: TIMESTAMPTZ
```

#### search_profiles
```sql
- id: UUID (primary key)
- user_id: UUID (FK to auth.users)
- name: TEXT
- industry: TEXT
- role_categories: TEXT[]
- specific_roles: TEXT[]
- seniority_levels: TEXT[]
- locations: TEXT[]
- signal_types: TEXT[]
- target_company_types: TEXT
- additional_keywords: TEXT[]
- excluded_keywords: TEXT[]
- notes: TEXT
- is_active: BOOLEAN
- auto_search: BOOLEAN
- search_frequency: TEXT ('daily' | 'weekly' | 'monthly')
- last_scheduled_run: TIMESTAMPTZ
```

#### sources
```sql
- id: UUID (primary key)
- user_id: UUID (FK to auth.users)
- name: TEXT
- url: TEXT
- signal_type: TEXT
- industry: TEXT
- scrape_frequency: TEXT ('daily' | 'weekly' | 'monthly')
- is_active: BOOLEAN
- last_scraped_at: TIMESTAMPTZ
- created_at: TIMESTAMPTZ
```

#### search_runs
```sql
- id: UUID (primary key)
- user_id: UUID (FK to auth.users)
- search_profile_id: UUID (FK to search_profiles)
- queries_used: TEXT[]
- signal_types_searched: TEXT[]
- locations_searched: TEXT[]
- urls_found: INTEGER
- urls_scraped: INTEGER
- signals_found: INTEGER
- new_signals: INTEGER
- status: TEXT ('pending' | 'running' | 'completed' | 'failed')
- error_message: TEXT
- started_at: TIMESTAMPTZ
- completed_at: TIMESTAMPTZ
```

#### user_settings
```sql
- id: UUID (primary key)
- user_id: UUID (FK to auth.users)
- notify_email: BOOLEAN
- email_frequency: TEXT
- notify_url_sources: BOOLEAN
- notify_ai_search: BOOLEAN
- leadmagic_api_key: TEXT (encrypted)
- prospeo_api_key: TEXT (encrypted)
- enrichment_include_phone: BOOLEAN
- hubspot_access_token: TEXT (encrypted)
- hubspot_refresh_token: TEXT (encrypted)
- hubspot_expires_at: TIMESTAMPTZ
```

### Row Level Security (RLS)

All tables have RLS policies ensuring:
- Users can only see their own data
- User ID is extracted from auth.uid()
- Admin client bypasses RLS for cron jobs

---

## 13. Technical Architecture

### File Structure

```
src/
├── app/
│   ├── (auth)/                   # Auth pages
│   │   └── login/
│   ├── (dashboard)/              # Protected routes
│   │   ├── dashboard/
│   │   ├── signals/
│   │   ├── search/
│   │   ├── agency/
│   │   ├── sources/
│   │   ├── export/
│   │   └── settings/
│   ├── api/
│   │   ├── search/               # AI search endpoints
│   │   ├── signals/              # Signal CRUD & enrichment
│   │   ├── sources/              # Source management
│   │   ├── agency/               # Agency Finder
│   │   ├── integrations/         # HubSpot
│   │   ├── cron/                 # Scheduled jobs
│   │   └── settings/
│   └── page.tsx                  # Landing page
├── components/
│   ├── dashboard/                # Main components
│   │   ├── SignalCard.tsx
│   │   ├── Sidebar.tsx
│   │   └── AgencyResultsPanel.tsx
│   └── ui/                       # Base UI components
├── lib/
│   ├── supabase/                 # DB & auth clients
│   ├── enrichment/               # LeadMagic + Prospeo
│   │   ├── leadmagic.ts
│   │   └── prospeo.ts
│   ├── integrations/
│   │   └── hubspot.ts
│   ├── contracts-finder.ts       # Gov API
│   ├── find-a-tender.ts          # Gov API
│   ├── companies-house.ts        # Gov API
│   ├── planning-data.ts          # Gov API
│   ├── job-boards.ts             # Reed + Indeed
│   ├── firecrawl.ts              # Web scraping
│   ├── search.ts                 # AI search engine
│   ├── signals.ts                # Signal creation
│   ├── signal-mapping.ts         # Industries, roles, locations
│   ├── signal-scoring.ts         # Confidence algorithm
│   ├── agency-signal-mapping.ts  # Agency feature
│   ├── export.ts                 # CSV/JSON export
│   ├── email.ts                  # Resend integration
│   └── sic-codes.ts              # Industry mapping
└── types/
    └── index.ts                  # TypeScript interfaces
```

### Data Flow

```
┌─────────────────┐
│  SIGNAL SOURCES │
├─────────────────┤
│ • Government    │──┐
│   APIs          │  │
│ • Job Boards    │  │
│ • Web Scraping  │  │
│ • URL Sources   │  │
└─────────────────┘  │
                     ▼
            ┌────────────────┐
            │ SIGNAL STORAGE │
            │   (Supabase)   │
            └───────┬────────┘
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
┌───────────┐ ┌───────────┐ ┌───────────┐
│ DASHBOARD │ │ ENRICHMENT│ │  EXPORT   │
│   VIEW    │ │ LeadMagic │ │  CSV/JSON │
└───────────┘ │ Prospeo   │ └───────────┘
              └─────┬─────┘
                    ▼
            ┌───────────────┐
            │ CRM PUSH      │
            │ (HubSpot)     │
            └───────────────┘
```

### API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/signals` | GET | List signals with filters |
| `/api/signals/export` | GET | Export as CSV/JSON |
| `/api/signals/[id]/enrich/stream` | POST | Enrich with SSE |
| `/api/search/profiles` | GET/POST | Manage profiles |
| `/api/search/run/stream` | POST | Run search with SSE |
| `/api/sources` | GET/POST/DELETE | Manage sources |
| `/api/agency/analyze` | POST | Analyze agency website |
| `/api/agency/search` | POST | Search for signals (SSE) |
| `/api/integrations/hubspot` | GET/POST/DELETE | HubSpot OAuth |
| `/api/integrations/hubspot/push` | POST | Push signal to HubSpot |
| `/api/cron/daily` | GET | Daily processing |
| `/api/cron/weekly` | GET | Weekly processing |
| `/api/settings` | GET/POST | User settings |

---

## Appendix: Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Firecrawl (Web Scraping)
FIRECRAWL_API_KEY=

# Job Boards
REED_API_KEY=

# Contact Enrichment (User provides in Settings)
# LEADMAGIC_API_KEY - stored per user
# PROSPEO_API_KEY - stored per user

# Government APIs
COMPANIES_HOUSE_API_KEY=
FIND_A_TENDER_API_KEY= (optional)

# HubSpot OAuth
HUBSPOT_CLIENT_ID=
HUBSPOT_CLIENT_SECRET=
NEXT_PUBLIC_APP_URL=

# Email
RESEND_API_KEY=

# Cron Jobs
CRON_SECRET=
```

---

*This documentation provides a complete reference for understanding and working with the Signal Mentis platform.*
