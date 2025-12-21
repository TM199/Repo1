# Signal Mentis - Implementation Plan

## Context for New Claude Session

This document contains a comprehensive plan to fix and enhance the Signal Mentis application. The previous session analyzed the entire codebase, identified issues, and designed solutions. You should implement this plan.

---

## What is Signal Mentis?

A Next.js SaaS app that finds business signals (funding rounds, contract awards, job postings, etc.) and converts them into actionable sales leads. Currently:
- Uses Firecrawl API for web search and AI extraction
- Stores data in Supabase
- Deployed on Vercel (now Pro plan with 60s timeout)

**The goal**: Transform from "signal detection" to a complete "signal-to-lead pipeline" by adding contact enrichment.

---

## Current Problems

1. **Search timeouts**: Firecrawl scraping takes 10-30s per URL. With 3 queries, total time exceeds limits.
2. **No contact enrichment**: Signals show company info but no decision maker contacts.
3. **Signals aren't leads**: Without names/emails/phones, users can't action the signals.

---

## The Solution (4 Phases)

### Phase 1: Fix Search Reliability

**Problem**: Searches timeout because Firecrawl scraping is slow.

**Solution**: Add timeout protection and reduce query count.

**Tasks**:

1. **Add timeout wrapper to Firecrawl calls** in `src/lib/search.ts`:
```typescript
// Wrap with Promise.race for timeout protection
async function withTimeout<T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(errorMsg)), ms)
  );
  return Promise.race([promise, timeout]);
}

// Usage in executeSearch():
const searchResults = await withTimeout(
  firecrawl.search(query, { limit: 5 }),
  10000, // 10s timeout
  'Search timed out'
);

const scrapeResult = await withTimeout(
  firecrawl.scrape(result.url, {...}),
  15000, // 15s timeout
  'Scrape timed out'
);
```

2. **Reduce default queries from 3 to 2** in `src/lib/search.ts` line 102:
```typescript
const maxQueries = profile.search_count || 2; // Changed from 3
```

3. **Improve error handling** in run page - show specific errors with retry button.

---

### Phase 2: Decision Maker Mapping Framework

**Goal**: Automatically determine which job titles to search for based on signal type.

**Create new file**: `src/lib/contact-mapping.ts`

```typescript
export type Department =
  | 'engineering' | 'sales' | 'marketing' | 'finance'
  | 'hr' | 'operations' | 'product' | 'design'
  | 'legal' | 'customer_success' | 'general';

const DEPARTMENT_HIRING_MANAGERS: Record<Department, string[]> = {
  engineering: ['Engineering Manager', 'VP Engineering', 'CTO', 'Tech Lead'],
  sales: ['Sales Director', 'VP Sales', 'Head of Sales', 'Sales Manager'],
  marketing: ['Marketing Director', 'CMO', 'Head of Marketing', 'Marketing Manager'],
  finance: ['Finance Director', 'CFO', 'Financial Controller', 'Head of Finance'],
  hr: ['HR Director', 'Head of People', 'Talent Director', 'CHRO'],
  operations: ['Operations Director', 'COO', 'Head of Operations', 'Ops Manager'],
  product: ['Product Director', 'VP Product', 'Head of Product', 'CPO'],
  design: ['Design Director', 'Head of Design', 'Creative Director', 'UX Director'],
  legal: ['General Counsel', 'Legal Director', 'Head of Legal', 'CLO'],
  customer_success: ['CS Director', 'VP Customer Success', 'Head of CS', 'CS Manager'],
  general: ['CEO', 'Managing Director', 'General Manager', 'Director'],
};

const SIGNAL_TYPE_ROLES: Record<string, string[]> = {
  funding_announced: ['CEO', 'Founder', 'CFO', 'VP Growth', 'VP Sales', 'Head of People'],
  contract_awarded: ['Managing Director', 'Project Director', 'Operations Director', 'Contracts Manager'],
  company_expansion: ['HR Director', 'Operations Director', 'Regional Manager', 'Head of People'],
  leadership_change: [], // Contact is already in the signal (the new leader)
  planning_approved: ['Managing Director', 'Development Director', 'Project Manager'],
  company_hiring: ['HR Director', 'Talent Acquisition Manager', 'Head of People'],
  acquisition_merger: ['CEO', 'CFO', 'Integration Director', 'HR Director'],
  layoffs_restructure: ['HR Director', 'CEO', 'Operations Director'],
  new_job: [], // Special case - detect department from job title
};

// Detect department from job title keywords
export function detectDepartment(jobTitle: string): Department {
  const title = jobTitle.toLowerCase();

  if (/engineer|developer|software|devops|sre|architect|tech lead|cto/i.test(title)) return 'engineering';
  if (/sales|account exec|business develop|bdr|sdr/i.test(title)) return 'sales';
  if (/marketing|growth|brand|content|seo|ppc|cmo/i.test(title)) return 'marketing';
  if (/finance|accountant|cfo|controller|treasury/i.test(title)) return 'finance';
  if (/hr|human resource|people|talent|recruit/i.test(title)) return 'hr';
  if (/operations|ops|supply chain|logistics|coo/i.test(title)) return 'operations';
  if (/product|pm|product manager|cpo/i.test(title)) return 'product';
  if (/design|ux|ui|creative|graphic/i.test(title)) return 'design';
  if (/legal|counsel|compliance|regulatory/i.test(title)) return 'legal';
  if (/customer success|cs|support|client/i.test(title)) return 'customer_success';

  return 'general';
}

// Get target roles to search for based on signal type
export function getTargetRoles(signalType: string, signalTitle?: string): string[] {
  // For job postings, find the hiring manager for that department
  if (signalType === 'new_job' && signalTitle) {
    const department = detectDepartment(signalTitle);
    return DEPARTMENT_HIRING_MANAGERS[department];
  }

  // For other signal types, use predefined roles
  return SIGNAL_TYPE_ROLES[signalType] || SIGNAL_TYPE_ROLES.company_hiring;
}
```

---

### Phase 3: Lead Enrichment Integration

**Goal**: Add one-click "Enrich" button that finds contacts at the company.

#### API Integrations

**LeadMagic - Role Finder** (finds person by job title at company):
```
POST https://api.leadmagic.io/v1/people/role-finder
Header: X-API-Key: {key}
Body: { company_name, company_domain, job_title }
Response: { name, first_name, last_name, profile_url }
Cost: 2 credits per lookup
```

**Prospeo - Email Finder** (gets email from name + company):
```
POST https://api.prospeo.io/email-finder
Header: X-KEY: {key}
Body: { first_name, last_name, company: "domain.com" }
Response: { email, email_status: "VALID"|"CATCH_ALL" }
Cost: 1 credit per lookup
```

**Prospeo - Mobile Finder** (gets phone from LinkedIn URL):
```
POST https://api.prospeo.io/mobile-finder
Header: X-KEY: {key}
Body: { url: "linkedin.com/in/..." }
Response: { response: { raw_format: "+44...", international_format: "..." } }
Cost: 10 credits per lookup
```

#### IMPORTANT: API Call Structure

**LeadMagic accepts ONE job_title per API call (not an array).** You must make separate calls for each role:

```typescript
// To find 3 contacts, you need 3 separate API calls:
const ceo = await findContactByRole(domain, company, "CEO", apiKey);      // Call 1
const cfo = await findContactByRole(domain, company, "CFO", apiKey);      // Call 2
const vpSales = await findContactByRole(domain, company, "VP Sales", apiKey); // Call 3
```

**Enrichment loop structure:**
```typescript
for (const role of targetRoles.slice(0, 3)) {
  // One LeadMagic call per role
  const contact = await findContactByRole(domain, companyName, role, apiKey);
  if (contact) {
    // One Prospeo call per contact for email
    const email = await findEmail(contact.first_name, contact.last_name, domain, prospeoKey);
    // Optional: One Prospeo call per contact for phone
    const phone = includePhone ? await findPhone(contact.profile_url, prospeoKey) : null;
    contacts.push({ ...contact, email, phone });
  }
}
```

**Total API calls per signal (3 contacts, with phone):** 9 calls (3 LeadMagic + 3 Prospeo email + 3 Prospeo phone)

#### New Files to Create

**1. `src/lib/enrichment/leadmagic.ts`**
```typescript
interface LeadMagicContact {
  name: string;
  first_name: string;
  last_name: string;
  profile_url: string; // LinkedIn URL
  company_name: string;
}

export async function findContactByRole(
  domain: string,
  companyName: string,
  jobTitle: string,
  apiKey: string
): Promise<LeadMagicContact | null> {
  const response = await fetch('https://api.leadmagic.io/v1/people/role-finder', {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      company_domain: domain,
      company_name: companyName,
      job_title: jobTitle,
    }),
  });

  if (!response.ok) return null;

  const data = await response.json();
  if (data.message !== 'Role Found') return null;

  return data;
}
```

**2. `src/lib/enrichment/prospeo.ts`**
```typescript
export async function findEmail(
  firstName: string,
  lastName: string,
  domain: string,
  apiKey: string
): Promise<{ email: string; status: string } | null> {
  const response = await fetch('https://api.prospeo.io/email-finder', {
    method: 'POST',
    headers: {
      'X-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      first_name: firstName,
      last_name: lastName,
      company: domain,
    }),
  });

  if (!response.ok) return null;

  const data = await response.json();
  if (data.error) return null;

  return {
    email: data.response.email,
    status: data.response.email_status,
  };
}

export async function findPhone(
  linkedinUrl: string,
  apiKey: string
): Promise<string | null> {
  const response = await fetch('https://api.prospeo.io/mobile-finder', {
    method: 'POST',
    headers: {
      'X-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: linkedinUrl }),
  });

  if (!response.ok) return null;

  const data = await response.json();
  if (data.error) return null;

  return data.response?.raw_format || null;
}
```

**3. `src/lib/enrichment/index.ts`**
```typescript
import { findContactByRole } from './leadmagic';
import { findEmail, findPhone } from './prospeo';
import { getTargetRoles } from '../contact-mapping';

export interface EnrichedContact {
  full_name: string;
  first_name: string;
  last_name: string;
  job_title: string;
  email: string | null;
  email_status: string | null;
  phone: string | null;
  linkedin_url: string | null;
}

export async function enrichSignal(
  companyDomain: string,
  companyName: string,
  signalType: string,
  signalTitle: string,
  leadmagicKey: string,
  prospeoKey: string,
  includePhone: boolean = false,
  maxContacts: number = 3
): Promise<EnrichedContact[]> {
  const targetRoles = getTargetRoles(signalType, signalTitle);
  const contacts: EnrichedContact[] = [];

  for (const role of targetRoles.slice(0, maxContacts)) {
    // 1. Find contact by role (LeadMagic)
    const contact = await findContactByRole(companyDomain, companyName, role, leadmagicKey);
    if (!contact) continue;

    // 2. Get email (Prospeo)
    const emailResult = await findEmail(
      contact.first_name,
      contact.last_name,
      companyDomain,
      prospeoKey
    );

    // 3. Get phone if enabled (Prospeo)
    let phone = null;
    if (includePhone && contact.profile_url) {
      phone = await findPhone(contact.profile_url, prospeoKey);
    }

    contacts.push({
      full_name: contact.name,
      first_name: contact.first_name,
      last_name: contact.last_name,
      job_title: role,
      email: emailResult?.email || null,
      email_status: emailResult?.status || null,
      phone,
      linkedin_url: contact.profile_url,
    });
  }

  return contacts;
}
```

**4. `src/app/api/signals/[id]/enrich/route.ts`**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';
import { enrichSignal } from '@/lib/enrichment';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const signalId = params.id;

  // Get user's API keys from settings
  const { data: settings } = await supabase
    .from('user_settings')
    .select('leadmagic_api_key, prospeo_api_key, enrichment_include_phone')
    .eq('user_id', user.id)
    .single();

  if (!settings?.leadmagic_api_key || !settings?.prospeo_api_key) {
    return NextResponse.json(
      { error: 'Please configure API keys in Settings' },
      { status: 400 }
    );
  }

  // Get signal details
  const adminSupabase = createAdminClient();
  const { data: signal } = await adminSupabase
    .from('signals')
    .select('*')
    .eq('id', signalId)
    .single();

  if (!signal) {
    return NextResponse.json({ error: 'Signal not found' }, { status: 404 });
  }

  try {
    // Enrich the signal
    const contacts = await enrichSignal(
      signal.company_domain,
      signal.company_name,
      signal.signal_type,
      signal.signal_title,
      settings.leadmagic_api_key,
      settings.prospeo_api_key,
      settings.enrichment_include_phone || false,
      3 // max contacts
    );

    // Save contacts to database
    if (contacts.length > 0) {
      const contactsToInsert = contacts.map((c, index) => ({
        signal_id: signalId,
        full_name: c.full_name,
        first_name: c.first_name,
        last_name: c.last_name,
        job_title: c.job_title,
        email: c.email,
        email_status: c.email_status,
        phone: c.phone,
        linkedin_url: c.linkedin_url,
        is_primary: index === 0,
        enrichment_source: 'leadmagic+prospeo',
      }));

      await adminSupabase.from('signal_contacts').insert(contactsToInsert);
    }

    return NextResponse.json({ success: true, contacts });
  } catch (error) {
    console.error('Enrichment error:', error);
    return NextResponse.json(
      { error: 'Enrichment failed' },
      { status: 500 }
    );
  }
}
```

#### Database Migrations

Run this SQL in Supabase:

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

#### UI Updates

**Update `src/app/(dashboard)/settings/page.tsx`** - Add API key inputs:
- LeadMagic API Key (password field)
- Prospeo API Key (password field)
- Include phone numbers toggle (checkbox)
- Test Connection buttons

**Update `src/components/dashboard/SignalCard.tsx`** - Add:
- "Enrich" button (only shows if not already enriched)
- Loading state while enriching
- Display contacts when enriched (name, title, email, phone, LinkedIn link)

**Update `src/components/dashboard/SignalsTable.tsx`** - Add:
- Contacts column showing count or names
- Bulk "Enrich Selected" button

---

### Phase 4: Enhanced Exports

**Update `src/lib/export.ts`** - Include contact fields in CSV:
- contact_name
- contact_title
- contact_email
- contact_phone
- contact_linkedin

Output one row per contact (signal info repeated for each contact).

---

## Files Summary

### New Files to Create
| File | Purpose |
|------|---------|
| `src/lib/contact-mapping.ts` | Smart role mapping by signal type |
| `src/lib/enrichment/leadmagic.ts` | LeadMagic API wrapper |
| `src/lib/enrichment/prospeo.ts` | Prospeo API wrapper |
| `src/lib/enrichment/index.ts` | Enrichment orchestrator |
| `src/app/api/signals/[id]/enrich/route.ts` | Enrichment API endpoint |

### Files to Modify
| File | Changes |
|------|---------|
| `src/lib/search.ts` | Add timeout wrapper, reduce default queries |
| `src/app/(dashboard)/settings/page.tsx` | Add API key settings UI |
| `src/components/dashboard/SignalCard.tsx` | Add Enrich button + contacts display |
| `src/components/dashboard/SignalsTable.tsx` | Add contacts column + bulk enrich |
| `src/lib/export.ts` | Include contact fields in CSV |
| `src/types/index.ts` | Add Contact, EnrichmentResult interfaces |

---

## Implementation Order

1. **Phase 1**: Fix search timeouts (~1-2 hours)
2. **Phase 2**: Create contact mapping module (~1 hour)
3. **Phase 3**: Build enrichment integration (~3-4 hours)
4. **Phase 4**: Update exports (~1 hour)

**Total**: ~7-10 hours

---

## Cost Per Enriched Signal

| Action | Credits |
|--------|---------|
| LeadMagic (3 contacts) | 6 |
| Prospeo emails (3) | 3 |
| Prospeo phones (3, optional) | 30 |
| **Total without phones** | **9 credits (~$0.10)** |
| **Total with phones** | **39 credits (~$0.40)** |

---

## Notes

- User must add their own LeadMagic and Prospeo API keys in Settings
- Enrichment is triggered manually per signal (click "Enrich" button)
- Phone lookup is optional (costs 10x more than email)
- The decision maker mapping is smart but can be overridden later with custom profiles
