# Signal Mentis - Business Analysis & Improvement Plan

**Document Version:** 1.0
**Date:** December 2024
**Prepared by:** Business Analysis

---

## Executive Summary

Signal Mentis is a B2B lead intelligence platform that detects business signals (hiring, contracts, funding, leadership changes, etc.) and enriches them with decision-maker contact information. The platform targets recruitment agencies, sales teams, and business development professionals in the UK market.

**Current State**: Functional MVP with solid core features but missing subscription management, usage limits, and team collaboration features needed for paid tiers.

**Path to 1k/month value**: Requires adding exclusive data sources, automated outreach sequences, team collaboration, and guaranteed ROI through signal-to-deal tracking.

---

## Table of Contents

1. [Target Users & Value Proposition](#1-target-users--value-proposition)
2. [Current Feature Analysis](#2-current-feature-analysis)
3. [User Flow Analysis](#3-user-flow-analysis)
4. [Feature Gap Analysis](#4-feature-gap-analysis)
5. [Pricing Tier Recommendation](#5-pricing-tier-recommendation)
6. [Technical Implementation Plan](#6-technical-implementation-plan)
7. [Free Demo User Setup](#7-free-demo-user-trisden-mills)
8. [API Connector Requirements](#8-api-connector-requirements)
9. [Competitive Analysis](#9-competitive-analysis)
10. [Success Metrics](#10-success-metrics)
11. [Implementation Roadmap](#11-implementation-roadmap)
12. [Risk Assessment](#12-risk-assessment)
13. [Conclusion](#13-conclusion)

---

## 1. Target Users & Value Proposition

### Primary Users

| Segment | Use Case | Willingness to Pay |
|---------|----------|-------------------|
| **Recruitment Agencies** | Find companies actively hiring before competitors | 500-2000/month |
| **B2B Sales Teams** | Find companies with buying signals (funding, expansion) | 200-1000/month |
| **Commercial Property Agents** | Find companies with planning approvals, expansions | 300-800/month |
| **Construction Suppliers** | Find contract awards, project announcements | 200-500/month |
| **Healthcare Suppliers** | Find CQC rating changes, NHS contracts | 300-700/month |

### Value Proposition by Tier

| Tier | Price | Value Delivered |
|------|-------|-----------------|
| **Free (Demo)** | 0 | 10 signals/month, no enrichment, manual export |
| **Pro** | 199/month | 500 signals, 100 enrichments, HubSpot, email alerts |
| **Business** | 499/month | 2000 signals, 500 enrichments, team (3 seats), API access |
| **Enterprise** | 999+/month | Unlimited signals, custom integrations, dedicated support, SLA |

---

## 2. Current Feature Analysis

### What Works Well

| Feature | Status | User Value |
|---------|--------|------------|
| **Dashboard Overview** | Complete | Quick signal count, recent activity |
| **Signal Detection** | Complete | 14 signal types across industries |
| **AI Search** | Complete | Custom search profiles with streaming results |
| **Agency Finder** | Complete | Targeted search for recruitment agencies |
| **Contact Enrichment** | Complete | LeadMagic + Prospeo integration |
| **HubSpot Push** | Complete | One-click CRM sync |
| **CSV Export** | Complete | Download signals with contacts |
| **Job Board Integration** | Complete | Reed API + Indeed scraping |
| **Government Data** | Complete | Contracts, planning, Companies House |
| **Email Digests** | Complete | Daily/weekly/monthly notifications |

### What's Missing or Broken

| Feature | Status | Impact |
|---------|--------|--------|
| **Subscription Management** | Missing | Can't charge users |
| **Usage Limits** | Missing | Can't differentiate tiers |
| **Team Collaboration** | Missing | No shared signals/profiles |
| **Activity Tracking** | Missing | No "who contacted whom" |
| **Signal Deduplication UI** | Missing | Users may see duplicates |
| **Bulk Enrichment Progress** | Partial | No progress indicator |
| **Search in Navbar** | Broken | Icon exists, no function |
| **Help Button** | Broken | Icon exists, no function |
| **Notifications Bell** | Broken | Icon exists, no function |
| **Delete Profile** | Untested | Button exists, may not work |

---

## 3. User Flow Analysis

### Current User Journey (Problems Identified)

```
1. SIGNUP -> No onboarding, drops into empty dashboard
   PROBLEM: User doesn't know what to do first

2. ADD SOURCE -> Form to add URL to scrape
   PROBLEM: What URL? No guidance or templates

3. CREATE SEARCH -> 8-step wizard with many fields
   PROBLEM: Overwhelming, no presets

4. RUN SEARCH -> Live streaming results
   GOOD: Real-time feedback

5. VIEW SIGNALS -> Filter and browse
   PROBLEM: No way to mark "contacted" or "not interested"

6. ENRICH -> Click button, wait
   PROBLEM: No progress, expensive if over-clicked

7. EXPORT -> Download CSV
   PROBLEM: No tracking of what was exported
```

### Recommended User Journey

```
1. SIGNUP -> Onboarding wizard
   - What industry are you in?
   - What signals matter to you?
   - Auto-create first search profile

2. DASHBOARD -> Guided first experience
   - "You have 0 signals. Run your first search!"
   - Sample data to show what signals look like

3. SEARCH -> One-click presets
   - "Healthcare Hiring in London" template
   - "Construction Contracts in North West" template

4. SIGNALS -> Action workflow
   - Mark as: Contacted / Not Interested / Saved
   - Notes field per signal
   - Activity history

5. ENRICH -> Smart enrichment
   - Show credits remaining
   - Confirm before batch enrich
   - Progress bar with ETA

6. OUTREACH -> Track follow-up
   - Log emails sent
   - Track responses
   - Calculate ROI
```

---

## 4. Feature Gap Analysis

### Must-Have Features (Blocking Revenue)

| Feature | Effort | Revenue Impact |
|---------|--------|----------------|
| **Stripe Subscription** | 2 days | Enables any revenue |
| **Usage Tracking** | 1 day | Enables tier limits |
| **Onboarding Wizard** | 2 days | Reduces churn 50%+ |
| **Signal Actions** | 2 days | Enables workflow tracking |
| **Enrichment Credits** | 1 day | Controls costs |

### High-Value Features (Justify Premium)

| Feature | Effort | Value Add |
|---------|--------|-----------|
| **Team Collaboration** | 3 days | 200+/month per seat |
| **Automated Sequences** | 5 days | "Set and forget" value |
| **Slack Integration** | 2 days | Real-time alerts |
| **Signal Scoring** | 2 days | Prioritize hot leads |
| **Competitor Alerts** | 3 days | "Know when X gets funding" |
| **Custom Webhooks** | 1 day | API access for Enterprise |

### Nice-to-Have Features

| Feature | Effort | Value Add |
|---------|--------|-----------|
| **Chrome Extension** | 5 days | LinkedIn enrichment |
| **Mobile App** | 10+ days | On-the-go alerts |
| **AI Email Writer** | 3 days | Draft outreach from signal |
| **ROI Calculator** | 1 day | Show value delivered |

---

## 5. Pricing Tier Recommendation

### Tier Structure

```
+---------------------------------------------------------------------+
|                         SIGNAL MENTIS PRICING                       |
+--------------+--------------+--------------+-----------------------+
|    FREE      |     PRO      |   BUSINESS   |      ENTERPRISE       |
|   (Demo)     |  199/month   |  499/month   |     999+/month        |
+--------------+--------------+--------------+-----------------------+
| 10 signals   | 500 signals  | 2000 signals | Unlimited signals     |
| 0 enrichments| 100 enriches | 500 enriches | Unlimited enriches    |
| 1 search     | 10 searches  | 50 searches  | Unlimited searches    |
| No export    | CSV export   | CSV + API    | Full API access       |
| No alerts    | Daily digest | Real-time    | Custom webhooks       |
| -            | 1 seat       | 3 seats      | Unlimited seats       |
| -            | -            | HubSpot      | Custom integrations   |
| -            | -            | -            | Dedicated support     |
| -            | -            | -            | SLA guarantee         |
+--------------+--------------+--------------+-----------------------+
```

### Cost Analysis per Tier

| Tier | Revenue | API Costs | Gross Margin |
|------|---------|-----------|--------------|
| Free | 0 | ~2 (limited) | -100% |
| Pro | 199 | ~30-50 | 75-85% |
| Business | 499 | ~80-150 | 70-85% |
| Enterprise | 999+ | ~150-300 | 70-85% |

### API Cost Breakdown (per user/month)

| API | Free | Pro | Business | Enterprise |
|-----|------|-----|----------|------------|
| Firecrawl | 1 | 15-30 | 40-80 | 60-150 |
| LeadMagic | 0 | 10-20 | 30-60 | 50-100 |
| Prospeo | 0 | 5-10 | 15-30 | 25-50 |
| Supabase | 0.50 | 2 | 5 | 10 |
| Resend | 0 | 1 | 2 | 5 |
| **Total** | ~2 | ~35-65 | ~95-180 | ~150-320 |

---

## 6. Technical Implementation Plan

### Phase 1: Monetization Foundation (Week 1-2)

#### 6.1 Database Schema Updates

```sql
-- New table: subscriptions
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan_type TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- New table: usage_metrics
CREATE TABLE usage_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  period_start DATE NOT NULL,
  signals_detected INTEGER DEFAULT 0,
  signals_limit INTEGER DEFAULT 10,
  enrichments_used INTEGER DEFAULT 0,
  enrichments_limit INTEGER DEFAULT 0,
  searches_run INTEGER DEFAULT 0,
  searches_limit INTEGER DEFAULT 1,
  exports_generated INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, period_start)
);

-- New table: plan_limits
CREATE TABLE plan_limits (
  plan_type TEXT PRIMARY KEY,
  signals_per_month INTEGER,
  enrichments_per_month INTEGER,
  searches_per_month INTEGER,
  team_seats INTEGER,
  has_api_access BOOLEAN,
  has_hubspot BOOLEAN,
  has_slack BOOLEAN
);

INSERT INTO plan_limits VALUES
  ('free', 10, 0, 1, 1, FALSE, FALSE, FALSE),
  ('pro', 500, 100, 10, 1, FALSE, FALSE, TRUE),
  ('business', 2000, 500, 50, 3, TRUE, TRUE, TRUE),
  ('enterprise', -1, -1, -1, -1, TRUE, TRUE, TRUE);
```

#### 6.2 Stripe Integration

**Files to create:**
- `src/lib/stripe.ts` - Stripe client and helpers
- `src/app/api/stripe/webhook/route.ts` - Handle subscription events
- `src/app/api/stripe/create-checkout/route.ts` - Create checkout session
- `src/app/api/stripe/create-portal/route.ts` - Customer portal
- `src/app/(dashboard)/pricing/page.tsx` - Pricing page
- `src/app/(dashboard)/billing/page.tsx` - Billing management

**Environment variables needed:**
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_BUSINESS_PRICE_ID=price_...
STRIPE_ENTERPRISE_PRICE_ID=price_...
```

#### 6.3 Usage Enforcement

```typescript
// src/middleware.ts - Check limits before API calls
export function checkUsageLimit(
  userId: string,
  limitType: 'signals' | 'enrichments' | 'searches'
) {
  const usage = await getUsageMetrics(userId);
  const limits = await getPlanLimits(userId);

  if (limits[limitType] !== -1 && usage[limitType] >= limits[limitType]) {
    throw new Error(`${limitType} limit reached. Upgrade your plan.`);
  }
}
```

### Phase 2: User Experience (Week 2-3)

#### 6.4 Onboarding Wizard

**New component:** `src/components/onboarding/OnboardingWizard.tsx`

Steps:
1. Welcome + Industry selection
2. Signal types that matter
3. Target locations
4. Auto-create first search profile
5. Show sample signals
6. Invite to run first search

#### 6.5 Signal Actions

**Database addition:**
```sql
-- New table: signal_actions
CREATE TABLE signal_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id UUID REFERENCES signals NOT NULL,
  user_id UUID REFERENCES auth.users NOT NULL,
  action_type TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add status to signals
ALTER TABLE signals ADD COLUMN status TEXT DEFAULT 'new';
```

**UI changes:**
- Add action buttons to SignalCard: "Mark Contacted", "Not Interested", "Save"
- Add notes field that opens on click
- Add status filter to signals page
- Show action history on signal detail

#### 6.6 Enrichment Credits UI

**Changes to EnrichButton:**
- Show "X credits remaining" before enriching
- Confirmation modal for batch enrich
- Progress bar during enrichment
- Error state if out of credits

### Phase 3: Team Features (Week 3-4)

#### 6.7 Organizations

```sql
-- New table: organizations
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID REFERENCES auth.users NOT NULL,
  subscription_id UUID REFERENCES subscriptions,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- New table: organization_members
CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations NOT NULL,
  user_id UUID REFERENCES auth.users NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  joined_at TIMESTAMPTZ,
  UNIQUE(organization_id, user_id)
);

-- Add organization to shared resources
ALTER TABLE signals ADD COLUMN organization_id UUID REFERENCES organizations;
ALTER TABLE search_profiles ADD COLUMN organization_id UUID REFERENCES organizations;
ALTER TABLE sources ADD COLUMN organization_id UUID REFERENCES organizations;
```

#### 6.8 Team UI

**New pages:**
- `/settings/team` - Manage team members
- `/settings/team/invite` - Invite new member

**Features:**
- Invite by email
- Role assignment
- Remove member
- Transfer ownership

### Phase 4: Advanced Features (Week 4-5)

#### 6.9 Signal Scoring

```sql
ALTER TABLE signals ADD COLUMN score INTEGER DEFAULT 50;
ALTER TABLE signals ADD COLUMN score_factors JSONB;
```

**Scoring factors:**
- Signal type weight (contract_awarded = 90, new_job = 60)
- Company size (inferred from domain)
- Recency (newer = higher)
- Industry match to user profile
- Contact availability

#### 6.10 Competitor Monitoring

```sql
CREATE TABLE watched_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  company_name TEXT NOT NULL,
  company_domain TEXT,
  notify_on_signals BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Features:**
- Add company to watchlist
- Alert when any signal matches
- Daily digest of watched company activity

#### 6.11 Slack Integration

**New files:**
- `src/lib/integrations/slack.ts`
- `src/app/api/integrations/slack/route.ts`
- `src/app/api/integrations/slack/callback/route.ts`

**Features:**
- OAuth flow (like HubSpot)
- Channel selection
- Real-time signal alerts
- Daily digest to channel

---

## 7. Free Demo User (Trisden Mills)

### Implementation

```sql
-- Flag demo user
ALTER TABLE user_settings ADD COLUMN is_demo_user BOOLEAN DEFAULT FALSE;

-- Set for trisden's account
UPDATE user_settings
SET is_demo_user = TRUE
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'trisden@...');
```

### Demo User Rules

| Feature | Demo User | Free Tier |
|---------|-----------|-----------|
| Signals visible | All (read-only samples) | 10/month |
| Enrichments | 0 | 0 |
| Searches | View samples | 1/month |
| Export | No | No |
| Time limit | Unlimited | Unlimited |

### Demo Experience

1. Pre-populated with 50 sample signals
2. Search profiles are templates (can't be modified)
3. "Upgrade to unlock" CTAs everywhere
4. Banner: "You're viewing the demo. Sign up for your own account."

---

## 8. API Connector Requirements

### Current APIs (Sufficient)

| API | Purpose | Status |
|-----|---------|--------|
| Firecrawl | Web scraping | Working |
| LeadMagic | Contact by role | Working |
| Prospeo | Email/phone | Working |
| Reed | UK jobs | Working |
| HubSpot | CRM | Working |
| Companies House | UK companies | Working |
| Contracts Finder | UK contracts | Working |
| Resend | Email | Working |

### APIs to Add (For Premium Value)

| API | Purpose | Tier | Effort |
|-----|---------|------|--------|
| **Slack** | Real-time alerts | Business+ | 2 days |
| **LinkedIn Sales Nav** | Enhanced enrichment | Enterprise | 5 days |
| **Crunchbase** | Funding data | Business+ | 2 days |
| **Clearbit** | Company enrichment | Business+ | 1 day |
| **Apollo.io** | Contact database | Enterprise | 2 days |
| **ZoomInfo** | Premium contacts | Enterprise | 3 days |

### API Cost Optimization Strategies

1. **Cache Firecrawl results** - Same URL within 24h = cached
2. **Batch LeadMagic calls** - Single API call for multiple roles
3. **Rate limit per user** - Prevent runaway costs
4. **Queue expensive operations** - Process overnight for free tier

---

## 9. Competitive Analysis

### Direct Competitors

| Competitor | Price | Signals | Enrichment | Weakness |
|------------|-------|---------|------------|----------|
| **Bombora** | 3000+/month | Intent data | No | Too expensive |
| **ZoomInfo** | 1500+/month | Company data | Yes | Generic signals |
| **Leadfeeder** | 99-999/month | Website visitors | Partial | Only web traffic |
| **Clay** | 149-800/month | Enrichment | Yes | No signal detection |

### Signal Mentis Advantages

1. **UK Government Data** - Contracts, planning, Companies House (free, exclusive)
2. **Multi-source signals** - Jobs + contracts + funding + leadership
3. **Recruitment focus** - Agency Finder is unique
4. **All-in-one** - Detection + enrichment + CRM in one tool
5. **Price** - 50-80% cheaper than enterprise alternatives

### Positioning Statement

> "Signal Mentis is the only tool that combines UK government data with AI-powered signal detection and contact enrichment. Find companies actively hiring, winning contracts, or expanding - then get the decision-maker's email in one click."

---

## 10. Success Metrics

### North Star Metric
**Signals Actioned** = Signals marked as "Contacted" or pushed to CRM

### KPIs by Tier

| Metric | Free | Pro | Business | Enterprise |
|--------|------|-----|----------|------------|
| MAU | Track | Track | Track | Track |
| Signals/user | 5 | 200 | 800 | 2000+ |
| Enrichments/user | 0 | 50 | 250 | 500+ |
| Action rate | 10% | 30% | 40% | 50%+ |
| Churn | N/A | <5% | <3% | <2% |
| NPS | N/A | >40 | >50 | >60 |

### Revenue Targets

| Month | Free Users | Pro | Business | Enterprise | MRR |
|-------|------------|-----|----------|------------|-----|
| M1 | 50 | 5 | 1 | 0 | 1,494 |
| M3 | 200 | 20 | 5 | 1 | 6,974 |
| M6 | 500 | 50 | 15 | 3 | 20,432 |
| M12 | 1000 | 100 | 40 | 10 | 49,800 |

---

## 11. Implementation Roadmap

### Week 1: Monetization Foundation
- [ ] Create subscription database tables
- [ ] Integrate Stripe checkout
- [ ] Implement usage tracking
- [ ] Add plan limits middleware
- [ ] Create pricing page

### Week 2: User Experience
- [ ] Build onboarding wizard
- [ ] Add signal actions (contacted/not interested)
- [ ] Implement enrichment credits UI
- [ ] Fix broken navbar buttons
- [ ] Add progress indicators

### Week 3: Team Features
- [ ] Create organizations table
- [ ] Build team management UI
- [ ] Implement shared signals
- [ ] Add role-based permissions
- [ ] Team billing

### Week 4: Advanced Features
- [ ] Signal scoring algorithm
- [ ] Competitor monitoring
- [ ] Slack integration
- [ ] Activity tracking
- [ ] ROI dashboard

### Week 5: Launch Prep
- [ ] Demo user setup
- [ ] Marketing landing page updates
- [ ] Documentation
- [ ] Support email setup
- [ ] Launch to waiting list

---

## 12. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| API costs exceed revenue | Medium | High | Usage limits, caching, cost monitoring |
| Low conversion free to paid | High | High | Better onboarding, clear value demo |
| Competitor copies features | Medium | Medium | Move fast, build brand |
| Government API changes | Low | High | Abstract data sources, fallbacks |
| Data accuracy issues | Medium | Medium | Verification layer, user feedback |
| GDPR compliance | Medium | High | Data retention policies, consent flows |

---

## 13. Conclusion

Signal Mentis has a **solid technical foundation** with unique access to UK government data and a complete signal-to-contact pipeline. To justify 1k/month pricing:

### Immediate Priorities (Must-Have for Launch)
1. **Stripe subscription** - Enable revenue
2. **Usage limits** - Differentiate tiers
3. **Onboarding** - Reduce churn
4. **Signal actions** - Enable workflow

### Value Differentiators (Justify Premium)
1. **UK Government data** - Unique, free, exclusive
2. **Agency Finder** - Purpose-built for recruiters
3. **All-in-one** - No tool-switching
4. **Team collaboration** - Share signals

### Path to 10k MRR
- 20 Pro users x 199 = 3,980
- 8 Business users x 499 = 3,992
- 2 Enterprise users x 999 = 1,998
- **Total: 9,970 MRR** (achievable in 3-6 months)

---

## Files to Create/Modify

| File | Action | Priority |
|------|--------|----------|
| `src/lib/stripe.ts` | CREATE | P0 |
| `src/app/api/stripe/webhook/route.ts` | CREATE | P0 |
| `src/app/(dashboard)/pricing/page.tsx` | CREATE | P0 |
| `src/app/(dashboard)/billing/page.tsx` | CREATE | P0 |
| `src/components/onboarding/OnboardingWizard.tsx` | CREATE | P1 |
| `src/lib/usage.ts` | CREATE | P0 |
| `src/lib/integrations/slack.ts` | CREATE | P2 |
| `src/components/dashboard/SignalCard.tsx` | MODIFY | P1 |
| `src/app/(dashboard)/settings/team/page.tsx` | CREATE | P2 |
| Database migrations | CREATE | P0 |

---

**End of Document**
