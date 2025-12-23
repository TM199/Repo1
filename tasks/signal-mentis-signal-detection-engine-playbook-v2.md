# Signal Mentis - Signal Detection Engine Playbook v2

> **Purpose:** Complete implementation guide for detecting hiring pain signals from job board APIs
> **For:** Claude Code implementation
> **Version:** 2.0 - Updated with hard_to_fill vs stale signal distinction
> **Key Insight:** Use `last_seen_at` to distinguish between actively struggling (high value) vs abandoned listings (lower value)

---

## Table of Contents

1. [Critical Discovery](#critical-discovery)
2. [System Overview](#system-overview)
3. [Existing System Integration](#existing-system-integration)
4. [Database Schema](#database-schema)
5. [Reed API Data Model](#reed-api-data-model)
6. [Signal Logic Matrix](#signal-logic-matrix)
7. [Initial ICP Sync (90-Day Historical Pull)](#initial-icp-sync)
8. [Ongoing Signal Detection](#ongoing-signal-detection)
9. [Signal Types & Detection Logic](#signal-types--detection-logic)
10. [Pain Score Calculation](#pain-score-calculation)
11. [Firecrawl Enrichment Strategy](#firecrawl-enrichment-strategy)
12. [Sync Frequency Recommendations](#sync-frequency-recommendations)
13. [Implementation Order](#implementation-order)
14. [Files to Modify](#files-to-modify)

---

## Critical Discovery

### The Problem We Found

A job shows **"259 days open"** in Signal Mentis, but on Reed's website it says **"Posted 5 days ago, Promoted"**.

### Root Cause

The system already tracks job refreshes correctly via `last_seen_at` - **but pain signal generation was ignoring it!**

```
Current (buggy) flow:
├── ingest-jobs/route.ts line 401: 
│   └── When a job fingerprint matches, updates last_seen_at = NOW() ✅
│
└── generate-pain-signals/route.ts line 70-80:
    └── Only uses original_posted_date, ignores last_seen_at ❌
```

**Result:** A job refreshed 5 days ago still shows "259 days open" with no context.

### Key Insights

1. **Reed API does NOT have a reliable "promoted" or "refreshed" flag**
2. **`expirationDate` is NOT reliable** - it changes with each repost
3. **The fingerprint + `last_seen_at` mechanism we already have IS the correct approach**
4. **We just need to USE `last_seen_at` in pain signal generation**

### The Critical Distinction

| Scenario | original_posted_date | last_seen_at | What It Means | Signal Value |
|----------|---------------------|--------------|---------------|--------------|
| **Hard to Fill** | 259 days ago | 5 days ago | Company actively struggling for 259 days, still recruiting | **HIGH** |
| **Stale/Abandoned** | 259 days ago | 45 days ago | Company may have given up or forgotten to remove | **LOWER** |

**A job that's been open for 259 days AND is still being actively refreshed = CONFIRMED pain. This is our BEST signal.**

---

## System Overview

### The Philosophy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SIGNAL DETECTION ENGINE                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   TWO SIGNAL TYPES:                                                      │
│   ─────────────────                                                      │
│                                                                          │
│   HARD TO FILL (High Value)              STALE (Lower Value)            │
│   ─────────────────────────              ───────────────────             │
│   • Old posting + recently seen          • Old posting + NOT seen        │
│   • Company ACTIVELY struggling          • Possibly abandoned            │
│   • Still paying to promote              • Forgot to remove?             │
│   • CONFIRMED pain signal                • May not be real pain          │
│   • Higher pain score                    • Lower pain score              │
│   • Priority for enrichment              • Lower priority                │
│                                                                          │
│   Example: "345 days open,               Example: "345 days open,        │
│   refreshed 2 days ago"                  not seen in 45 days"            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Data Points We Track

| Data Point | Source | Purpose |
|------------|--------|---------|
| `original_posted_date` | Reed API `date` field | How long they've REALLY been trying |
| `last_seen_at` | Our system (updated on each scrape) | Is the job still being actively promoted? |
| `first_seen_at` | Our system | When WE first discovered this job |
| `is_active` | Our system | TRUE if seen in last 3 days |
| `fingerprint` | Computed | Detect reposts (same role, new jobId) |

### Confirmed by Database Query

Real data from MBDA proves this logic is correct:

| Job | Days Open | Last Seen |
|-----|-----------|-----------|
| Manufacturing Electronics Engineer | 345 days | 57 min ago |
| Test Development Engineer | 291 days | 58 min ago |
| Supplier Quality Manager | 72 days | 57 min ago |

These are **ACTIVE** jobs - seen in our scrapes today. They ARE hard to fill (company struggling for 345 days) but NOT abandoned. This is **valuable pain signal intel**.

---

## Signal Logic Matrix

### The Complete Matrix

| original_posted_date | last_seen_at | Signal Type | Pain Score | Message |
|---------------------|--------------|-------------|------------|---------|
| 90+ days ago | Within 14 days | `hard_to_fill_90` | **35** | "Hard to fill - 90+ days, still actively recruiting" |
| 90+ days ago | 14+ days ago | `stale_job_90` | 25 | "Possibly abandoned - 90+ days, not refreshed" |
| 60-89 days ago | Within 14 days | `hard_to_fill_60` | **20** | "Hard to fill - 60+ days, still recruiting" |
| 60-89 days ago | 14+ days ago | `stale_job_60` | 15 | "Possibly abandoned - 60+ days" |
| 30-59 days ago | Within 14 days | `hard_to_fill_30` | **8** | "Slow to fill - 30+ days, still recruiting" |
| 30-59 days ago | 14+ days ago | `stale_job_30` | 5 | "May be stale - 30+ days" |

### Pain Score Weights

```typescript
const PAIN_SCORES = {
  // HARD TO FILL - Higher scores because actively recruiting = confirmed pain
  hard_to_fill_90: 35,  // Struggling for 90+ days AND still trying
  hard_to_fill_60: 20,  // Struggling for 60+ days AND still trying
  hard_to_fill_30: 8,   // Slow to fill but still active
  
  // STALE - Lower scores because may be abandoned
  stale_job_90: 25,     // Very old but not seen recently
  stale_job_60: 15,     // Old and possibly forgotten
  stale_job_30: 5,      // Recently old, might be stale
  
  // REPOST signals - always high value (actively trying again)
  job_reposted_once: 10,
  job_reposted_twice: 20,
  job_reposted_three_plus: 30,
  
  // SALARY signals - active changes = confirmed pain
  salary_increase_10_percent: 15,
  salary_increase_20_percent: 25,
  
  // REFERRAL signals
  referral_bonus: 8,
  high_referral_bonus: 15,
  
  // CONTRACT signals
  contract_no_hiring_30_days: 20,
  contract_no_hiring_60_days: 35,
};
```

---

## Existing System Integration

### What Already Exists (and Works)

The system already has the correct tracking mechanism:

```typescript
// ingest-jobs/route.ts - Line 401
// When a job fingerprint matches an existing job:
await supabase
  .from('job_postings')
  .update({
    last_seen_at: new Date().toISOString(),  // ✅ This is correct!
    is_active: true,
  })
  .eq('id', existingJob.id);
```

### What Needs Fixing

The pain signal generation needs to USE this data:

```typescript
// generate-pain-signals/route.ts - Current (buggy)
const daysOpen = Math.floor(
  (Date.now() - new Date(job.original_posted_date).getTime()) / (1000 * 60 * 60 * 24)
);
// Only uses daysOpen, ignores last_seen_at ❌

// generate-pain-signals/route.ts - Fixed
const daysOpen = Math.floor(
  (Date.now() - new Date(job.original_posted_date).getTime()) / (1000 * 60 * 60 * 24)
);
const daysSinceRefresh = Math.floor(
  (Date.now() - new Date(job.last_seen_at).getTime()) / (1000 * 60 * 60 * 24)
);

// Now use BOTH to determine signal type ✅
```

### Files to Modify

| File | Action | Changes |
|------|--------|---------|
| `src/app/api/cron/generate-pain-signals/route.ts` | **MODIFY** | Use `last_seen_at`, add `hard_to_fill` signal types |
| `src/app/api/icp/[id]/scan/route.ts` | **MODIFY** | Same `last_seen_at` logic for ICP scans |
| `src/components/dashboard/CompaniesInPainDashboard.tsx` | **MODIFY** | Show refresh context on signal cards |

**NO database migration needed** - we already have `last_seen_at` column!

---

## Database Schema

### Existing Tables (No Changes Needed for Core Fix)

The existing schema already has what we need:

```sql
-- job_postings table already has:
original_posted_date DATE NOT NULL,     -- From Reed's `date` field
last_seen_at TIMESTAMPTZ DEFAULT NOW(), -- When WE last saw it ← KEY FIELD
is_active BOOLEAN DEFAULT TRUE,         -- Still appearing in results
```

### New Tables (For Full Implementation)

```sql
-- ============================================
-- 1. COMPANIES TABLE
-- Master table for all companies we track
-- ============================================
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identity
    name TEXT NOT NULL,
    name_normalized TEXT NOT NULL,
    domain TEXT,
    reed_employer_id TEXT,
    companies_house_number TEXT,
    
    -- Classification
    industry TEXT,
    region TEXT,
    employee_count_estimate INTEGER,
    
    -- Pain Scoring
    hiring_pain_score INTEGER DEFAULT 0, -- 0-100
    pain_score_updated_at TIMESTAMPTZ,
    
    -- Tracking
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_companies_name_normalized ON companies (name_normalized);
CREATE INDEX idx_companies_reed_employer ON companies (reed_employer_id);
CREATE INDEX idx_companies_pain_score ON companies (hiring_pain_score DESC);

-- ============================================
-- 2. JOB POSTINGS TABLE
-- All jobs we've seen from Reed/Adzuna
-- ============================================
CREATE TABLE IF NOT EXISTS job_postings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Company link
    company_id UUID REFERENCES companies(id),
    
    -- External IDs
    reed_job_id TEXT UNIQUE,
    adzuna_job_id TEXT UNIQUE,
    
    -- Identity (for repost detection)
    fingerprint TEXT NOT NULL,
    
    -- Core job data
    title TEXT NOT NULL,
    title_normalized TEXT NOT NULL,
    location TEXT,
    location_normalized TEXT,
    
    -- Salary (normalised to annual)
    salary_min INTEGER,
    salary_max INTEGER,
    salary_type TEXT DEFAULT 'annual',
    
    -- Industry (detected from title)
    industry TEXT,
    
    -- Source
    source TEXT NOT NULL, -- 'reed', 'adzuna'
    source_url TEXT,
    
    -- CRITICAL DATE FIELDS
    original_posted_date DATE NOT NULL,      -- Reed's `date` - NEVER changes
    first_seen_at TIMESTAMPTZ DEFAULT NOW(), -- When WE first saw it
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),  -- When WE last saw it ← KEY!
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Computed staleness
    days_open INTEGER GENERATED ALWAYS AS (
        EXTRACT(DAY FROM (CURRENT_DATE - original_posted_date))::INTEGER
    ) STORED,
    
    -- Repost tracking
    repost_count INTEGER DEFAULT 0,
    previous_posting_id UUID REFERENCES job_postings(id),
    salary_increase_from_previous NUMERIC(5,2),
    
    -- Referral detection
    mentions_referral_bonus BOOLEAN DEFAULT FALSE,
    referral_bonus_amount INTEGER,
    
    -- Application tracking
    applications_count INTEGER,
    
    -- Raw data
    raw_description TEXT,
    employer_name_from_source TEXT,
    
    -- Enrichment (from Firecrawl)
    enriched_at TIMESTAMPTZ,
    scraped_posted_days_ago INTEGER,
    scraped_urgently_hiring BOOLEAN,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_job_postings_fingerprint ON job_postings (fingerprint);
CREATE INDEX idx_job_postings_company ON job_postings (company_id);
CREATE INDEX idx_job_postings_active ON job_postings (is_active);
CREATE INDEX idx_job_postings_last_seen ON job_postings (last_seen_at DESC);
CREATE INDEX idx_job_postings_days_open ON job_postings (days_open DESC) WHERE is_active = TRUE;

-- ============================================
-- 3. JOB OBSERVATIONS TABLE
-- Time-series tracking of job state
-- ============================================
CREATE TABLE IF NOT EXISTS job_observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    job_posting_id UUID NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
    
    observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    salary_min INTEGER,
    salary_max INTEGER,
    applications_count INTEGER,
    was_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_job_observations_job ON job_observations (job_posting_id, observed_at DESC);

-- ============================================
-- 4. COMPANY PAIN SIGNALS TABLE
-- Individual pain signals detected
-- ============================================
CREATE TABLE IF NOT EXISTS company_pain_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Signal type (NOW INCLUDES hard_to_fill variants)
    pain_signal_type TEXT NOT NULL,
    /*
      Values:
      - hard_to_fill_30   -- NEW: 30+ days, still actively recruiting
      - hard_to_fill_60   -- NEW: 60+ days, still actively recruiting
      - hard_to_fill_90   -- NEW: 90+ days, still actively recruiting
      - stale_job_30      -- 30+ days, not refreshed recently
      - stale_job_60      -- 60+ days, not refreshed recently
      - stale_job_90      -- 90+ days, not refreshed recently
      - job_reposted_once
      - job_reposted_twice
      - job_reposted_three_plus
      - salary_increase_10_percent
      - salary_increase_20_percent
      - referral_bonus
      - high_referral_bonus
      - contract_no_hiring_30_days
      - contract_no_hiring_60_days
    */
    
    -- Source reference
    source_job_posting_id UUID REFERENCES job_postings(id),
    source_contract_id UUID,
    
    -- Signal details
    signal_title TEXT NOT NULL,
    signal_detail TEXT,
    signal_value INTEGER, -- e.g., days open
    days_since_refresh INTEGER, -- NEW: How recently was this refreshed?
    
    -- Scoring
    pain_score_contribution INTEGER NOT NULL,
    urgency TEXT NOT NULL, -- 'immediate', 'short_term', 'medium_term'
    confidence INTEGER DEFAULT 50,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    resolved_at TIMESTAMPTZ,
    
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pain_signals_company ON company_pain_signals (company_id);
CREATE INDEX idx_pain_signals_type ON company_pain_signals (pain_signal_type);
CREATE INDEX idx_pain_signals_active ON company_pain_signals (is_active, detected_at DESC);

-- ============================================
-- 5. ICP SYNC STATUS TABLE
-- Track sync state for each ICP profile
-- ============================================
CREATE TABLE IF NOT EXISTS icp_sync_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    icp_profile_id UUID NOT NULL,
    
    sync_frequency TEXT DEFAULT 'daily',
    recommended_frequency TEXT,
    
    last_sync_at TIMESTAMPTZ,
    last_sync_jobs_found INTEGER,
    last_sync_new_jobs INTEGER,
    last_sync_signals_generated INTEGER,
    
    initial_sync_completed BOOLEAN DEFAULT FALSE,
    initial_sync_at TIMESTAMPTZ,
    
    total_syncs INTEGER DEFAULT 0,
    total_jobs_tracked INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(icp_profile_id)
);
```

---

## Reed API Data Model

### What Reed Returns

```typescript
interface ReedJobResponse {
  jobId: number;              // Unique ID - changes if reposted
  employerId: number;         // Company's Reed ID
  employerName: string;       // Company name
  jobTitle: string;           // Role title
  locationName: string;       // Location
  
  minimumSalary?: number;     // Lower salary bound
  maximumSalary?: number;     // Upper salary bound
  
  date: string;               // ORIGINAL posted date - NEVER CHANGES ✅
  expirationDate: string;     // When listing expires - UNRELIABLE ❌
  
  applications: number;       // Total applications received
  
  jobDescription: string;     // Full description
  jobUrl: string;             // Link to listing
}
```

### Critical Field Reliability

| Field | Reliable? | Use For |
|-------|-----------|---------|
| `date` | ✅ YES | `original_posted_date` - True age of hiring need |
| `expirationDate` | ❌ NO | Ignore - resets on promote |
| `jobId` | ✅ YES | Unique per listing, detect reposts |
| `employerId` | ✅ YES | Company matching |
| `applications` | ✅ YES | Context on difficulty |

### What Reed Does NOT Provide

- ❌ When job was last promoted/refreshed
- ❌ A "promoted" or "featured" flag
- ❌ Last modified date
- ❌ "Posted X days ago" display value

**This is why we use `last_seen_at` from our own scrapes as the refresh indicator.**

---

## Signal Types & Detection Logic

### Core Detection Module

```typescript
// src/lib/signals/detection.ts

import { createHash } from 'crypto';
import { SupabaseClient } from '@supabase/supabase-js';

// ============================================
// PAIN SCORE CONFIGURATION
// ============================================

export const PAIN_SCORES: Record<string, {
  pain_score: number;
  urgency: 'immediate' | 'short_term' | 'medium_term';
  confidence_base: number;
}> = {
  // HARD TO FILL - Higher scores (actively recruiting = confirmed pain)
  hard_to_fill_90: { pain_score: 35, urgency: 'immediate', confidence_base: 95 },
  hard_to_fill_60: { pain_score: 20, urgency: 'immediate', confidence_base: 85 },
  hard_to_fill_30: { pain_score: 8, urgency: 'short_term', confidence_base: 70 },
  
  // STALE - Lower scores (possibly abandoned)
  stale_job_90: { pain_score: 25, urgency: 'immediate', confidence_base: 70 },
  stale_job_60: { pain_score: 15, urgency: 'short_term', confidence_base: 60 },
  stale_job_30: { pain_score: 5, urgency: 'medium_term', confidence_base: 50 },
  
  // REPOST signals
  job_reposted_once: { pain_score: 10, urgency: 'immediate', confidence_base: 85 },
  job_reposted_twice: { pain_score: 20, urgency: 'immediate', confidence_base: 90 },
  job_reposted_three_plus: { pain_score: 30, urgency: 'immediate', confidence_base: 95 },
  
  // SALARY signals
  salary_increase_10_percent: { pain_score: 15, urgency: 'immediate', confidence_base: 80 },
  salary_increase_20_percent: { pain_score: 25, urgency: 'immediate', confidence_base: 85 },
  
  // REFERRAL signals
  referral_bonus: { pain_score: 8, urgency: 'short_term', confidence_base: 65 },
  high_referral_bonus: { pain_score: 15, urgency: 'short_term', confidence_base: 75 },
  
  // CONTRACT signals
  contract_no_hiring_30_days: { pain_score: 20, urgency: 'immediate', confidence_base: 70 },
  contract_no_hiring_60_days: { pain_score: 35, urgency: 'immediate', confidence_base: 85 },
};

// ============================================
// REFRESH THRESHOLD
// ============================================

const REFRESH_THRESHOLD_DAYS = 14; // Jobs seen within 14 days = "actively recruiting"

// ============================================
// TYPES
// ============================================

interface ProcessingOptions {
  icpProfileId: string;
  isInitialSync: boolean;
}

interface ProcessingResult {
  job_id: string | null;
  company_id: string | null;
  is_new: boolean;
  company_created: boolean;
  signals_generated: SignalGenerated[];
  errors: string[];
}

interface SignalGenerated {
  type: string;
  pain_score: number;
  title: string;
}

interface ReedJob {
  jobId: number;
  employerId: number;
  employerName: string;
  jobTitle: string;
  locationName: string;
  minimumSalary?: number;
  maximumSalary?: number;
  date: string;
  expirationDate: string;
  applications: number;
  jobDescription: string;
  jobUrl: string;
}

// ============================================
// MAIN PROCESSING FUNCTION
// ============================================

export async function processIncomingJob(
  job: ReedJob,
  supabase: SupabaseClient,
  options: ProcessingOptions
): Promise<ProcessingResult> {
  
  const result: ProcessingResult = {
    job_id: null,
    company_id: null,
    is_new: false,
    company_created: false,
    signals_generated: [],
    errors: [],
  };
  
  try {
    // Skip recruitment agencies
    if (isRecruitmentAgency(job.employerName)) {
      return result;
    }
    
    // Find or create company
    const { company, created } = await findOrCreateCompany(
      {
        name: job.employerName,
        reed_employer_id: String(job.employerId),
        location: job.locationName,
      },
      supabase
    );
    
    result.company_id = company.id;
    result.company_created = created;
    
    // Generate fingerprint
    const fingerprint = generateJobFingerprint({
      title: job.jobTitle,
      company_name: job.employerName,
      location: job.locationName,
    });
    
    // Check if job exists
    const { data: existingJob } = await supabase
      .from('job_postings')
      .select('*')
      .eq('reed_job_id', String(job.jobId))
      .single();
    
    if (existingJob) {
      // ========================================
      // EXISTING JOB: Update last_seen_at
      // ========================================
      
      result.job_id = existingJob.id;
      result.is_new = false;
      
      // Detect salary change
      const salaryChange = detectSalaryChange(existingJob, job);
      if (salaryChange && salaryChange.percentage >= 10) {
        const signal = await createSalarySignal(
          company.id,
          existingJob.id,
          salaryChange,
          supabase
        );
        if (signal) {
          result.signals_generated.push({
            type: signal.type,
            pain_score: signal.pain_score,
            title: signal.title,
          });
        }
      }
      
      // UPDATE last_seen_at - THIS IS CRITICAL!
      await supabase
        .from('job_postings')
        .update({
          last_seen_at: new Date().toISOString(),
          is_active: true,
          salary_min: normalizeSalary(job.minimumSalary),
          salary_max: normalizeSalary(job.maximumSalary),
          applications_count: job.applications,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingJob.id);
      
      // Record observation
      await supabase
        .from('job_observations')
        .insert({
          job_posting_id: existingJob.id,
          salary_min: normalizeSalary(job.minimumSalary),
          salary_max: normalizeSalary(job.maximumSalary),
          applications_count: job.applications,
          was_active: true,
        });
      
    } else {
      // ========================================
      // NEW JOB: Check for repost, create record
      // ========================================
      
      result.is_new = true;
      
      // Check for repost
      const repostData = await detectRepost(fingerprint, company.id, supabase);
      
      // Check for referral bonus
      const referralData = detectReferralBonus(job.jobDescription);
      
      // Detect industry
      const industry = detectIndustryFromTitle(job.jobTitle);
      
      // Create job record
      const { data: newJob, error: insertError } = await supabase
        .from('job_postings')
        .insert({
          company_id: company.id,
          reed_job_id: String(job.jobId),
          fingerprint,
          title: job.jobTitle,
          title_normalized: normalizeJobTitle(job.jobTitle),
          location: job.locationName,
          location_normalized: normalizeLocation(job.locationName),
          salary_min: normalizeSalary(job.minimumSalary),
          salary_max: normalizeSalary(job.maximumSalary),
          salary_type: 'annual',
          industry,
          source: 'reed',
          source_url: job.jobUrl,
          original_posted_date: job.date,
          first_seen_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
          applications_count: job.applications,
          repost_count: repostData?.repost_count || 0,
          previous_posting_id: repostData?.previous_posting_id || null,
          salary_increase_from_previous: repostData?.salary_increase || null,
          mentions_referral_bonus: referralData?.has_bonus || false,
          referral_bonus_amount: referralData?.amount || null,
          raw_description: job.jobDescription?.substring(0, 10000),
          employer_name_from_source: job.employerName,
        })
        .select()
        .single();
      
      if (insertError) {
        throw new Error(`Failed to insert job: ${insertError.message}`);
      }
      
      result.job_id = newJob.id;
      
      // Create initial observation
      await supabase
        .from('job_observations')
        .insert({
          job_posting_id: newJob.id,
          salary_min: normalizeSalary(job.minimumSalary),
          salary_max: normalizeSalary(job.maximumSalary),
          applications_count: job.applications,
          was_active: true,
        });
      
      // Generate repost signal if applicable
      if (repostData && repostData.repost_count > 0) {
        const signal = await createRepostSignal(
          company.id,
          newJob.id,
          repostData,
          supabase
        );
        if (signal) {
          result.signals_generated.push({
            type: signal.type,
            pain_score: signal.pain_score,
            title: signal.title,
          });
        }
      }
      
      // Generate referral signal if applicable
      if (referralData && referralData.has_bonus && referralData.amount >= 500) {
        const signal = await createReferralSignal(
          company.id,
          newJob.id,
          referralData,
          supabase
        );
        if (signal) {
          result.signals_generated.push({
            type: signal.type,
            pain_score: signal.pain_score,
            title: signal.title,
          });
        }
      }
    }
    
  } catch (error: any) {
    result.errors.push(error.message);
  }
  
  return result;
}

// ============================================
// FINGERPRINTING
// ============================================

export function generateJobFingerprint(job: {
  title: string;
  company_name: string;
  location: string;
}): string {
  const normalized = [
    normalizeJobTitle(job.title),
    normalizeCompanyName(job.company_name),
    normalizeLocation(job.location),
  ].join('|');
  
  return createHash('sha256')
    .update(normalized)
    .digest('hex')
    .substring(0, 32);
}

export function normalizeJobTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\b(sr|snr|senior)\b/gi, 'senior')
    .replace(/\b(jr|jnr|junior)\b/gi, 'junior')
    .replace(/\b(mgr|manager)\b/gi, 'manager')
    .replace(/\b(eng|engr|engineer)\b/gi, 'engineer')
    .replace(/\b(dev|developer)\b/gi, 'developer')
    .replace(/\b(qty|quantity)\b/gi, 'quantity')
    .replace(/\b(qs)\b/gi, 'quantity surveyor')
    .replace(/\b(pm)\b/gi, 'project manager')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(ltd|limited|plc|llp|inc|corp|corporation|group|uk|holdings)\b\.?/gi, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeLocation(location: string): string {
  return location
    .toLowerCase()
    .replace(/\b(uk|united kingdom|england|wales|scotland|northern ireland)\b/gi, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================
// RECRUITMENT AGENCY DETECTION
// ============================================

export function isRecruitmentAgency(companyName: string): boolean {
  if (!companyName) return false;
  
  const name = companyName.toLowerCase();
  
  const patterns = [
    /recruit/,
    /staffing/,
    /talent\s*(acquisition|solutions|partners)/,
    /resourcing/,
    /personnel/,
    /\bhays\b/,
    /\breed\b(?!\s*(construction|group|smith))/,
    /michael\s*page/,
    /robert\s*(half|walters)/,
    /randstad/,
    /adecco/,
    /manpower/,
    /harvey\s*nash/,
    /nigel\s*frank/,
    /la\s*fosse/,
    /harnham/,
    /computer\s*futures/,
    /sthree/,
    /confidential/,
    /on\s*behalf\s*of/,
    /our\s*client/,
  ];
  
  return patterns.some(pattern => pattern.test(name));
}

// ============================================
// COMPANY MATCHING
// ============================================

async function findOrCreateCompany(
  input: { name: string; reed_employer_id: string; location?: string },
  supabase: SupabaseClient
): Promise<{ company: any; created: boolean }> {
  
  const normalizedName = normalizeCompanyName(input.name);
  
  // Try Reed ID first
  const { data: byReedId } = await supabase
    .from('companies')
    .select('*')
    .eq('reed_employer_id', input.reed_employer_id)
    .single();
  
  if (byReedId) {
    return { company: byReedId, created: false };
  }
  
  // Try normalized name
  const { data: byName } = await supabase
    .from('companies')
    .select('*')
    .eq('name_normalized', normalizedName)
    .single();
  
  if (byName) {
    await supabase
      .from('companies')
      .update({ reed_employer_id: input.reed_employer_id })
      .eq('id', byName.id);
    return { company: byName, created: false };
  }
  
  // Create new
  const region = input.location ? detectRegionFromLocation(input.location) : null;
  
  const { data: newCompany, error } = await supabase
    .from('companies')
    .insert({
      name: input.name,
      name_normalized: normalizedName,
      reed_employer_id: input.reed_employer_id,
      region,
    })
    .select()
    .single();
  
  if (error) throw new Error(`Failed to create company: ${error.message}`);
  
  return { company: newCompany, created: true };
}

function detectRegionFromLocation(location: string): string | null {
  const loc = location.toLowerCase();
  
  const regions: Record<string, string[]> = {
    'London': ['london'],
    'South East': ['surrey', 'kent', 'sussex', 'hampshire', 'berkshire', 'oxfordshire'],
    'South West': ['bristol', 'bath', 'devon', 'cornwall', 'dorset', 'somerset'],
    'East of England': ['cambridge', 'norfolk', 'suffolk', 'essex', 'hertfordshire'],
    'West Midlands': ['birmingham', 'coventry', 'wolverhampton', 'west midlands'],
    'East Midlands': ['nottingham', 'leicester', 'derby', 'northampton'],
    'North West': ['manchester', 'liverpool', 'chester', 'lancashire'],
    'North East': ['newcastle', 'sunderland', 'durham', 'north east'],
    'Yorkshire & Humber': ['leeds', 'sheffield', 'york', 'hull', 'yorkshire'],
    'Scotland': ['edinburgh', 'glasgow', 'aberdeen', 'scotland'],
    'Wales': ['cardiff', 'swansea', 'wales'],
    'Northern Ireland': ['belfast', 'northern ireland'],
  };
  
  for (const [region, keywords] of Object.entries(regions)) {
    if (keywords.some(kw => loc.includes(kw))) return region;
  }
  
  return null;
}

// ============================================
// REPOST DETECTION
// ============================================

async function detectRepost(
  fingerprint: string,
  companyId: string,
  supabase: SupabaseClient
): Promise<{
  is_repost: boolean;
  previous_posting_id: string | null;
  repost_count: number;
  salary_increase: number | null;
} | null> {
  
  const { data: previousJobs } = await supabase
    .from('job_postings')
    .select('*')
    .eq('fingerprint', fingerprint)
    .eq('company_id', companyId)
    .eq('is_active', false)
    .order('last_seen_at', { ascending: false })
    .limit(5);
  
  if (!previousJobs || previousJobs.length === 0) return null;
  
  const mostRecent = previousJobs[0];
  
  const daysSincePrevious = Math.floor(
    (Date.now() - new Date(mostRecent.last_seen_at).getTime()) / (1000 * 60 * 60 * 24)
  );
  
  if (daysSincePrevious > 180) return null; // Too old
  
  return {
    is_repost: true,
    previous_posting_id: mostRecent.id,
    repost_count: (mostRecent.repost_count || 0) + 1,
    salary_increase: null,
  };
}

// ============================================
// SALARY DETECTION
// ============================================

function detectSalaryChange(existingJob: any, incomingJob: ReedJob): { percentage: number } | null {
  const prevMin = existingJob.salary_min;
  const prevMax = existingJob.salary_max;
  const currMin = normalizeSalary(incomingJob.minimumSalary);
  const currMax = normalizeSalary(incomingJob.maximumSalary);
  
  if (!prevMin && !prevMax) return null;
  if (!currMin && !currMax) return null;
  
  const prevMid = (prevMin && prevMax) ? (prevMin + prevMax) / 2 : (prevMin || prevMax);
  const currMid = (currMin && currMax) ? (currMin + currMax) / 2 : (currMin || currMax);
  
  if (!prevMid || !currMid || currMid <= prevMid) return null;
  
  const percentage = Math.round(((currMid - prevMid) / prevMid) * 100);
  
  return percentage >= 5 ? { percentage } : null;
}

function normalizeSalary(salary?: number): number | null {
  if (!salary) return null;
  
  if (salary >= 100 && salary <= 1500) return Math.round(salary * 220); // Daily
  if (salary >= 8 && salary < 100) return Math.round(salary * 37.5 * 52); // Hourly
  if (salary >= 1500 && salary <= 15000) return Math.round(salary * 12); // Monthly
  
  return salary; // Annual
}

// ============================================
// REFERRAL DETECTION
// ============================================

function detectReferralBonus(description: string): { has_bonus: boolean; amount: number | null } | null {
  if (!description) return null;
  
  const text = description.toLowerCase();
  
  const patterns = [
    /referral\s*bonus/i,
    /refer\s*a\s*friend/i,
    /employee\s*referral/i,
    /sign.?on\s*bonus/i,
    /golden\s*hello/i,
    /joining\s*bonus/i,
  ];
  
  for (const pattern of patterns) {
    if (pattern.test(text)) {
      const amountMatch = text.match(/£([\d,]+)/);
      return {
        has_bonus: true,
        amount: amountMatch ? parseInt(amountMatch[1].replace(/,/g, '')) : null,
      };
    }
  }
  
  return null;
}

// ============================================
// INDUSTRY DETECTION
// ============================================

export function detectIndustryFromTitle(title: string): string {
  const t = title.toLowerCase();
  
  const patterns: Record<string, RegExp> = {
    'Technology & Software': /\b(developer|devops|software|frontend|backend|full.?stack|data scientist|cloud|architect|sre)\b/,
    'Construction & Infrastructure': /\b(site manager|quantity surveyor|project manager|contracts manager|civil|groundworks|construction|estimator|qs)\b/,
    'Healthcare & Life Sciences': /\b(nurse|doctor|clinical|healthcare|medical|pharmacist|therapist|nhs)\b/,
    'Financial Services': /\b(accountant|auditor|financial|banker|analyst|compliance|risk|actuary)\b/,
    'Legal & Professional Services': /\b(solicitor|lawyer|paralegal|legal|barrister)\b/,
    'Engineering & Manufacturing': /\b(mechanical engineer|electrical engineer|manufacturing|production|quality|cnc|maintenance)\b/,
    'Energy & Utilities': /\b(renewable|solar|wind|energy|utilities|oil|gas|nuclear|sustainability)\b/,
    'Logistics & Supply Chain': /\b(warehouse|logistics|supply chain|transport|distribution|freight|procurement)\b/,
  };
  
  for (const [industry, pattern] of Object.entries(patterns)) {
    if (pattern.test(t)) return industry;
  }
  
  return 'Other';
}

// Signal creation helpers would go here...
// (createSalarySignal, createRepostSignal, createReferralSignal)
```

---

## Pain Score Calculation

### The Fixed Signal Generation Logic

```typescript
// src/app/api/cron/generate-pain-signals/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PAIN_SCORES } from '@/lib/signals/detection';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const REFRESH_THRESHOLD_DAYS = 14;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const stats = {
    hard_to_fill_signals: 0,
    stale_signals: 0,
    companies_scored: 0,
    signals_deactivated: 0,
    errors: [] as string[],
  };
  
  try {
    // ========================================
    // STEP 1: Generate staleness/hard-to-fill signals
    // ========================================
    
    const { data: activeJobs, error } = await supabase
      .from('job_postings')
      .select('*, company:companies(*)')
      .eq('is_active', true)
      .gte('days_open', 30);
    
    if (error) throw error;
    
    for (const job of activeJobs || []) {
      try {
        // Calculate both metrics
        const daysOpen = Math.floor(
          (Date.now() - new Date(job.original_posted_date).getTime()) / (1000 * 60 * 60 * 24)
        );
        const daysSinceRefresh = Math.floor(
          (Date.now() - new Date(job.last_seen_at).getTime()) / (1000 * 60 * 60 * 24)
        );
        
        // Determine if this is "hard to fill" or "stale"
        const isRecentlyRefreshed = daysSinceRefresh <= REFRESH_THRESHOLD_DAYS;
        
        let signalType: string;
        let signalTitle: string;
        let signalDetail: string;
        
        if (daysOpen >= 90) {
          if (isRecentlyRefreshed) {
            signalType = 'hard_to_fill_90';
            signalTitle = `Hard to fill - ${daysOpen} days`;
            signalDetail = `"${job.title}" open for ${daysOpen} days, still actively recruiting (refreshed ${daysSinceRefresh} days ago)`;
          } else {
            signalType = 'stale_job_90';
            signalTitle = `Possibly abandoned - ${daysOpen} days`;
            signalDetail = `"${job.title}" open for ${daysOpen} days, not refreshed in ${daysSinceRefresh} days`;
          }
        } else if (daysOpen >= 60) {
          if (isRecentlyRefreshed) {
            signalType = 'hard_to_fill_60';
            signalTitle = `Hard to fill - ${daysOpen} days`;
            signalDetail = `"${job.title}" open for ${daysOpen} days, still recruiting (refreshed ${daysSinceRefresh} days ago)`;
          } else {
            signalType = 'stale_job_60';
            signalTitle = `Possibly stale - ${daysOpen} days`;
            signalDetail = `"${job.title}" open for ${daysOpen} days, not refreshed in ${daysSinceRefresh} days`;
          }
        } else {
          // 30-59 days
          if (isRecentlyRefreshed) {
            signalType = 'hard_to_fill_30';
            signalTitle = `Slow to fill - ${daysOpen} days`;
            signalDetail = `"${job.title}" open for ${daysOpen} days, still recruiting`;
          } else {
            signalType = 'stale_job_30';
            signalTitle = `May be stale - ${daysOpen} days`;
            signalDetail = `"${job.title}" open for ${daysOpen} days, not refreshed recently`;
          }
        }
        
        const weights = PAIN_SCORES[signalType];
        
        // Check for existing signal of same type for this job
        const { data: existing } = await supabase
          .from('company_pain_signals')
          .select('id, pain_signal_type')
          .eq('company_id', job.company_id)
          .eq('source_job_posting_id', job.id)
          .or('pain_signal_type.like.hard_to_fill%,pain_signal_type.like.stale_job%')
          .eq('is_active', true)
          .single();
        
        if (existing) {
          // Check if signal type needs upgrading (e.g., 60 -> 90 days)
          // Or changing category (stale -> hard_to_fill)
          if (existing.pain_signal_type !== signalType) {
            // Deactivate old signal
            await supabase
              .from('company_pain_signals')
              .update({ is_active: false, resolved_at: new Date().toISOString() })
              .eq('id', existing.id);
          } else {
            continue; // Already have correct signal
          }
        }
        
        // Create new signal
        await supabase
          .from('company_pain_signals')
          .insert({
            company_id: job.company_id,
            pain_signal_type: signalType,
            source_job_posting_id: job.id,
            signal_title: signalTitle,
            signal_detail: signalDetail,
            signal_value: daysOpen,
            days_since_refresh: daysSinceRefresh,
            pain_score_contribution: weights.pain_score,
            urgency: weights.urgency,
            confidence: weights.confidence_base,
          });
        
        if (signalType.startsWith('hard_to_fill')) {
          stats.hard_to_fill_signals++;
        } else {
          stats.stale_signals++;
        }
        
      } catch (err: any) {
        stats.errors.push(`Job ${job.id}: ${err.message}`);
      }
    }
    
    // ========================================
    // STEP 2: Deactivate resolved signals
    // ========================================
    
    const { data: inactiveJobs } = await supabase
      .from('job_postings')
      .select('id')
      .eq('is_active', false);
    
    const inactiveJobIds = (inactiveJobs || []).map(j => j.id);
    
    if (inactiveJobIds.length > 0) {
      const { data: deactivated } = await supabase
        .from('company_pain_signals')
        .update({ is_active: false, resolved_at: new Date().toISOString() })
        .in('source_job_posting_id', inactiveJobIds)
        .eq('is_active', true)
        .select('id');
      
      stats.signals_deactivated = deactivated?.length || 0;
    }
    
    // ========================================
    // STEP 3: Recalculate company pain scores
    // ========================================
    
    const { data: companiesWithSignals } = await supabase
      .from('companies')
      .select(`
        id,
        signals:company_pain_signals(pain_score_contribution, is_active)
      `);
    
    for (const company of companiesWithSignals || []) {
      const totalScore = (company.signals || [])
        .filter((s: any) => s.is_active)
        .reduce((sum: number, s: any) => sum + (s.pain_score_contribution || 0), 0);
      
      await supabase
        .from('companies')
        .update({
          hiring_pain_score: Math.min(totalScore, 100),
          pain_score_updated_at: new Date().toISOString(),
        })
        .eq('id', company.id);
      
      stats.companies_scored++;
    }
    
    return NextResponse.json({ success: true, stats });
    
  } catch (error: any) {
    console.error('Generate pain signals failed:', error);
    return NextResponse.json({ error: error.message, stats }, { status: 500 });
  }
}
```

---

## Firecrawl Enrichment Strategy

### Priority for Enrichment

With the new signal types, enrichment priority changes:

| Signal Type | Enrichment Priority | Reason |
|-------------|---------------------|--------|
| `hard_to_fill_90` | **HIGHEST** | Confirmed active struggle, max value |
| `hard_to_fill_60` | **HIGH** | Active struggle, good value |
| `job_reposted_three_plus` | **HIGH** | Repeated attempts, confirmed pain |
| `salary_increase_20_percent` | **HIGH** | Desperate measure |
| `hard_to_fill_30` | MEDIUM | Still early, might resolve |
| `stale_job_90` | LOW | May be abandoned |
| `stale_job_60` | LOW | May be abandoned |
| `stale_job_30` | LOWEST | Possibly just slow |

### Updated Enrichment Logic

```typescript
// src/lib/signals/enrichment.ts

export async function enrichTopPainCompanies(
  supabase: SupabaseClient,
  options?: { limit?: number; minPainScore?: number }
): Promise<{ jobs_enriched: number; errors: string[] }> {
  
  const limit = options?.limit || 100;
  const minPainScore = options?.minPainScore || 50;
  
  const result = { jobs_enriched: 0, errors: [] as string[] };
  
  // Prioritise companies with HARD TO FILL signals (not stale)
  const { data: priorityCompanies } = await supabase
    .from('companies')
    .select(`
      id,
      signals:company_pain_signals(pain_signal_type, is_active)
    `)
    .gte('hiring_pain_score', minPainScore)
    .order('hiring_pain_score', { ascending: false })
    .limit(limit);
  
  // Sort by presence of hard_to_fill signals
  const sortedCompanies = (priorityCompanies || []).sort((a, b) => {
    const aHardToFill = a.signals?.filter(
      (s: any) => s.is_active && s.pain_signal_type.startsWith('hard_to_fill')
    ).length || 0;
    const bHardToFill = b.signals?.filter(
      (s: any) => s.is_active && s.pain_signal_type.startsWith('hard_to_fill')
    ).length || 0;
    return bHardToFill - aHardToFill;
  });
  
  const companyIds = sortedCompanies.map(c => c.id);
  
  // Get active jobs for these companies that need enrichment
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  
  // Prioritise jobs with hard_to_fill signals
  const { data: jobsToEnrich } = await supabase
    .from('job_postings')
    .select(`
      id, 
      source_url,
      company_id,
      signals:company_pain_signals(pain_signal_type, is_active)
    `)
    .in('company_id', companyIds)
    .eq('is_active', true)
    .or(`enriched_at.is.null,enriched_at.lt.${oneWeekAgo.toISOString()}`)
    .limit(200);
  
  // Sort jobs - hard_to_fill first
  const sortedJobs = (jobsToEnrich || []).sort((a, b) => {
    const aHardToFill = a.signals?.some(
      (s: any) => s.is_active && s.pain_signal_type.startsWith('hard_to_fill')
    ) ? 1 : 0;
    const bHardToFill = b.signals?.some(
      (s: any) => s.is_active && s.pain_signal_type.startsWith('hard_to_fill')
    ) ? 1 : 0;
    return bHardToFill - aHardToFill;
  });
  
  for (const job of sortedJobs) {
    try {
      if (!job.source_url) continue;
      
      const enrichment = await enrichJobFromPage(job.source_url);
      
      await supabase
        .from('job_postings')
        .update({
          enriched_at: new Date().toISOString(),
          scraped_posted_days_ago: enrichment.scraped_posted_days_ago,
          scraped_urgently_hiring: enrichment.scraped_urgently_hiring,
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id);
      
      result.jobs_enriched++;
      
      // Rate limit
      await new Promise(r => setTimeout(r, 500));
      
    } catch (err: any) {
      result.errors.push(`Job ${job.id}: ${err.message}`);
    }
  }
  
  return result;
}

async function enrichJobFromPage(jobUrl: string): Promise<{
  scraped_posted_days_ago: number | null;
  scraped_urgently_hiring: boolean;
}> {
  
  const response = await fetch('https://api.firecrawl.dev/v0/scrape', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: jobUrl, formats: ['markdown'] }),
  });
  
  if (!response.ok) throw new Error(`Firecrawl failed: ${response.statusText}`);
  
  const data = await response.json();
  const content = data.markdown?.toLowerCase() || '';
  
  // Extract "Posted X days ago"
  const postedMatch = content.match(/posted\s*(\d+)\s*days?\s*ago/i);
  const scraped_posted_days_ago = postedMatch ? parseInt(postedMatch[1]) : null;
  
  // Check for urgency
  const scraped_urgently_hiring = /urgently\s*hiring|urgent|asap|immediate\s*start/i.test(content);
  
  return { scraped_posted_days_ago, scraped_urgently_hiring };
}
```

---

## UI Display Updates

### Signal Card Component

```typescript
// src/components/dashboard/SignalCard.tsx

interface SignalCardProps {
  signal: {
    pain_signal_type: string;
    signal_title: string;
    signal_detail: string;
    signal_value: number;
    days_since_refresh?: number;
    pain_score_contribution: number;
    urgency: string;
  };
}

export function SignalCard({ signal }: SignalCardProps) {
  const isHardToFill = signal.pain_signal_type.startsWith('hard_to_fill');
  
  return (
    <div className={`signal-card ${isHardToFill ? 'high-priority' : 'low-priority'}`}>
      <div className="signal-header">
        <span className={`signal-badge ${isHardToFill ? 'badge-red' : 'badge-amber'}`}>
          {isHardToFill ? '🔥 ACTIVE' : '⏸️ POSSIBLY STALE'}
        </span>
        <span className="pain-score">+{signal.pain_score_contribution} pts</span>
      </div>
      
      <h4 className="signal-title">{signal.signal_title}</h4>
      
      <p className="signal-detail">{signal.signal_detail}</p>
      
      {/* Show refresh context */}
      <div className="signal-context">
        {isHardToFill ? (
          <span className="context-active">
            ✅ Last refreshed {signal.days_since_refresh} days ago - actively recruiting
          </span>
        ) : (
          <span className="context-stale">
            ⚠️ Not seen in {signal.days_since_refresh} days - may be abandoned
          </span>
        )}
      </div>
      
      <div className="signal-urgency">
        Urgency: <span className={`urgency-${signal.urgency}`}>{signal.urgency}</span>
      </div>
    </div>
  );
}
```

---

## Implementation Order

### Phase 1: Fix Signal Generation (Day 1) - CRITICAL

1. **Modify** `src/app/api/cron/generate-pain-signals/route.ts`
   - Add `daysSinceRefresh` calculation
   - Add `hard_to_fill` signal types
   - Update signal generation logic

2. **Modify** `src/app/api/icp/[id]/scan/route.ts`
   - Apply same `last_seen_at` logic

3. **Test** with known data (MBDA example)

### Phase 2: Update UI (Day 2)

1. **Modify** `CompaniesInPainDashboard.tsx`
   - Show refresh context on cards
   - Colour-code by signal type

2. **Add** signal badge component
   - "ACTIVE" for hard_to_fill
   - "POSSIBLY STALE" for stale_job

### Phase 3: Optimise Enrichment (Day 3)

1. **Modify** enrichment cron
   - Prioritise hard_to_fill signals
   - Skip stale signals for cost savings

2. **Update** Firecrawl weekly batch
   - Focus budget on confirmed pain

### Phase 4: Full Testing (Day 4)

1. Run full ICP sync
2. Verify signals are correctly categorised
3. Verify pain scores are accurate
4. Test UI displays context correctly

---

## Expected Outcomes

| Before | After |
|--------|-------|
| "Open 345 days" (misleading) | "Hard to fill - 345 days, refreshed 2 days ago" (accurate) |
| High pain score for abandoned listings | High pain score only for active struggles |
| Wasted Firecrawl on stale jobs | Firecrawl focused on confirmed pain |
| Recruiters confused by old dates | Recruiters see clear context |

---

## Summary

### The Fix in One Sentence

**Use `last_seen_at` to distinguish between companies actively struggling (hard_to_fill = high value) vs possibly abandoned listings (stale = lower value).**

### Key Changes

1. **Signal Types:** Added `hard_to_fill_30/60/90` alongside `stale_job_30/60/90`
2. **Pain Scores:** `hard_to_fill` scores HIGHER than `stale` (confirmed vs suspected)
3. **UI Context:** Show "refreshed X days ago" or "not seen in X days"
4. **Enrichment Priority:** Focus Firecrawl budget on `hard_to_fill` signals
5. **No DB Migration:** Uses existing `last_seen_at` column

---

*This playbook provides everything needed for Claude Code to implement accurate signal detection that distinguishes between active hiring struggles and abandoned listings.*
