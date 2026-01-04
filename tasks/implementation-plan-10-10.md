# Signal-Mentis: Complete Implementation Plan to 10/10

> **Current State:** 7.0/10
> **Target State:** 10/10 (Production Ready)
> **Estimated Total Effort:** 5-6 days of focused development

This document provides a comprehensive implementation plan for the next developer to bring Signal-Mentis to production-ready status.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Critical Issues (Day 1)](#critical-issues-day-1)
3. [High Priority Issues (Day 2)](#high-priority-issues-day-2)
4. [Medium Priority Issues (Day 3)](#medium-priority-issues-day-3)
5. [Feature Completeness (Day 4)](#feature-completeness-day-4)
6. [Polish & Security (Day 5)](#polish--security-day-5)
7. [Testing Checklist](#testing-checklist)
8. [Database Schema Reference](#database-schema-reference)

---

## Project Overview

### Tech Stack
- **Framework:** Next.js 16 (App Router)
- **Database:** Supabase (PostgreSQL)
- **Hosting:** Vercel
- **Auth:** Supabase Auth
- **APIs:** Reed (jobs), LeadMagic (contacts), Prospeo (emails), Contracts Finder, Companies House

### Key Tables
- `companies` - Companies with pain scores
- `company_pain_signals` - Pain signals linked to companies and ICPs
- `company_contacts` - Enriched contacts
- `job_postings` - Job listings from Reed
- `icp_profiles` - User's Ideal Customer Profiles
- `user_settings` - User preferences and API keys

### Already Completed
- [x] Empty state with context-aware CTAs in pain dashboard
- [x] API key validation with Test buttons in Settings
- [x] Export API pagination (limit/offset parameters)
- [x] Signal Key explaining what signals mean
- [x] Job ingestion optimized (removed domain resolution from bulk)
- [x] Date/sort filters on pain dashboard
- [x] "Today's Activity" clickable with deep linking

---

## Critical Issues (Day 1)

### Issue 1: HubSpot Push Uses Wrong Table

**Problem:** The HubSpot push endpoint queries the old `signals` table instead of `company_pain_signals`.

**File:** `src/app/api/integrations/hubspot/push/route.ts`

**Current Code (lines 60-65):**
```typescript
const { data: signal, error: signalError } = await adminSupabase
  .from('signals')  // WRONG - old table
  .select('*, contacts:signal_contacts(*)')
  .eq('id', signalId)
  .single();
```

**Fix Required:**
```typescript
// Option A: Use company_pain_signals table
const { data: signal, error: signalError } = await adminSupabase
  .from('company_pain_signals')
  .select(`
    *,
    companies:company_id(
      id, name, domain, industry, region,
      company_contacts(*)
    )
  `)
  .eq('id', signalId)
  .single();

// Then adapt the pushSignalToHubSpot call:
const result = await pushSignalToHubSpot(
  accessToken,
  {
    company_name: signal.companies.name,
    company_domain: signal.companies.domain,
    location: signal.companies.region,
    industry: signal.companies.industry,
    signal_title: signal.signal_title,
    signal_detail: signal.signal_detail,
  },
  signal.companies.company_contacts || []
);
```

**Also Update:** `src/lib/integrations/hubspot.ts` - ensure `pushSignalToHubSpot` function accepts the new contact format from `company_contacts` table.

**Testing:**
1. Connect HubSpot in Settings
2. Go to Companies in Pain dashboard
3. Click "Push to HubSpot" on a company card
4. Verify company appears in HubSpot CRM

---

### Issue 2: ICP Scan Can Get Stuck Forever

**Problem:** If the backend scan fails, the UI polls forever with no timeout.

**Files to Modify:**

#### A. Add maxDuration to scan API
**File:** `src/app/api/icp/[id]/scan/route.ts`

Add at top of file:
```typescript
export const maxDuration = 300; // 5 minutes max
```

#### B. Add timeout to UI polling
**File:** `src/app/(dashboard)/icp/[id]/ICPProfileDetail.tsx`

Find the polling useEffect and add timeout:
```typescript
const MAX_POLL_TIME = 5 * 60 * 1000; // 5 minutes
const POLL_INTERVAL = 3000; // 3 seconds

useEffect(() => {
  if (profile?.scan_status !== 'scanning') return;

  const startTime = Date.now();

  const interval = setInterval(async () => {
    // Check timeout
    if (Date.now() - startTime > MAX_POLL_TIME) {
      clearInterval(interval);
      setScanError('Scan timed out. Please try again or contact support.');
      return;
    }

    // Fetch updated profile
    const { data } = await supabase
      .from('icp_profiles')
      .select('*')
      .eq('id', profile.id)
      .single();

    if (data?.scan_status === 'complete' || data?.scan_status === 'failed') {
      clearInterval(interval);
      setProfile(data);
      if (data.scan_status === 'failed') {
        setScanError('Scan failed. Please try again.');
      }
    }
  }, POLL_INTERVAL);

  return () => clearInterval(interval);
}, [profile?.scan_status]);
```

#### C. Add error state UI
Add to the component:
```typescript
const [scanError, setScanError] = useState<string | null>(null);

// In JSX, show error if present:
{scanError && (
  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
    <p className="text-red-700">{scanError}</p>
    <Button onClick={handleRescan} className="mt-2">
      Retry Scan
    </Button>
  </div>
)}
```

---

### Issue 3: Missing Input Validation on ICP API

**Problem:** API accepts malformed data that can corrupt the database.

**File:** `src/app/api/icp/route.ts`

**Add Zod validation:**
```typescript
import { z } from 'zod';

const icpCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  industries: z.array(z.string()).min(1, 'At least one industry required'),
  locations: z.array(z.string()).min(1, 'At least one location required'),
  signal_types: z.array(z.string()).min(1, 'At least one signal type required'),
  specific_roles: z.array(z.string()).optional().default([]),
  company_size_min: z.number().int().min(0).optional(),
  company_size_max: z.number().int().min(0).optional(),
});

export async function POST(request: NextRequest) {
  // ... auth check ...

  const body = await request.json();

  // Validate input
  const validation = icpCreateSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json({
      error: 'Validation failed',
      details: validation.error.errors
    }, { status: 400 });
  }

  const validatedData = validation.data;

  // Continue with insert using validatedData...
}
```

---

### Issue 4: Enrichment Has No Error Recovery

**Problem:** If enrichment fails mid-stream, partial contacts are lost.

**File:** `src/app/api/signals/[id]/enrich/stream/route.ts`

**Changes Required:**

1. **Save contacts as they're found (not at end):**
```typescript
// After finding each contact, save immediately
async function saveContact(companyId: string, contact: ContactData) {
  const { error } = await supabase
    .from('company_contacts')
    .upsert({
      company_id: companyId,
      email: contact.email,
      full_name: contact.full_name,
      // ... other fields
    }, {
      onConflict: 'company_id,email' // Deduplicate by email
    });

  if (error) {
    console.error('Failed to save contact:', error);
  }
  return !error;
}
```

2. **Send explicit completion event:**
```typescript
// At end of stream, send summary
writer.write(encoder.encode(`data: ${JSON.stringify({
  type: 'complete',
  summary: {
    total_found: contactsFound,
    total_saved: contactsSaved,
    failed: contactsFailed,
  }
})}\n\n`));
```

3. **Handle stream errors gracefully:**
```typescript
try {
  // ... enrichment logic
} catch (error) {
  writer.write(encoder.encode(`data: ${JSON.stringify({
    type: 'error',
    message: 'Enrichment interrupted. Contacts found so far have been saved.',
    contacts_saved: contactsSaved,
  })}\n\n`));
}
```

---

### Issue 5: Export Page Missing Auth Guard

**Problem:** Unauthenticated users see confusing error.

**File:** `src/app/(dashboard)/export/page.tsx`

This should already be handled by the dashboard layout, but add explicit check:
```typescript
export default async function ExportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // ... rest of component
}
```

---

### Issue 6: Export UI Has No Pagination for Preview

**Problem:** Export page tries to load all signals for preview.

**File:** `src/app/(dashboard)/export/page.tsx`

**Change:** Don't fetch all signals for preview. Just show count and filters:
```typescript
// Instead of fetching all signals:
const { count } = await supabase
  .from('company_pain_signals')
  .select('*', { count: 'exact', head: true })
  .eq('is_active', true);

// Show in UI:
<p>Ready to export {count} signals</p>
<p className="text-sm text-gray-500">
  Export will include company details, signals, and enriched contacts.
</p>
```

---

## High Priority Issues (Day 2)

### Issue 7: API Keys Stored in Plaintext

**Problem:** Security vulnerability - API keys visible if database compromised.

**Solution:** Use encryption at rest.

**File:** `src/app/api/settings/route.ts`

```typescript
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!; // 32 bytes
const IV_LENGTH = 16;

function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text: string): string {
  const parts = text.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = Buffer.from(parts[1], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

// In PUT handler - encrypt before saving:
leadmagic_api_key: body.leadmagic_api_key ? encrypt(body.leadmagic_api_key) : null,

// In GET handler - decrypt after fetching:
if (settings.leadmagic_api_key) {
  settings.leadmagic_api_key = decrypt(settings.leadmagic_api_key);
}
```

**Environment Variable Required:**
```bash
# Generate with: openssl rand -hex 32
ENCRYPTION_KEY=your-32-byte-hex-key
```

---

### Issue 8: Add maxDuration to Scan Endpoint

**Problem:** Long scans hit Vercel timeout.

**File:** `src/app/api/icp/[id]/scan/route.ts`

Add at top:
```typescript
export const maxDuration = 300; // 5 minutes
```

---

### Issue 9: Domain Validation Before Enrichment

**Problem:** NULL, IP addresses, or invalid domains break enrichment.

**Create Helper:** `src/lib/domain-validator.ts`
```typescript
export function isValidDomain(domain: string | null | undefined): boolean {
  if (!domain) return false;

  // Reject IP addresses
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(domain)) return false;

  // Reject file extensions mistakenly used as domains
  if (/\.(pdf|doc|xlsx|csv|txt|jpg|png)$/i.test(domain)) return false;

  // Basic domain pattern
  const domainPattern = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/;
  return domainPattern.test(domain);
}

export function getDomainOrNull(domain: string | null | undefined): string | null {
  return isValidDomain(domain) ? domain : null;
}
```

**Use in enrichment:**
```typescript
import { isValidDomain } from '@/lib/domain-validator';

// Before calling LeadMagic/Prospeo:
if (!isValidDomain(company.domain)) {
  return NextResponse.json({
    error: 'Invalid company domain. Please add a valid domain first.',
    needs_domain: true
  }, { status: 400 });
}
```

---

### Issue 10: HubSpot Token Refresh on Page Load

**Problem:** Settings shows "Connected" even when token is expired.

**File:** `src/app/api/integrations/hubspot/route.ts`

In GET handler, check and refresh token:
```typescript
export async function GET() {
  // ... get user and settings ...

  if (settings?.hubspot_access_token) {
    // Check if token is expired
    if (settings.hubspot_expires_at && Date.now() > settings.hubspot_expires_at) {
      // Try to refresh
      if (settings.hubspot_refresh_token) {
        const { tokens, error } = await refreshAccessToken(settings.hubspot_refresh_token);
        if (tokens) {
          // Save new tokens
          await adminSupabase
            .from('user_settings')
            .update({
              hubspot_access_token: tokens.access_token,
              hubspot_refresh_token: tokens.refresh_token,
              hubspot_expires_at: tokens.expires_at,
            })
            .eq('user_id', user.id);

          return NextResponse.json({ connected: true });
        }
      }
      // Refresh failed - token is invalid
      return NextResponse.json({ connected: false, error: 'Token expired' });
    }
    return NextResponse.json({ connected: true });
  }

  return NextResponse.json({ connected: false });
}
```

---

### Issue 11: Duplicate Detection in Export

**Problem:** Same company exports multiple times.

**File:** `src/app/api/companies/export/route.ts`

The companies export already groups by company. For signals export (`/api/signals/export`), add deduplication:

```typescript
// Group signals by company to avoid duplicates
const companyMap = new Map<string, ExportRow>();

for (const signal of signals) {
  const key = signal.company_id;
  if (!companyMap.has(key)) {
    companyMap.set(key, {
      company: signal.companies,
      signals: [],
      contacts: signal.companies.company_contacts || [],
    });
  }
  companyMap.get(key)!.signals.push(signal);
}

// Export from companyMap instead of raw signals
```

---

### Issue 12: Limit Contact Joins

**Problem:** Signal with many contacts causes slow query.

**File:** `src/app/api/signals/route.ts`

Add limit to contact joins:
```typescript
.select(`
  *,
  source:sources(name),
  contacts:signal_contacts(
    id, full_name, job_title, email, phone, linkedin_url
  )
`)
// Supabase doesn't support limit in joins, so filter in code:
const signalsWithLimitedContacts = signals.map(s => ({
  ...s,
  contacts: (s.contacts || []).slice(0, 10), // Max 10 contacts per signal
}));
```

---

## Medium Priority Issues (Day 3)

### Issue 13: Settings Save Confirmation

**File:** `src/app/(dashboard)/settings/page.tsx`

Add saved state:
```typescript
const [saved, setSaved] = useState(false);

const handleSave = async () => {
  // ... existing save logic ...
  toast.success('Settings saved successfully');
  setSaved(true);
  setTimeout(() => setSaved(false), 3000);
};

// In JSX:
<Button onClick={handleSave} disabled={saving}>
  {saving ? (
    <><Loader2 className="animate-spin mr-2" /> Saving...</>
  ) : saved ? (
    <><CheckCircle className="mr-2 text-green-500" /> Saved!</>
  ) : (
    'Save settings'
  )}
</Button>
```

---

### Issue 14: Better ICP Delete Confirmation

**File:** `src/app/(dashboard)/icp/[id]/ICPProfileDetail.tsx`

Replace `confirm()` with proper modal:
```typescript
const [showDeleteModal, setShowDeleteModal] = useState(false);

// In JSX:
{showDeleteModal && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Delete ICP Profile?</CardTitle>
      </CardHeader>
      <CardContent>
        <p>This will permanently delete "{profile.name}" and all associated scan data.</p>
        <p className="text-red-600 mt-2">This action cannot be undone.</p>
      </CardContent>
      <CardFooter className="flex gap-2 justify-end">
        <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={handleDelete}>
          Delete
        </Button>
      </CardFooter>
    </Card>
  </div>
)}
```

---

### Issue 15: ICP Profile Editing

**Files:**
- `src/app/(dashboard)/icp/[id]/page.tsx` (add edit form)
- `src/app/api/icp/[id]/route.ts` (PUT already exists)

Create edit mode in the detail page:
```typescript
const [editMode, setEditMode] = useState(false);
const [editForm, setEditForm] = useState(profile);

// Toggle button
<Button onClick={() => setEditMode(!editMode)}>
  {editMode ? 'Cancel' : 'Edit Profile'}
</Button>

// Show form when editing (reuse ICP creation form component)
{editMode && (
  <ICPEditForm
    initialData={profile}
    onSave={async (data) => {
      await fetch(`/api/icp/${profile.id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      setEditMode(false);
      refreshProfile();
    }}
  />
)}
```

---

### Issue 16: Export Progress Indicator

**File:** `src/app/(dashboard)/export/page.tsx`

Show estimated size and progress:
```typescript
const [exportProgress, setExportProgress] = useState<string | null>(null);

const handleExport = async () => {
  setExportProgress('Preparing export...');

  // Get count first
  const countRes = await fetch('/api/companies/export?format=json&limit=0');
  const { pagination } = await countRes.json();

  setExportProgress(`Exporting ${pagination.total} companies...`);

  // Do actual export
  const res = await fetch('/api/companies/export?format=csv');
  // ... download logic ...

  setExportProgress(null);
};

// In JSX:
{exportProgress && (
  <div className="flex items-center gap-2">
    <Loader2 className="animate-spin" />
    <span>{exportProgress}</span>
  </div>
)}
```

---

### Issue 17: Enrichment Completion Event

**File:** `src/app/api/signals/[id]/enrich/stream/route.ts`

Already covered in Issue 4. Ensure the stream sends:
```typescript
{ type: 'complete', contacts: savedContacts, summary: { found: X, saved: Y } }
```

---

### Issue 18: Contact Deduplication

**File:** `src/app/api/signals/[id]/enrich/stream/route.ts`

Before inserting contacts:
```typescript
// Check for existing contact with same email
const { data: existing } = await supabase
  .from('company_contacts')
  .select('id')
  .eq('company_id', companyId)
  .eq('email', contact.email)
  .single();

if (existing) {
  // Update instead of insert
  await supabase
    .from('company_contacts')
    .update({ ...contact, updated_at: new Date().toISOString() })
    .eq('id', existing.id);
} else {
  // Insert new
  await supabase
    .from('company_contacts')
    .insert({ company_id: companyId, ...contact });
}
```

Or use upsert with unique constraint on `(company_id, email)`.

---

## Feature Completeness (Day 4)

### Issue 19: Signal Timestamp Display

**File:** `src/components/dashboard/SignalCard.tsx`

Add timestamp to card:
```typescript
<span className="text-xs text-gray-500">
  Detected {formatDistanceToNow(new Date(signal.detected_at), { addSuffix: true })}
</span>
```

---

### Issue 20: ICP Scan Progress Display

**File:** `src/app/(dashboard)/icp/[id]/ICPProfileDetail.tsx`

Show progress during scan:
```typescript
{profile.scan_status === 'scanning' && profile.scan_progress && (
  <div className="p-4 bg-blue-50 rounded-lg">
    <p className="font-medium">Scanning in progress...</p>
    <p className="text-sm text-gray-600">
      Jobs processed: {profile.scan_progress.jobs_processed || 0}
    </p>
    <p className="text-sm text-gray-600">
      Signals created: {profile.scan_progress.signals_created || 0}
    </p>
  </div>
)}
```

---

### Issue 21: Bulk Signal Operations (Optional)

**Files:** New endpoint + UI changes

Create `/api/companies/enrich-batch`:
```typescript
export async function POST(request: NextRequest) {
  const { companyIds } = await request.json();

  // Queue enrichment for each company
  for (const id of companyIds.slice(0, 10)) { // Max 10 at once
    await queueEnrichment(id);
  }

  return NextResponse.json({ queued: companyIds.length });
}
```

---

### Issue 22: Consistent API Responses

Create helper: `src/lib/api-response.ts`
```typescript
export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function errorResponse(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ success: false, error: message, details }, { status });
}
```

Use throughout API routes for consistency.

---

## Polish & Security (Day 5)

### Final Security Audit

1. **Rate limiting** - Add to sensitive endpoints (enrichment, export)
2. **Input sanitization** - Ensure all user inputs are sanitized
3. **Error messages** - Don't leak internal details in errors
4. **Audit logging** - Log sensitive operations

### Performance Audit

1. **Database indexes** - Ensure indexes on frequently queried columns
2. **Query optimization** - Review slow queries in Supabase dashboard
3. **Caching** - Add caching for frequently accessed data

---

## Testing Checklist

### User Journey Tests

- [ ] New user signup → create ICP → scan → view signals
- [ ] User with API keys → enrich company → see contacts
- [ ] User connects HubSpot → push company → verify in HubSpot
- [ ] User exports CSV → opens in Excel → data is correct
- [ ] User with expired HubSpot token → settings shows correct state

### Edge Cases

- [ ] ICP with no matching signals
- [ ] Company with no domain
- [ ] Enrichment with no contacts found
- [ ] Export with 1000+ companies
- [ ] Scan that takes > 2 minutes

### Error Handling

- [ ] Invalid API key in settings
- [ ] Network error during enrichment
- [ ] Scan timeout
- [ ] HubSpot push with expired token

---

## Database Schema Reference

### Key Columns

**companies:**
- `id`, `name`, `domain`, `industry`, `region`
- `hiring_pain_score`, `total_pain_score`
- `companies_house_number`

**company_pain_signals:**
- `id`, `company_id`, `icp_profile_id`
- `pain_signal_type`, `signal_title`, `signal_detail`
- `pain_score_contribution`, `urgency`
- `source` (job_board, contracts_finder, companies_house)
- `detected_at`, `is_active`, `is_new`

**company_contacts:**
- `id`, `company_id`
- `full_name`, `first_name`, `last_name`
- `job_title`, `seniority`
- `email`, `email_status`, `phone`, `linkedin_url`

**icp_profiles:**
- `id`, `user_id`, `name`
- `industries`, `locations`, `signal_types`
- `scan_status`, `scan_progress`
- `is_active`

**user_settings:**
- `user_id`
- `leadmagic_api_key`, `prospeo_api_key`
- `hubspot_access_token`, `hubspot_refresh_token`, `hubspot_expires_at`
- `default_enrichment_roles`

---

## Quick Reference: File Locations

| Issue | Primary File |
|-------|-------------|
| HubSpot wrong table | `src/app/api/integrations/hubspot/push/route.ts` |
| ICP scan timeout | `src/app/(dashboard)/icp/[id]/ICPProfileDetail.tsx` |
| ICP validation | `src/app/api/icp/route.ts` |
| Enrichment recovery | `src/app/api/signals/[id]/enrich/stream/route.ts` |
| Export auth | `src/app/(dashboard)/export/page.tsx` |
| API encryption | `src/app/api/settings/route.ts` |
| Domain validation | `src/lib/domain-validator.ts` (create) |
| Settings save | `src/app/(dashboard)/settings/page.tsx` |
| ICP editing | `src/app/(dashboard)/icp/[id]/page.tsx` |

---

## Success Criteria

When complete, the app should:

1. **Never leave users stuck** - All loading states have timeouts
2. **Never lose data** - Partial enrichments saved, soft deletes
3. **Provide clear feedback** - Success/error messages everywhere
4. **Handle all edge cases** - Invalid domains, expired tokens, empty results
5. **Be secure** - Encrypted API keys, validated inputs, rate limiting
6. **Be performant** - Pagination everywhere, optimized queries

**Target: 9.5-10/10 production ready**
