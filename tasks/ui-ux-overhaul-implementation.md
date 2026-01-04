# Signal Mentis UI/UX Overhaul - Implementation Document

## Project Overview

**Signal Mentis** is a B2B sales intelligence platform that detects "pain signals" from companies that indicate they're likely to need your services (hiring difficulties, contract wins, leadership changes, etc.). It helps sales teams identify and prioritize outreach to companies showing signs of need.

### Tech Stack
- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui (Radix UI based)
- **Database**: Supabase (PostgreSQL + Realtime)
- **Background Jobs**: Inngest (2 functions migrated, 7 remain on Vercel crons)
- **AI**: Anthropic Claude + Tavily for web search
- **Email**: Resend
- **Deployment**: Vercel

### Key Colors
- Primary Purple: `#635BFF`
- Dark Navy: `#0A2540`
- Secondary Gray: `#6B7C93`

---

## Current File Structure

```
src/
├── app/
│   ├── (dashboard)/          # Dashboard routes (protected)
│   │   ├── dashboard/        # Main overview
│   │   ├── pain/             # Companies in Pain view
│   │   ├── icp/              # ICP Profile management
│   │   ├── signals/          # Signal list view
│   │   ├── settings/         # User settings
│   │   ├── export/           # CSV export
│   │   └── layout.tsx        # Dashboard layout with sidebar
│   └── api/
│       ├── cron/             # Vercel cron jobs (7 active)
│       ├── companies/        # Company endpoints
│       ├── signals/          # Signal endpoints
│       ├── inngest/          # Inngest webhook handler
│       └── ...
├── components/
│   ├── ui/                   # shadcn/ui components
│   └── dashboard/
│       ├── CompaniesInPainDashboard.tsx  # Main pain dashboard (1600+ lines)
│       └── SignalCard.tsx                 # Signal display card (770+ lines)
├── inngest/
│   ├── client.ts             # Inngest client
│   └── functions/
│       ├── classify-companies.ts     # ✅ Migrated
│       ├── generate-pain-signals.ts  # ✅ Migrated
│       └── index.ts
└── lib/
    ├── supabase/             # Supabase clients
    ├── email.ts              # Resend email functions
    ├── signal-explanations.ts # Pain signal explanations
    └── ...
```

---

## Current UI State (Problems to Fix)

### 1. No Animations
- Currently: Instant state changes, no visual feedback
- Impact: Feels cheap, unprofessional
- Solution: Add framer-motion with subtle professional animations

### 2. Basic Loading States
- Currently: Simple `<Loader2>` spinner everywhere
- Impact: Jarring transitions, no skeleton loading
- Solution: Skeleton screens + smooth content transitions

### 3. Confusing Naming
| Current Label | Problem | New Label |
|---------------|---------|-----------|
| "Verified" (green badge) | Users think it means verified company | "Direct Employer" |
| "Agency" (red badge) | Looks like an error/warning | "Recruitment Agency" (amber) |
| "Classify" button | Unclear what it does | "Check if Agency" |
| "Enrich All" button | Vague | "Find All Contacts" |

### 4. Hidden Signal Key
- Currently: Collapsed by default, users don't understand pain scores
- Solution: Always-visible legend bar

### 5. No In-App Notifications
- Currently: Email-only notifications
- Solution: Bell icon with real-time dropdown + optional sound

---

## Sprint Completion Tracking

| Sprint | Focus | Status | Completed By |
|--------|-------|--------|--------------|
| 1 | Animation Foundation | ✅ Complete | 2026-01-02 |
| 2 | Loading States & Transitions | ✅ Complete | 2026-01-02 |
| 3 | Naming & Clarity Fixes | ✅ Complete | 2026-01-02 |
| 4 | In-App Notifications | ✅ Complete | 2026-01-02 |
| 5 | Micro-Interactions | ✅ Complete | 2026-01-02 |
| 6 | Inngest Migration Part 1 | ✅ Complete | 2026-01-02 |
| 7 | Inngest Migration Part 2 | ✅ Complete | 2026-01-02 |
| 8 | Dashboard Enhancements | ✅ Complete | 2026-01-02 |

**Update this table as you complete each sprint!**

---

## Technical Patterns to Follow

### Component Pattern (shadcn/ui style)
```tsx
import { cn } from "@/lib/utils";

interface ComponentProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "outline";
}

export function Component({ className, variant = "default", ...props }: ComponentProps) {
  return (
    <div
      className={cn(
        "base-classes-here",
        variant === "outline" && "border border-gray-200",
        className
      )}
      {...props}
    />
  );
}
```

### Animation Pattern (framer-motion)
```tsx
import { motion, AnimatePresence } from "framer-motion";
import { fadeIn, staggerContainer, staggerItem } from "@/lib/animations";

// For lists:
<motion.div variants={staggerContainer} initial="hidden" animate="visible">
  {items.map(item => (
    <motion.div key={item.id} variants={staggerItem}>
      {/* content */}
    </motion.div>
  ))}
</motion.div>

// For expand/collapse:
<AnimatePresence>
  {isExpanded && (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
    >
      {/* content */}
    </motion.div>
  )}
</AnimatePresence>
```

### Supabase Pattern
```tsx
// Client-side (browser)
import { createClient } from "@/lib/supabase/client";
const supabase = createClient();

// Server-side (API routes)
import { createClient, createAdminClient } from "@/lib/supabase/server";
const supabase = await createClient();
const adminSupabase = createAdminClient(); // For service role operations
```

### Supabase Realtime Pattern
```tsx
useEffect(() => {
  const supabase = createClient();
  const channel = supabase
    .channel('channel-name')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'table_name',
      filter: `user_id=eq.${userId}`,
    }, (payload) => {
      // Handle new row
      setData(prev => [payload.new, ...prev]);
    })
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, [userId]);
```

### Inngest Function Pattern
```typescript
import { inngest } from "../client";

export const myFunction = inngest.createFunction(
  {
    id: "function-id",
    throttle: { limit: 10, period: "1m" }, // Optional rate limiting
    retries: 3,
  },
  [
    { cron: "0 7 * * *" }, // Optional cron trigger
    { event: "event/name" }, // Event trigger
  ],
  async ({ event, step }) => {
    // Step 1: Each step is independently retriable
    const result = await step.run("step-name", async () => {
      // Do work
      return someValue;
    });

    // Step 2: Use result from step 1
    await step.run("another-step", async () => {
      // More work using `result`
    });

    return { success: true };
  }
);
```

### Toast Pattern
```tsx
import { toast } from "sonner";

// Success
toast.success("Action completed successfully");

// Error
toast.error("Something went wrong");

// Info
toast.info("Information message");

// With description
toast.success("Classified company", {
  description: "Identified as Direct Employer (95% confidence)"
});
```

---

## Database Tables Reference

### Key Tables for UI Work

```sql
-- Companies table
companies (
  id UUID PRIMARY KEY,
  name TEXT,
  domain TEXT,
  domain_source TEXT,
  domain_confidence SMALLINT,
  is_recruitment_agency BOOLEAN,
  agency_confidence SMALLINT,
  agency_reasoning TEXT,
  agency_classified_at TIMESTAMPTZ,
  hiring_pain_score INTEGER
)

-- Pain signals table
company_pain_signals (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  icp_profile_id UUID,
  pain_signal_type TEXT,
  signal_title TEXT,
  signal_detail TEXT,
  pain_score_contribution INTEGER,
  detected_at TIMESTAMPTZ,
  is_active BOOLEAN,
  notified_at TIMESTAMPTZ,
  metadata JSONB
)

-- User settings (for notifications)
user_settings (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  notify_email BOOLEAN DEFAULT TRUE,
  notification_frequency TEXT DEFAULT 'daily',
  -- Will add: notification_sound_enabled BOOLEAN DEFAULT TRUE
)

-- Will create: user_notifications
-- Will create: system_activity
```

---

## Vercel Cron Jobs (to migrate to Inngest)

| Route | Schedule | Status |
|-------|----------|--------|
| `/api/cron/ingest-jobs` | Every 4 hours | ✅ Migrated (Sprint 6) |
| `/api/cron/process-scan-queue` | Every 15 min | ✅ Migrated (Sprint 6) |
| `/api/cron/government` | 5am daily | ✅ Migrated (Sprint 7) |
| `/api/cron/companies-house-signals` | 5:30am daily | ✅ Migrated (Sprint 7) |
| `/api/cron/contracts-finder-signals` | 6am daily | ✅ Migrated (Sprint 7) |
| `/api/cron/rescan-icp-jobs` | 6am, 12pm, 6pm | ✅ Migrated (Sprint 7) |
| `/api/cron/schedule-daily-jobs` | 6am daily | ✅ Migrated (Sprint 7) |

---

## Testing Checklist

After each sprint, verify:

- [ ] `npm run build` passes with no errors
- [ ] Page loads without console errors
- [ ] New components render correctly
- [ ] Animations are smooth (no jank)
- [ ] Loading states appear correctly
- [ ] Mobile responsiveness maintained
- [ ] Dark mode compatibility (if applicable)

---

## Environment Variables

Required in `.env.local` and Vercel:

```
NEXT_PUBLIC_SUPABASE_URL=https://xjzznsqbfnphlsqhanbd.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ANTHROPIC_API_KEY=...
TAVILY_API_KEY=...
INNGEST_SIGNING_KEY=...
INNGEST_EVENT_KEY=...
RESEND_API_KEY=...
CRON_SECRET=...
```

---

## Sprint Dependencies

```
Sprint 1 (Animation Foundation)
    ↓
Sprint 2 (Loading States) ←── depends on Sprint 1
    ↓
Sprint 5 (Micro-Interactions) ←── depends on Sprint 1

Sprint 3 (Naming Fixes) ←── independent, can run anytime

Sprint 4 (Notifications) ←── requires database migration

Sprint 6 (Inngest Part 1)
    ↓
Sprint 7 (Inngest Part 2) ←── depends on Sprint 6

Sprint 8 (Dashboard) ←── depends on Sprint 1, optionally Sprint 4 & 7
```

---

## How to Use This Document

1. **Before starting a sprint**: Read this entire document to understand context
2. **During sprint**: Follow the technical patterns section
3. **After sprint**: Update the Sprint Completion Tracking table
4. **If stuck**: Check the existing implementations in `CompaniesInPainDashboard.tsx` for patterns

---

## Session Handoff Notes

When completing a sprint, leave notes here for the next session:

### Sprint 1 Notes
**Completed 2026-01-02**

Files created:
- `src/lib/animations.ts` - Animation variants (fadeIn, slideUp, slideDown, scaleIn, staggerContainer, staggerItem, expandCollapse, shimmerKeyframes)
- `src/components/ui/skeleton.tsx` - Base Skeleton component with shimmer + preset variants (SkeletonText, SkeletonBadge, SkeletonButton, SkeletonIcon)
- `src/components/dashboard/CompanyCardSkeleton.tsx` - Matches company card layout with signal row skeletons
- `src/components/dashboard/SignalCardSkeleton.tsx` - Matches SignalCard layout

Usage examples:
```tsx
// Animation for lists
import { motion } from 'framer-motion';
import { staggerContainer, staggerItem } from '@/lib/animations';

<motion.div variants={staggerContainer} initial="hidden" animate="visible">
  {items.map(item => (
    <motion.div key={item.id} variants={staggerItem}>{item.name}</motion.div>
  ))}
</motion.div>

// Loading skeleton
import { CompanyCardSkeletonList } from '@/components/dashboard/CompanyCardSkeleton';
{loading ? <CompanyCardSkeletonList count={5} /> : <ActualContent />}
```

### Sprint 2 Notes
**Completed 2026-01-02**

Changes made to `src/components/dashboard/CompaniesInPainDashboard.tsx`:
- Replaced loading spinner with `CompanyCardSkeletonList` (6 skeleton cards)
- Wrapped company cards list in `motion.div` with `staggerContainer` variant
- Each card wrapped in `motion.div` with `staggerItem` variant for staggered entrance
- Added hover effect: cards lift (`y: -2`) with enhanced shadow on hover
- Progress bar already had smooth transitions (`transition-all duration-300`)

Usage example:
```tsx
// Loading state now shows skeletons
if (loading) {
  return <CompanyCardSkeletonList count={6} />;
}

// Cards animate in with stagger effect
<motion.div variants={staggerContainer} initial="hidden" animate="visible">
  {companies.map(company => (
    <motion.div
      key={company.id}
      variants={staggerItem}
      whileHover={{ y: -2, boxShadow: "0 8px 30px rgba(0,0,0,0.12)" }}
    >
      <Card>...</Card>
    </motion.div>
  ))}
</motion.div>
```

### Sprint 3 Notes
**Completed 2026-01-02**

Changes made:

**1. Agency Classification Badges** (CompaniesInPainDashboard.tsx & SignalCard.tsx):
- "Verified" (green) → "Direct Employer" (green)
- "Agency" (red) → "Recruitment Agency" (amber)
- Added new "Unclassified" (gray) badge when `is_recruitment_agency === null`

**2. Button Labels** (CompaniesInPainDashboard.tsx):
- "Classify" → "Check if Agency"
- "Classify All" → "Check All for Agencies"
- "Find Contacts" → "Find Decision Makers"
- "Enrich All" → "Find All Contacts"
- "Analyze Job" → "Analyze Hiring Need"

**3. Signal Key** (CompaniesInPainDashboard.tsx):
- Removed collapsible toggle (showSignalKey state)
- Signal Key now always visible with header bar

**4. Pain Signal Titles** (signal-explanations.ts):
- hard_to_fill_30 → "Actively Hiring 30+ Days"
- hard_to_fill_60 → "Struggling to Hire 60+ Days"
- hard_to_fill_90 → "Desperate to Hire 90+ Days"
- stale_job_30/60 → "Possibly Abandoned (30/60 days)"
- stale_job_90 → "Likely Abandoned (90 days)"
- job_reposted_* → "Re-listed Role/Twice/3+ Times..."
- salary_increase_* → "Salary Raised 10%+/20%+ (desperate)"

**5. SignalCard.tsx**:
- Updated agency badges to match new naming
- Updated "Classify Company" button → "Check if Agency"

### Sprint 4 Notes
**Completed 2026-01-02**

Files created:
- `scripts/migrate-notifications.sql` - Database migration (run in Supabase dashboard)
- `src/lib/notifications.ts` - Utility functions for CRUD operations
- `src/components/notifications/NotificationBell.tsx` - Bell icon with realtime subscription
- `src/components/notifications/NotificationPanel.tsx` - Dropdown panel with notifications
- `src/components/notifications/NotificationItem.tsx` - Single notification row

Files modified:
- `src/components/dashboard/Navbar.tsx` - Replaced static bell with NotificationBell
- `src/app/api/settings/route.ts` - Added notification_sound_enabled field
- `src/app/(dashboard)/settings/page.tsx` - Added "Notification sound" toggle

Usage:
```tsx
// Create notification (server-side or with service role)
import { createNotification } from '@/lib/notifications';
await createNotification(userId, 'new_signals', 'New signals detected', '5 new pain signals found');

// Notification types: 'new_signals', 'classification_complete', 'enrichment_complete', 'job_sync'
```

Realtime: Notifications automatically appear via Supabase realtime subscription.
Sound: Plays `/public/notification.mp3` if enabled in settings (add your own sound file).

### Sprint 5 Notes
**Completed 2026-01-02**

Changes made to `src/components/dashboard/CompaniesInPainDashboard.tsx`:

**1. Card Hover & Click Enhancement**
- Added `whileTap={{ scale: 0.98 }}` for subtle press feedback on company cards
- Kept existing hover animation (`y: -2, boxShadow`)

**2. Expand/Collapse Animation (Signals)**
- Imported `AnimatePresence` from framer-motion
- Separated first 3 signals (always visible) from remaining signals
- Wrapped expanded signals in `AnimatePresence` with height/opacity animation
- Added chevron icons to expand/collapse button

**3. Tab Underline Animation**
- Added `layoutId="activeTab"` sliding background to signal type tabs
- Uses spring animation with bounce for smooth tab switching

**4. Success State Animations**
- Added `successCompanyId` state to track recently completed actions
- Green ring pulse (`ring-2 ring-green-500 ring-opacity-50`) on card after successful:
  - Classify company
  - Find contacts
  - Resolve domain
- Auto-clears after 1.5 seconds

**5. Empty State Animation**
- Wrapped empty state content in `motion.div` with `opacity: 0, y: 10` → `opacity: 1, y: 0`

Usage examples:
```tsx
// Tab with sliding background
{activeTab === tab.id && (
  <motion.div
    layoutId="activeTab"
    className="absolute inset-0 bg-white rounded-md shadow-sm"
    transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
  />
)}

// Success animation trigger
setSuccessCompanyId(companyId);
setTimeout(() => setSuccessCompanyId(null), 1500);

// Card with success ring
<Card className={`... ${successCompanyId === company.id ? 'ring-2 ring-green-500 ring-opacity-50' : ''}`}>
```

### Sprint 6 Notes
**Completed 2026-01-02**

Migrated `ingest-jobs` and `process-scan-queue` Vercel cron jobs to Inngest.

Files created:
- `src/inngest/events.ts` - Typed event definitions for Inngest
- `src/inngest/functions/ingest-jobs.ts` - Job ingestion from Reed/Adzuna (every 4 hours)
- `src/inngest/functions/process-scan-queue.ts` - Queue processing (every 15 minutes)

Files modified:
- `src/inngest/functions/index.ts` - Added new function exports
- `vercel.json` - Removed migrated cron schedules (5 entries removed)

Key changes:
- `ingest-jobs` consolidated 4 Vercel crons into a single Inngest function with event params
- Both functions use `step.run()` for retry-able operations
- Both have cron triggers + manual event triggers for testing
- Throttling added to prevent overlapping runs

Inngest functions now in use:
1. `classify-companies-batch` - Company classification
2. `generate-pain-signals` - Pain signal generation (every 2 hours)
3. `ingest-jobs` - Job ingestion (every 4 hours)
4. `process-scan-queue` - Queue processing (every 15 minutes)

Usage:
```typescript
// Trigger job ingestion manually
await inngest.send({ name: 'jobs/ingest', data: { source: 'reed' } });

// Trigger queue processing
await inngest.send({ name: 'queue/process', data: { limit: 5 } });
```

### Sprint 7 Notes
**Completed 2026-01-02**

Migrated remaining 5 Vercel cron jobs to Inngest functions.

Files created:
- `src/inngest/functions/sync-government-data.ts` - Contracts Finder + Find a Tender sync (5am daily)
- `src/inngest/functions/generate-ch-signals.ts` - Companies House signals (5:30am daily)
- `src/inngest/functions/generate-contract-signals.ts` - Contract award signals (6am daily)
- `src/inngest/functions/rescan-icp-jobs.ts` - Rescan ICP jobs (6am, 12pm, 6pm)
- `src/inngest/functions/schedule-daily-jobs.ts` - Queue daily sync (6am daily)

Files modified:
- `src/inngest/events.ts` - Added 5 new event types
- `src/inngest/functions/index.ts` - Added 5 new function exports
- `vercel.json` - Removed all cron schedules (now empty array)

Inngest functions now in use (9 total):
1. `classify-companies-batch` - Company classification
2. `generate-pain-signals` - Pain signal generation (every 2 hours)
3. `ingest-jobs` - Job ingestion (every 4 hours)
4. `process-scan-queue` - Queue processing (every 15 minutes)
5. `sync-government-data` - Government data sync (5am daily)
6. `generate-ch-signals` - Companies House signals (5:30am daily)
7. `generate-contract-signals` - Contract signals (6am daily)
8. `rescan-icp-jobs` - Rescan ICP jobs (6am, 12pm, 6pm)
9. `schedule-daily-jobs` - Queue daily sync (6am daily)

Usage:
```typescript
// Trigger government sync
await inngest.send({ name: 'government/sync', data: {} });

// Trigger CH signals for specific ICP
await inngest.send({ name: 'signals/companies-house', data: { icpId: 'xxx' } });

// Trigger contract signals with 30-day lookback
await inngest.send({ name: 'signals/contracts', data: { lookbackDays: 30 } });

// Trigger ICP rescan
await inngest.send({ name: 'icp/rescan-jobs', data: {} });

// Trigger daily job scheduling
await inngest.send({ name: 'jobs/schedule-daily', data: {} });
```

### Sprint 8 Notes
**Completed 2026-01-02**

Files created:
- `scripts/migrate-system-activity.sql` - Database migration for activity feed
- `src/lib/activity-logger.ts` - Utility for logging activities from Inngest functions
- `src/components/dashboard/StatsCard.tsx` - Animated stat card with count-up and sparkline
- `src/components/dashboard/ActivityFeed.tsx` - Real-time activity feed with Supabase subscription
- `src/components/dashboard/QuickActions.tsx` - Action buttons with counts

Files modified:
- `src/app/(dashboard)/dashboard/page.tsx` - New layout with StatsCards, QuickActions, ActivityFeed
- `src/inngest/functions/ingest-jobs.ts` - Added activity logging
- `src/inngest/functions/generate-pain-signals.ts` - Added activity logging
- `src/inngest/functions/classify-companies.ts` - Added activity logging
- `src/inngest/functions/sync-government-data.ts` - Added activity logging

**IMPORTANT**: Run the SQL migration in Supabase Dashboard:
1. Go to https://supabase.com/dashboard → your project → SQL Editor
2. Paste contents of `scripts/migrate-system-activity.sql`
3. Click Run

Usage examples:
```tsx
// StatsCard with count-up animation
<StatsCard
  title="Total Signals"
  value={1234}
  icon={<TrendingUp className="h-5 w-5" />}
  iconBgColor="bg-purple-100"
  iconColor="text-purple-600"
  trend={{ value: 12, isUp: true }}
/>

// Activity Feed - just drop it in
<ActivityFeed />

// Quick Actions - auto-fetches counts
<QuickActions />

// Log activity from Inngest function
import { activityLogger } from '@/lib/activity-logger';
await activityLogger.jobsSynced(150, 'Reed');
await activityLogger.signalsDetected(45);
```
