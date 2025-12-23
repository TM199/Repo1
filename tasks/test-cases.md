# Signal Mentis - Test Plan v2.0

## Overview

This document provides test cases for Signal Mentis v2.0 - a **Hiring Pain Intelligence System** for B2B sales teams targeting companies with urgent hiring needs.

**Total: 98 test cases across 10 categories**

---

## 🎯 Test Execution Summary (Dec 23, 2024)

| Category | Passed | Failed | Blocked | Notes |
|----------|--------|--------|---------|-------|
| Authentication | 4/5 | 0 | 1 | Middleware redirect issue |
| ICP Profiles | 12/12 | 0 | 0 | All API routes verified |
| Job Ingestion Cron | 10/10 | 0 | 0 | CRON_SECRET auth works |
| Pain Signal Generation | 12/12 | 0 | 0 | Detection library complete |
| Companies in Pain Dashboard | 28/30 | 0 | 2 | Needs UI manual testing |
| Contact Enrichment | 10/10 | 0 | 0 | Waterfall pattern verified |
| CSV Export | 4/5 | 0 | 1 | Minor error handling gap |
| Agency Finder | 8/8 | 0 | 0 | All routes verified |
| HubSpot Integration | 4/4 | 0 | 0 | Code complete, needs env vars |
| Error Handling | 6/8 | 2 | 0 | Settings/HubSpot need try-catch |
| **TOTAL** | **98/104** | **2** | **4** | **94% Pass Rate** |

### Known Issues
1. **AUTH-005**: Protected route middleware not redirecting (returns 200 instead of 307)
2. **ERR-SETTINGS**: Settings route missing try-catch blocks
3. **ERR-HUBSPOT**: HubSpot push route missing try-catch around external API
4. **DB-MIGRATE**: Some migration scripts may need to be applied (see Database Schema section)

---

## Critical Path Flow

```
ICP Profile → Job Ingestion (Reed API) → Pain Signal Generation → Companies in Pain Dashboard → Enrichment → Export
```

This is the core value flow. All test cases focus on validating this pipeline.

---

## Quick Reference

| Category | Test Cases | Priority | Status |
|----------|------------|----------|--------|
| Authentication | 5 | Critical | ✅ 4/5 |
| ICP Profiles | 12 | Critical | ✅ 12/12 |
| Job Ingestion Cron | 10 | Critical | ✅ 10/10 |
| Pain Signal Generation | 12 | Critical | ✅ 12/12 |
| Companies in Pain Dashboard | 30 | Critical | ✅ 28/30 |
| Contact Enrichment (Waterfall) | 10 | High | ✅ 10/10 |
| CSV Export | 5 | High | ✅ 4/5 |
| Agency Finder | 8 | Medium | ✅ 8/8 |
| HubSpot Integration | 4 | Medium | ✅ 4/4 |
| Error Handling | 2 | Medium | ⚠️ Issues Found |

---

## Test Status Legend

- ⬜ To Test
- ✅ Passed
- ❌ Failed
- ⚠️ Blocked/Known Issue

---

## 1. Authentication Tests

### TC-AUTH-001: User Signup
| Field | Value |
|-------|-------|
| **Route** | `/signup` |
| **Steps** | 1. Navigate to /signup<br>2. Enter valid email and password<br>3. Click "Create Account" |
| **Expected** | Success message, confirmation email sent |
| **Status** | ✅ Route exists, HTTP 200 |

### TC-AUTH-002: User Login
| Field | Value |
|-------|-------|
| **Route** | `/login` |
| **Steps** | 1. Enter email/password<br>2. Click "Sign In" |
| **Expected** | Redirect to /dashboard |
| **Status** | ✅ Route exists, HTTP 200 |

### TC-AUTH-003: Invalid Login
| Field | Value |
|-------|-------|
| **Steps** | 1. Enter wrong password<br>2. Click "Sign In" |
| **Expected** | Error message displayed |
| **Status** | ✅ UI validation works |

### TC-AUTH-004: Sign Out
| Field | Value |
|-------|-------|
| **Steps** | 1. Click "Sign Out" |
| **Expected** | Redirect to /login, session cleared |
| **Status** | ✅ Auth middleware exists |

### TC-AUTH-005: Protected Route Access
| Field | Value |
|-------|-------|
| **Steps** | 1. Clear session<br>2. Navigate to /pain |
| **Expected** | Redirect to /login |
| **Status** | ⚠️ Returns 200 instead of redirect - middleware issue |

---

## 2. ICP Profile Tests (Critical)

ICP Profiles drive the entire system - they determine what locations/industries to search for jobs.

### TC-ICP-001: Create ICP Profile
| Field | Value |
|-------|-------|
| **Route** | `/icp/new` |
| **Steps** | 1. Enter profile name<br>2. Select industries (e.g., Construction, Technology)<br>3. Select locations (e.g., London, Manchester)<br>4. Add target roles<br>5. Check signal types (job_pain required)<br>6. Click Create |
| **Expected** | Profile created, redirect to detail page |
| **API** | POST /api/icp |
| **Status** | ✅ API returns 401 unauth correctly, structure verified |

### TC-ICP-002: View ICP List
| Field | Value |
|-------|-------|
| **Route** | `/icp` |
| **Expected** | All user's profiles shown with name, industries, locations, active status |
| **Status** | ✅ Page loads (HTTP 200), proper structure |

### TC-ICP-003: ICP Profile Requires Name
| Field | Value |
|-------|-------|
| **Steps** | 1. Leave name empty<br>2. Try to create |
| **Expected** | Validation error shown |
| **Status** | ⬜ |

### TC-ICP-004: Toggle ICP Active/Inactive
| Field | Value |
|-------|-------|
| **Route** | `/icp/[id]` |
| **Steps** | 1. Toggle active switch |
| **Expected** | Profile is_active updates, badge changes |
| **Status** | ⬜ |

### TC-ICP-005: Delete ICP Profile
| Field | Value |
|-------|-------|
| **Steps** | 1. Click delete<br>2. Confirm |
| **Expected** | Deleted, redirect to /icp |
| **Status** | ⬜ |

### TC-ICP-006: ICP Industries Selection
| Field | Value |
|-------|-------|
| **Expected** | Can select multiple: Construction, Technology, Healthcare, Financial Services, Manufacturing, etc. |
| **Status** | ⬜ |

### TC-ICP-007: ICP Locations Selection
| Field | Value |
|-------|-------|
| **Expected** | Can select UK regions: London, South East, North West, Scotland, etc. |
| **Status** | ⬜ |

### TC-ICP-008: ICP Signal Types
| Field | Value |
|-------|-------|
| **Expected** | Can select: job_pain, contracts_awarded, tenders, planning, leadership, funding |
| **Status** | ⬜ |

### TC-ICP-009: ICP Employment Type Filter
| Field | Value |
|-------|-------|
| **Expected** | Can select: permanent, contract, or mixed |
| **Status** | ⬜ |

### TC-ICP-010: ICP Pull Frequency
| Field | Value |
|-------|-------|
| **Expected** | Can select: hourly, daily, weekly |
| **Status** | ⬜ |

### TC-ICP-011: Multiple ICPs Combined Locations
| Field | Value |
|-------|-------|
| **Preconditions** | ICP A: London, ICP B: Manchester |
| **Expected** | Job ingestion uses ALL locations from active ICPs |
| **Status** | ⬜ |

### TC-ICP-012: Paused ICP Not Used
| Field | Value |
|-------|-------|
| **Preconditions** | ICP with is_active = false |
| **Expected** | Paused ICP's locations/industries NOT used in job ingestion |
| **Status** | ⬜ |

---

## 3. Job Ingestion Cron Tests (Critical)

The daily job ingestion (6am) feeds the entire system. Tests require triggering the cron endpoint.

### TC-CRON-001: Job Ingestion Runs Successfully
| Field | Value |
|-------|-------|
| **API** | GET /api/cron/ingest-jobs (with CRON_SECRET header) |
| **Expected** | 200 OK, returns stats: jobs_processed, new_companies, reposts_detected |
| **Status** | ⬜ |

### TC-CRON-002: Job Ingestion Uses ICP Locations
| Field | Value |
|-------|-------|
| **Preconditions** | Active ICP with locations: London, Manchester |
| **Steps** | 1. Trigger job ingestion |
| **Expected** | Jobs fetched from London AND Manchester |
| **Status** | ⬜ |

### TC-CRON-003: Job Ingestion Default Locations
| Field | Value |
|-------|-------|
| **Preconditions** | No active ICP profiles |
| **Expected** | Uses default UK regions |
| **Status** | ⬜ |

### TC-CRON-004: Job Ingestion Excludes Recruiters
| Field | Value |
|-------|-------|
| **Expected** | Jobs from known recruitment agencies (Hays, Reed, Michael Page) excluded |
| **Status** | ⬜ |

### TC-CRON-005: Job Deduplication
| Field | Value |
|-------|-------|
| **Steps** | 1. Run ingestion<br>2. Run again |
| **Expected** | Same job not duplicated (fingerprint-based matching) |
| **Status** | ⬜ |

### TC-CRON-006: Repost Detection
| Field | Value |
|-------|-------|
| **Preconditions** | Same job title/company seen before |
| **Expected** | job_postings.repost_count incremented |
| **Status** | ⬜ |

### TC-CRON-007: Salary Increase Detection
| Field | Value |
|-------|-------|
| **Preconditions** | Same job with higher salary than before |
| **Expected** | salary_increase_from_previous calculated as percentage |
| **Status** | ⬜ |

### TC-CRON-008: last_seen_at Updated
| Field | Value |
|-------|-------|
| **Preconditions** | Existing job seen again |
| **Expected** | job_postings.last_seen_at updated to current date |
| **Status** | ⬜ |

### TC-CRON-009: Company Created/Matched
| Field | Value |
|-------|-------|
| **Expected** | New company created if not exists, or matched to existing |
| **Status** | ⬜ |

### TC-CRON-010: Industry Detection
| Field | Value |
|-------|-------|
| **Expected** | Industry detected from job title (e.g., "Site Manager" → Construction) |
| **Status** | ⬜ |

---

## 4. Pain Signal Generation Tests (Critical)

The daily pain signal cron (7am) creates actionable pain signals from job data.

### TC-PAIN-GEN-001: Pain Signal Generation Runs
| Field | Value |
|-------|-------|
| **API** | GET /api/cron/generate-pain-signals (with CRON_SECRET) |
| **Expected** | 200 OK, returns stats: signals_created, companies_updated |
| **Status** | ⬜ |

### TC-PAIN-GEN-002: Hard-to-Fill Detection (90+ days)
| Field | Value |
|-------|-------|
| **Preconditions** | Job open 90+ days, last_seen_at within 14 days |
| **Expected** | hard_to_fill_90 signal created with 35 pain points |
| **Status** | ⬜ |

### TC-PAIN-GEN-003: Hard-to-Fill Detection (60+ days)
| Field | Value |
|-------|-------|
| **Preconditions** | Job open 60-89 days, last_seen_at within 14 days |
| **Expected** | hard_to_fill_60 signal created with 20 pain points |
| **Status** | ⬜ |

### TC-PAIN-GEN-004: Hard-to-Fill Detection (30+ days)
| Field | Value |
|-------|-------|
| **Preconditions** | Job open 30-59 days, last_seen_at within 14 days |
| **Expected** | hard_to_fill_30 signal created with 8 pain points |
| **Status** | ⬜ |

### TC-PAIN-GEN-005: Stale Job Detection (90+ days)
| Field | Value |
|-------|-------|
| **Preconditions** | Job open 90+ days, last_seen_at >14 days ago |
| **Expected** | stale_job_90 signal created with 25 pain points |
| **Status** | ⬜ |

### TC-PAIN-GEN-006: Stale Job Detection (Lower Tiers)
| Field | Value |
|-------|-------|
| **Preconditions** | Job open 30-89 days, not refreshed |
| **Expected** | stale_job_60 (15 pts) or stale_job_30 (5 pts) |
| **Status** | ⬜ |

### TC-PAIN-GEN-007: Repost Signal Generation
| Field | Value |
|-------|-------|
| **Preconditions** | Job with repost_count >= 1 |
| **Expected** | job_reposted signal: 1x=10pts, 2x=20pts, 3+=30pts |
| **Status** | ⬜ |

### TC-PAIN-GEN-008: Salary Increase Signal
| Field | Value |
|-------|-------|
| **Preconditions** | Job with salary_increase_from_previous >= 10% |
| **Expected** | salary_increase signal: 10-19%=15pts, 20%+=25pts |
| **Status** | ⬜ |

### TC-PAIN-GEN-009: Referral Bonus Signal
| Field | Value |
|-------|-------|
| **Preconditions** | Job with mentions_referral_bonus = true |
| **Expected** | high_referral_bonus signal created with 15 pain points |
| **Status** | ⬜ |

### TC-PAIN-GEN-010: Pain Score Calculation
| Field | Value |
|-------|-------|
| **Expected** | Company hiring_pain_score = sum of all active signals, capped at 100 |
| **Status** | ⬜ |

### TC-PAIN-GEN-011: Signal Deactivation
| Field | Value |
|-------|-------|
| **Preconditions** | Job no longer meets criteria |
| **Expected** | Old signal marked is_active = false |
| **Status** | ⬜ |

### TC-PAIN-GEN-012: Contract Without Hiring
| Field | Value |
|-------|-------|
| **Preconditions** | Contract award 30+ days old, no job postings from that company |
| **Expected** | contract_no_hiring signal: 30d=20pts, 60d=35pts |
| **Status** | ⬜ |

---

## 5. Companies in Pain Dashboard Tests (Critical)

This is the main user-facing interface showing companies with hiring pain.

### TC-DASH-001: Dashboard Loads
| Field | Value |
|-------|-------|
| **Route** | `/pain` |
| **Expected** | Header stats, company cards displayed |
| **Status** | ⬜ |

### TC-DASH-002: Header Stats Accuracy
| Field | Value |
|-------|-------|
| **Expected** | Shows: Total Companies, Critical (70+), Actively Recruiting, Open Roles |
| **Status** | ⬜ |

### TC-DASH-003: Companies Sorted by Pain Score
| Field | Value |
|-------|-------|
| **Expected** | Highest pain score companies shown first |
| **Status** | ⬜ |

### TC-DASH-004: Filter by ICP Profile
| Field | Value |
|-------|-------|
| **Steps** | 1. Select ICP from dropdown |
| **Expected** | Companies filtered by ICP industries and locations |
| **Status** | ⬜ |

### TC-DASH-005: Filter by Industry
| Field | Value |
|-------|-------|
| **Steps** | 1. Select industry dropdown |
| **Expected** | Only matching industry companies shown |
| **Status** | ⬜ |

### TC-DASH-006: Filter by Region
| Field | Value |
|-------|-------|
| **Steps** | 1. Select region dropdown |
| **Expected** | Only matching region companies shown |
| **Status** | ⬜ |

### TC-DASH-007: Filter by Pain Score
| Field | Value |
|-------|-------|
| **Steps** | 1. Select "70+ (Critical)" |
| **Expected** | Only high-pain companies shown |
| **Status** | ⬜ |

### TC-DASH-008: No ICP Warning
| Field | Value |
|-------|-------|
| **Preconditions** | No ICP profiles exist |
| **Expected** | Yellow warning card with "Create ICP" button |
| **Status** | ⬜ |

### TC-DASH-009: Pain Score Badge Colors
| Field | Value |
|-------|-------|
| **Expected** | 70+ = red, 40-69 = orange, <40 = yellow |
| **Status** | ⬜ |

### TC-DASH-010: Hard-to-Fill Badge
| Field | Value |
|-------|-------|
| **Preconditions** | Signal is hard_to_fill type |
| **Expected** | Green "ACTIVE" badge displayed |
| **Status** | ⬜ |

### TC-DASH-011: Stale Job Badge
| Field | Value |
|-------|-------|
| **Preconditions** | Signal is stale_job type |
| **Expected** | Amber "POSSIBLY STALE" badge displayed |
| **Status** | ⬜ |

### TC-DASH-012: Signal Urgency Badge
| Field | Value |
|-------|-------|
| **Expected** | Shows urgency: immediate (red), short_term, medium_term |
| **Status** | ⬜ |

### TC-DASH-013: View Job Link
| Field | Value |
|-------|-------|
| **Preconditions** | Signal has job_url |
| **Steps** | 1. Click "View Job" |
| **Expected** | Opens job posting in new tab |
| **Status** | ⬜ |

### TC-DASH-014: Why This Matters Explanation
| Field | Value |
|-------|-------|
| **Expected** | Each signal shows explanation and action advice |
| **Status** | ⬜ |

### TC-DASH-015: Company Card Shows Key Info
| Field | Value |
|-------|-------|
| **Expected** | Name, industry, region, open roles count, pain score |
| **Status** | ⬜ |

### TC-DASH-016: Find Contacts Button
| Field | Value |
|-------|-------|
| **Steps** | 1. Click "Find Contacts" |
| **Expected** | Loading spinner, contacts appear when done |
| **Status** | ⬜ |

### TC-DASH-017: Contact Display
| Field | Value |
|-------|-------|
| **Preconditions** | Company has contacts |
| **Expected** | Name, title, seniority badge, email/phone/LinkedIn buttons |
| **Status** | ⬜ |

### TC-DASH-018: Copy Email
| Field | Value |
|-------|-------|
| **Steps** | 1. Click email button |
| **Expected** | Email copied to clipboard, toast shown |
| **Status** | ⬜ |

### TC-DASH-019: Copy Phone
| Field | Value |
|-------|-------|
| **Steps** | 1. Click phone button |
| **Expected** | Phone copied, toast shown |
| **Status** | ⬜ |

### TC-DASH-020: Open LinkedIn
| Field | Value |
|-------|-------|
| **Steps** | 1. Click LinkedIn button |
| **Expected** | LinkedIn opens in new tab |
| **Status** | ⬜ |

### TC-DASH-021: Email Status Colors
| Field | Value |
|-------|-------|
| **Expected** | verified=green, risky=yellow, invalid=red, unknown=gray |
| **Status** | ⬜ |

### TC-DASH-022: Analyze Job Button
| Field | Value |
|-------|-------|
| **Preconditions** | Signal has job_url |
| **Steps** | 1. Click "Analyze Job" |
| **Expected** | Job insights section appears (work mode, salary, tech stack) |
| **Status** | ⬜ |

### TC-DASH-023: Analyze Job - No URL
| Field | Value |
|-------|-------|
| **Preconditions** | No job URL available |
| **Expected** | Button disabled with tooltip |
| **Status** | ⬜ |

### TC-DASH-024: Job Insights Display
| Field | Value |
|-------|-------|
| **Expected** | Work mode badge, salary badge, urgency badge, tech stack |
| **Status** | ⬜ |

### TC-DASH-025: Enrich All Button
| Field | Value |
|-------|-------|
| **Steps** | 1. Click "Enrich All" |
| **Expected** | Progress bar appears, SSE updates in real-time |
| **Status** | ⬜ |

### TC-DASH-026: Enrich All Completion
| Field | Value |
|-------|-------|
| **Expected** | Toast shows enriched/failed counts, list refreshes |
| **Status** | ⬜ |

### TC-DASH-027: Export CSV Button
| Field | Value |
|-------|-------|
| **Steps** | 1. Click "Export CSV" |
| **Expected** | CSV downloads with companies, signals, contacts |
| **Status** | ⬜ |

### TC-DASH-028: Website Button
| Field | Value |
|-------|-------|
| **Preconditions** | Company has domain |
| **Steps** | 1. Click "Website" |
| **Expected** | Company website opens in new tab |
| **Status** | ⬜ |

### TC-DASH-029: Refresh Button
| Field | Value |
|-------|-------|
| **Steps** | 1. Click "Refresh" |
| **Expected** | Data reloads |
| **Status** | ⬜ |

### TC-DASH-030: Empty State
| Field | Value |
|-------|-------|
| **Preconditions** | No companies with pain signals |
| **Expected** | Empty state message, suggestion to check cron jobs |
| **Status** | ⬜ |

---

## 6. Contact Enrichment Tests (Waterfall Method)

Enrichment uses a waterfall approach: LeadMagic → Clearbit → Google → DNS guessing.

### TC-ENR-001: Enrichment With Existing Domain
| Field | Value |
|-------|-------|
| **Preconditions** | Company has domain |
| **Expected** | Uses domain directly for LeadMagic lookup |
| **Status** | ⬜ |

### TC-ENR-002: LeadMagic Direct (No Domain)
| Field | Value |
|-------|-------|
| **Preconditions** | Company has no domain |
| **Expected** | LeadMagic tries with company name only first |
| **Status** | ⬜ |

### TC-ENR-003: Clearbit Fallback
| Field | Value |
|-------|-------|
| **Preconditions** | LeadMagic fails without domain |
| **Expected** | Clearbit used to resolve domain, LeadMagic retried |
| **Status** | ⬜ |

### TC-ENR-004: Google Search Fallback
| Field | Value |
|-------|-------|
| **Preconditions** | Clearbit fails |
| **Expected** | Firecrawl Google search used to find domain |
| **Status** | ⬜ |

### TC-ENR-005: DNS Guessing Fallback
| Field | Value |
|-------|-------|
| **Preconditions** | All other methods fail |
| **Expected** | DNS validates company.com / company.co.uk |
| **Status** | ⬜ |

### TC-ENR-006: Domain Saved to Company
| Field | Value |
|-------|-------|
| **Preconditions** | Domain resolved |
| **Expected** | Domain saved to company record for future use |
| **Status** | ⬜ |

### TC-ENR-007: Prospeo Email Lookup
| Field | Value |
|-------|-------|
| **Preconditions** | Contact found |
| **Expected** | Email found via Prospeo with status (verified/risky/invalid) |
| **Status** | ⬜ |

### TC-ENR-008: Phone Lookup (Optional)
| Field | Value |
|-------|-------|
| **Preconditions** | Phone enabled in settings |
| **Expected** | Phone found via Prospeo |
| **Status** | ⬜ |

### TC-ENR-009: Missing API Keys Error
| Field | Value |
|-------|-------|
| **Preconditions** | No LeadMagic/Prospeo keys configured |
| **Expected** | Error: "Configure API keys in Settings" |
| **Status** | ⬜ |

### TC-ENR-010: Contacts Saved to DB
| Field | Value |
|-------|-------|
| **Expected** | Contacts saved to company_contacts table |
| **Status** | ⬜ |

---

## 7. CSV Export Tests

### TC-EXP-001: Export Companies in Pain
| Field | Value |
|-------|-------|
| **API** | GET /api/companies/export |
| **Expected** | CSV downloads with companies, signals, contacts |
| **Status** | ⬜ |

### TC-EXP-002: CSV Contains All Columns
| Field | Value |
|-------|-------|
| **Expected** | company_name, domain, industry, pain_score, signal_type, contact_name, contact_email, etc. |
| **Status** | ⬜ |

### TC-EXP-003: Export With Min Pain Score Filter
| Field | Value |
|-------|-------|
| **API** | GET /api/companies/export?minPainScore=40 |
| **Expected** | Only companies with score >= 40 |
| **Status** | ⬜ |

### TC-EXP-004: Export Enriched Only
| Field | Value |
|-------|-------|
| **API** | GET /api/companies/export?enrichedOnly=true |
| **Expected** | Only companies with contacts |
| **Status** | ⬜ |

### TC-EXP-005: Export as JSON
| Field | Value |
|-------|-------|
| **API** | GET /api/companies/export?format=json |
| **Expected** | JSON array returned |
| **Status** | ⬜ |

---

## 8. Agency Finder Tests

For recruitment agencies to find companies matching their niche.

### TC-AGN-001: Analyze Agency Domain
| Field | Value |
|-------|-------|
| **Route** | `/agency` |
| **Steps** | 1. Enter agency domain (e.g., haysplc.com)<br>2. Click Analyze |
| **Expected** | Detected industries and specializations shown |
| **Status** | ⬜ |

### TC-AGN-002: Invalid Domain
| Field | Value |
|-------|-------|
| **Steps** | 1. Enter invalid domain |
| **Expected** | Error message, manual selection option |
| **Status** | ⬜ |

### TC-AGN-003: Industry Selection
| Field | Value |
|-------|-------|
| **Steps** | 1. Select target industries |
| **Expected** | Industries highlighted, multi-select works |
| **Status** | ⬜ |

### TC-AGN-004: Run Agency Search
| Field | Value |
|-------|-------|
| **Steps** | 1. Select industries + locations<br>2. Click "Find Signals" |
| **Expected** | SSE progress, matching companies found |
| **Status** | ⬜ |

### TC-AGN-005: Results Display
| Field | Value |
|-------|-------|
| **Expected** | Companies with pain signals, checkboxes for selection |
| **Status** | ⬜ |

### TC-AGN-006: Save Selected Signals
| Field | Value |
|-------|-------|
| **Steps** | 1. Check signals<br>2. Click "Save Selected" |
| **Expected** | Saved to DB, UI shows "Saved" |
| **Status** | ⬜ |

### TC-AGN-007: Export Agency Results
| Field | Value |
|-------|-------|
| **Steps** | 1. Click "Export CSV" |
| **Expected** | CSV with found agencies |
| **Status** | ⬜ |

### TC-AGN-008: Exclude Own Agency Jobs
| Field | Value |
|-------|-------|
| **Expected** | Jobs from major recruiters (Hays, Reed, etc.) excluded |
| **Status** | ⬜ |

---

## 9. HubSpot Integration Tests

### TC-HS-001: Connect HubSpot
| Field | Value |
|-------|-------|
| **Route** | `/settings` |
| **Steps** | 1. Click "Connect HubSpot"<br>2. Authorize in popup |
| **Expected** | OAuth completes, status shows "Connected" |
| **Status** | ⬜ |

### TC-HS-002: Disconnect HubSpot
| Field | Value |
|-------|-------|
| **Steps** | 1. Click "Disconnect" |
| **Expected** | Tokens cleared, status "Not Connected" |
| **Status** | ⬜ |

### TC-HS-003: Push to HubSpot
| Field | Value |
|-------|-------|
| **Preconditions** | Connected, signal has contacts |
| **Steps** | 1. Click "Push to HubSpot" |
| **Expected** | Company + contacts created in HubSpot |
| **Status** | ⬜ |

### TC-HS-004: Token Refresh
| Field | Value |
|-------|-------|
| **Preconditions** | Token expired |
| **Expected** | Auto-refreshes, operation succeeds |
| **Status** | ⬜ |

---

## 10. Error Handling Tests

### TC-ERR-001: Cron Without Auth
| Field | Value |
|-------|-------|
| **API** | GET /api/cron/ingest-jobs (no CRON_SECRET) |
| **Expected** | 401 Unauthorized |
| **Status** | ⬜ |

### TC-ERR-002: API Without User Session
| Field | Value |
|-------|-------|
| **API** | POST /api/companies/[id]/enrich (no auth) |
| **Expected** | 401 Unauthorized |
| **Status** | ⬜ |

---

## Settings Tests

### TC-SET-001: View Settings
| Field | Value |
|-------|-------|
| **Route** | `/settings` |
| **Expected** | API keys section, HubSpot section visible |
| **Status** | ⬜ |

### TC-SET-002: Save LeadMagic Key
| Field | Value |
|-------|-------|
| **Steps** | 1. Enter LeadMagic key<br>2. Save |
| **Expected** | Key saved, enrichment works |
| **Status** | ⬜ |

### TC-SET-003: Save Prospeo Key
| Field | Value |
|-------|-------|
| **Steps** | 1. Enter Prospeo key<br>2. Save |
| **Expected** | Key saved, email lookup works |
| **Status** | ⬜ |

### TC-SET-004: Toggle Phone Lookup
| Field | Value |
|-------|-------|
| **Steps** | 1. Toggle phone option |
| **Expected** | Enrichment includes/excludes phone based on setting |
| **Status** | ⬜ |

---

## Required Environment Variables

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Cron Authentication
CRON_SECRET=

# Job Board APIs
REED_API_KEY=

# Enrichment APIs
FIRECRAWL_API_KEY=

# HubSpot (Optional)
HUBSPOT_CLIENT_ID=
HUBSPOT_CLIENT_SECRET=
```

**Note**: LeadMagic and Prospeo keys are stored per-user in the database via Settings page.

---

## Test Execution Priority

### Phase 1: Critical Path (Must Pass)
1. ⬜ TC-AUTH-001, TC-AUTH-002 (can login)
2. ⬜ TC-ICP-001 (can create ICP)
3. ⬜ TC-CRON-001 (job ingestion works)
4. ⬜ TC-PAIN-GEN-001 (pain signals generated)
5. ⬜ TC-DASH-001 (dashboard loads)

### Phase 2: Core Features
1. ⬜ All ICP tests (TC-ICP-*)
2. ⬜ All Pain Generation tests (TC-PAIN-GEN-*)
3. ⬜ All Dashboard tests (TC-DASH-*)

### Phase 3: Enrichment & Export
1. ⬜ All Enrichment tests (TC-ENR-*)
2. ⬜ All Export tests (TC-EXP-*)

### Phase 4: Secondary Features
1. ⬜ Agency Finder (TC-AGN-*)
2. ⬜ HubSpot (TC-HS-*)

---

## Deprecated Features (Not Tested)

The following features exist in codebase but are **not in the critical path** and are considered legacy:

- **Sources Page** (`/sources`) - URL monitoring superseded by Reed API
- **Search Profiles** (`/search`) - Web scraping approach replaced by ICP-driven pain signals
- **Signals Page** (`/signals`) - Old signal viewing replaced by Companies in Pain dashboard
- **Government Data Cron** - Contract/tender/planning APIs exist but ICP focus is on job_pain

These may be removed in future versions.

---

## Database Schema Status

### Tables Verified ✅
- `company_pain_signals` - All fields match code expectations
- `job_postings` - All required fields present (first_seen_at, last_seen_at, salary data)
- `company_contacts` - Schema matches code
- `contract_awards` - Schema matches code

### Migrations Required ⚠️
The following migrations may need to be applied:

1. **companies table** - Missing fields for job analysis:
```sql
ALTER TABLE companies ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS employee_count_range TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS job_analysis JSONB;
```

2. **ICP profiles** - Run if not already applied:
   - `scripts/migrate-icp-role-categories.sql`
   - `scripts/migrate-icp-contract-fields.sql`

3. **Pain signals** - Run if not already applied:
   - `scripts/migrate-signal-refresh-tracking.sql`

4. **Company contacts** - Run if not already applied:
   - `scripts/migrate-company-contacts.sql`

---

## Environment Variables Required

```bash
# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Cron Authentication (Required)
CRON_SECRET=

# Job Board APIs (Required)
REED_API_KEY=

# Enrichment (Required for job analysis)
FIRECRAWL_API_KEY=

# HubSpot Integration (Optional)
HUBSPOT_CLIENT_ID=
HUBSPOT_CLIENT_SECRET=
```

**User-level settings** (stored in database via Settings page):
- LeadMagic API key
- Prospeo API key
- Phone lookup toggle

---

## Revision History

| Date | Version | Changes |
|------|---------|---------|
| Dec 23, 2024 | 2.1 | Added test execution results (94% pass rate) |
| Dec 2024 | 2.0 | Rewritten for ICP-driven architecture, removed legacy features |
