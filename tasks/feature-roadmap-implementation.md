# Signal-Mentis Feature Roadmap - Implementation Plan

> **Current Score**: 9.5/10 (Production Ready)
> **Target Score**: 10/10 (Premium Product)
> **Goal**: Add features that justify £200-500/month pricing

---

## Executive Summary

This document outlines the implementation plan for adding premium features to Signal-Mentis. Each feature includes required API keys, database changes, and step-by-step implementation instructions.

---

## Phase 1: Enhanced Job Board Coverage (Week 1-2)

### 1.1 Indeed Job Scraping via Apify

**Value**: Access to 250M+ job listings globally

**Required Services**:
- [ ] Apify Account: https://apify.com/signup
- [ ] Indeed Scraper Actor: https://apify.com/misceres/indeed-scraper

**Environment Variables Needed**:
```env
APIFY_API_TOKEN=<your-apify-token>
```

**Database Changes**:
```sql
-- No changes needed - uses existing job_postings table
-- Add source tracking
ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS job_board VARCHAR(50) DEFAULT 'adzuna';
```

**Implementation Steps**:
1. Create `src/lib/job-boards/indeed.ts`
2. Add Indeed ingestion API route `src/app/api/cron/ingest-indeed/route.ts`
3. Add to Vercel cron schedule

**Code Template**:
```typescript
// src/lib/job-boards/indeed.ts
import { ApifyClient } from 'apify-client';

const client = new ApifyClient({ token: process.env.APIFY_API_TOKEN });

export async function scrapeIndeedJobs(keywords: string[], location: string) {
  const run = await client.actor('misceres/indeed-scraper').call({
    position: keywords.join(' OR '),
    location,
    maxItems: 100,
    parseCompanyDetails: true,
  });

  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  return items;
}
```

**Estimated Cost**: ~$49/month for 10,000 results

---

### 1.2 Adzuna API (Already Implemented - Enhance)

**Current Status**: ✅ Working

**Enhancement**:
- Add more countries (currently UK only)
- Add salary data extraction for signals

**Environment Variables** (Already have):
```env
ADZUNA_APP_ID=<your-app-id>
ADZUNA_API_KEY=<your-api-key>
```

---

### 1.3 LinkedIn Job Scraping via Apify

**Value**: Premium job data from LinkedIn

**Required Services**:
- [ ] Apify Account (same as above)
- [ ] LinkedIn Jobs Scraper: https://apify.com/bebity/linkedin-jobs-scraper

**Implementation**:
```typescript
// src/lib/job-boards/linkedin.ts
export async function scrapeLinkedInJobs(keywords: string[], location: string) {
  const run = await client.actor('bebity/linkedin-jobs-scraper').call({
    searchQueries: keywords.map(k => `${k} ${location}`),
    maxResults: 100,
  });

  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  return items;
}
```

**Estimated Cost**: ~$29/month for 5,000 results

---

### 1.4 Glassdoor Job Scraping

**Required Services**:
- [ ] Apify Glassdoor Scraper: https://apify.com/bebity/glassdoor-scraper

**Implementation**: Same pattern as LinkedIn

**Estimated Cost**: ~$29/month for 5,000 results

---

## Phase 2: Real-Time Alerts (Week 2-3)

### 2.1 Slack Integration

**Value**: Instant notifications when pain signals are detected

**Required Setup**:
- [ ] Slack App: https://api.slack.com/apps
- [ ] Bot Token with `chat:write` scope
- [ ] Incoming Webhook URL

**Environment Variables**:
```env
SLACK_BOT_TOKEN=xoxb-<your-bot-token>
SLACK_SIGNING_SECRET=<your-signing-secret>
```

**Database Changes**:
```sql
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS slack_webhook_url TEXT;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS slack_channel_id VARCHAR(20);
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS notify_slack BOOLEAN DEFAULT false;
```

**Implementation Steps**:
1. Create `src/lib/notifications/slack.ts`
2. Add Slack settings to Settings page
3. Trigger notifications in signal detection flow

**Code Template**:
```typescript
// src/lib/notifications/slack.ts
import { WebClient } from '@slack/web-api';

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

export async function sendSlackSignalAlert(signal: PainSignal, channel: string) {
  await slack.chat.postMessage({
    channel,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🔥 *New Pain Signal Detected*\n*Company:* ${signal.company_name}\n*Signal:* ${signal.signal_title}\n*Score:* ${signal.pain_score}/10`,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View Signal' },
            url: `https://signal-mentis.vercel.app/pain?signal=${signal.id}`,
          },
        ],
      },
    ],
  });
}
```

**Package to Install**:
```bash
npm install @slack/web-api
```

**Estimated Cost**: Free (Slack API is free)

---

### 2.2 Microsoft Teams Integration

**Required Setup**:
- [ ] Azure App Registration: https://portal.azure.com
- [ ] Teams Incoming Webhook

**Environment Variables**:
```env
TEAMS_WEBHOOK_URL=<your-webhook-url>
```

**Database Changes**:
```sql
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS teams_webhook_url TEXT;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS notify_teams BOOLEAN DEFAULT false;
```

**Implementation**:
```typescript
// src/lib/notifications/teams.ts
export async function sendTeamsSignalAlert(signal: PainSignal, webhookUrl: string) {
  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      '@type': 'MessageCard',
      summary: `New Pain Signal: ${signal.company_name}`,
      sections: [{
        activityTitle: `🔥 ${signal.signal_title}`,
        facts: [
          { name: 'Company', value: signal.company_name },
          { name: 'Pain Score', value: `${signal.pain_score}/10` },
        ],
      }],
      potentialAction: [{
        '@type': 'OpenUri',
        name: 'View Signal',
        targets: [{ os: 'default', uri: `https://signal-mentis.vercel.app/pain?signal=${signal.id}` }],
      }],
    }),
  });
}
```

**Estimated Cost**: Free

---

## Phase 3: CRM Integrations (Week 3-4)

### 3.1 Salesforce Integration

**Value**: Enterprise CRM sync for large teams

**Required Setup**:
- [ ] Salesforce Developer Account: https://developer.salesforce.com/signup
- [ ] Connected App with OAuth 2.0
- [ ] API access enabled

**Environment Variables**:
```env
SALESFORCE_CLIENT_ID=<your-client-id>
SALESFORCE_CLIENT_SECRET=<your-client-secret>
SALESFORCE_REDIRECT_URI=https://signal-mentis.vercel.app/api/integrations/salesforce/callback
```

**Database Changes**:
```sql
CREATE TABLE IF NOT EXISTS salesforce_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  instance_url TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sf_connections_user ON salesforce_connections(user_id);
```

**Implementation Steps**:
1. Create OAuth flow routes:
   - `src/app/api/integrations/salesforce/auth/route.ts`
   - `src/app/api/integrations/salesforce/callback/route.ts`
2. Create push route: `src/app/api/integrations/salesforce/push/route.ts`
3. Add Salesforce section to Settings page
4. Create `src/lib/integrations/salesforce.ts`

**Code Template**:
```typescript
// src/lib/integrations/salesforce.ts
import jsforce from 'jsforce';

export async function pushToSalesforce(connection: SalesforceConnection, signal: PainSignal) {
  const conn = new jsforce.Connection({
    instanceUrl: connection.instance_url,
    accessToken: connection.access_token,
  });

  // Check if account exists
  const accounts = await conn.query(
    `SELECT Id FROM Account WHERE Website LIKE '%${signal.company_domain}%' LIMIT 1`
  );

  let accountId = accounts.records[0]?.Id;

  if (!accountId) {
    // Create new account
    const result = await conn.sobject('Account').create({
      Name: signal.company_name,
      Website: signal.company_domain,
      Industry: signal.industry,
    });
    accountId = result.id;
  }

  // Create task/activity
  await conn.sobject('Task').create({
    Subject: `Pain Signal: ${signal.signal_title}`,
    Description: signal.signal_detail,
    WhatId: accountId,
    Priority: signal.pain_score >= 8 ? 'High' : 'Normal',
  });

  return { accountId };
}
```

**Package to Install**:
```bash
npm install jsforce
```

**Estimated Cost**: Free (API included with Salesforce license)

---

### 3.2 HubSpot Enhancement (Already Implemented)

**Current Status**: ✅ Working

**Enhancement**:
- Add deal creation option
- Add custom property mapping
- Add bi-directional sync

---

## Phase 4: Advanced Signal Sources (Week 4-5)

### 4.1 Funding Round Detection (Crunchbase/PitchBook)

**Value**: Identify companies with fresh capital to spend

**Required Services**:
- [ ] Crunchbase Basic API: https://www.crunchbase.com/pricing (or)
- [ ] RapidAPI Crunchbase Alternative: https://rapidapi.com/search/crunchbase

**Environment Variables**:
```env
CRUNCHBASE_API_KEY=<your-api-key>
# OR
RAPIDAPI_KEY=<your-rapidapi-key>
```

**Database Changes**:
```sql
CREATE TABLE IF NOT EXISTS funding_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  round_type VARCHAR(50), -- seed, series_a, series_b, etc.
  amount_usd BIGINT,
  announced_date DATE,
  investors JSONB,
  source_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_funding_company ON funding_rounds(company_id);
CREATE INDEX idx_funding_date ON funding_rounds(announced_date);
```

**Implementation**:
```typescript
// src/lib/signals/funding.ts
export async function detectFundingSignals(company: Company) {
  const response = await fetch(
    `https://api.crunchbase.com/v4/entities/organizations/${company.name}`,
    {
      headers: { 'X-cb-user-key': process.env.CRUNCHBASE_API_KEY! },
    }
  );

  const data = await response.json();
  const recentFunding = data.cards.funding_rounds.filter(
    (r: any) => new Date(r.announced_on) > new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  );

  return recentFunding.map((round: any) => ({
    pain_signal_type: 'funding_round',
    signal_title: `${round.funding_type} Funding: ${formatCurrency(round.money_raised.value_usd)}`,
    signal_detail: `${company.name} raised ${formatCurrency(round.money_raised.value_usd)} in ${round.funding_type}`,
    pain_score: calculateFundingPainScore(round),
    metadata: { round },
  }));
}
```

**Estimated Cost**: $99-299/month for Crunchbase Basic

---

### 4.2 Tech Stack Detection (BuiltWith/Wappalyzer)

**Value**: Identify companies using competitor tech or outdated systems

**Required Services**:
- [ ] BuiltWith API: https://builtwith.com/api (or)
- [ ] Wappalyzer via Apify: https://apify.com/nicksph/wappalyzer

**Environment Variables**:
```env
BUILTWITH_API_KEY=<your-api-key>
# OR use Apify for Wappalyzer
```

**Database Changes**:
```sql
ALTER TABLE companies ADD COLUMN IF NOT EXISTS tech_stack JSONB;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS tech_stack_updated_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS tech_stack_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  tech_category VARCHAR(100), -- cms, crm, analytics, etc.
  tech_name VARCHAR(100),
  is_outdated BOOLEAN DEFAULT false,
  detected_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Implementation**:
```typescript
// src/lib/signals/tech-stack.ts
export async function detectTechStack(domain: string) {
  const response = await fetch(
    `https://api.builtwith.com/v21/api.json?KEY=${process.env.BUILTWITH_API_KEY}&LOOKUP=${domain}`
  );

  const data = await response.json();
  return data.Results[0]?.Result?.Paths?.map((path: any) => ({
    technologies: path.Technologies.map((t: any) => ({
      name: t.Name,
      category: t.Categories?.[0],
      firstDetected: t.FirstDetected,
      lastDetected: t.LastDetected,
    })),
  }));
}
```

**Estimated Cost**: $295/month for BuiltWith Pro OR ~$10/month via Apify

---

### 4.3 Website Visitor Identification (Clearbit/Leadfeeder)

**Value**: Know who's visiting your website

**Required Services**:
- [ ] Clearbit Reveal: https://clearbit.com/reveal (or)
- [ ] Leadfeeder: https://www.leadfeeder.com/

**Note**: This requires user to install tracking script on their website.

**Environment Variables**:
```env
CLEARBIT_API_KEY=<your-api-key>
```

**Database Changes**:
```sql
CREATE TABLE IF NOT EXISTS website_visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id),
  ip_address INET,
  company_name VARCHAR(255),
  company_domain VARCHAR(255),
  page_url TEXT,
  visited_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_visitors_user ON website_visitors(user_id);
CREATE INDEX idx_visitors_date ON website_visitors(visited_at);
```

**Implementation**:
1. Create tracking pixel endpoint
2. Create Clearbit lookup on visitor
3. Create pain signal from visitor intent

**Estimated Cost**: $99-499/month depending on traffic

---

## Phase 5: Outreach Automation (Week 5-6)

### 5.1 Email Sequence Integration (Instantly/Apollo)

**Value**: Auto-trigger outreach when signals detected

**Required Services**:
- [ ] Instantly.ai API: https://instantly.ai/ (or)
- [ ] Apollo.io API: https://www.apollo.io/

**Environment Variables**:
```env
INSTANTLY_API_KEY=<your-api-key>
INSTANTLY_CAMPAIGN_ID=<default-campaign-id>
# OR
APOLLO_API_KEY=<your-api-key>
```

**Database Changes**:
```sql
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS instantly_api_key TEXT;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS instantly_campaign_id VARCHAR(100);
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS auto_enroll_signals BOOLEAN DEFAULT false;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS auto_enroll_min_score INTEGER DEFAULT 7;

CREATE TABLE IF NOT EXISTS outreach_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id UUID REFERENCES company_pain_signals(id),
  contact_id UUID REFERENCES company_contacts(id),
  platform VARCHAR(50), -- instantly, apollo
  campaign_id VARCHAR(100),
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'enrolled'
);
```

**Implementation**:
```typescript
// src/lib/outreach/instantly.ts
export async function enrollInCampaign(
  apiKey: string,
  campaignId: string,
  contact: CompanyContact,
  signal: PainSignal
) {
  const response = await fetch('https://api.instantly.ai/api/v1/lead/add', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: apiKey,
      campaign_id: campaignId,
      skip_if_in_workspace: true,
      leads: [{
        email: contact.email,
        first_name: contact.first_name,
        last_name: contact.last_name,
        company_name: signal.company_name,
        custom_variables: {
          pain_signal: signal.signal_title,
          pain_score: signal.pain_score,
        },
      }],
    }),
  });

  return response.json();
}
```

**Estimated Cost**: $37-97/month for Instantly

---

### 5.2 Custom Webhooks

**Value**: Let power users integrate with any system

**Database Changes**:
```sql
CREATE TABLE IF NOT EXISTS user_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(100),
  url TEXT NOT NULL,
  secret VARCHAR(100),
  events TEXT[] DEFAULT ARRAY['signal.created'],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID REFERENCES user_webhooks(id) ON DELETE CASCADE,
  event_type VARCHAR(50),
  payload JSONB,
  response_status INTEGER,
  response_body TEXT,
  delivered_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Implementation**:
```typescript
// src/lib/webhooks/dispatch.ts
import crypto from 'crypto';

export async function dispatchWebhook(
  webhook: UserWebhook,
  event: string,
  payload: any
) {
  const timestamp = Date.now();
  const signature = crypto
    .createHmac('sha256', webhook.secret)
    .update(`${timestamp}.${JSON.stringify(payload)}`)
    .digest('hex');

  const response = await fetch(webhook.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Signal-Mentis-Signature': signature,
      'X-Signal-Mentis-Timestamp': timestamp.toString(),
    },
    body: JSON.stringify({
      event,
      timestamp,
      data: payload,
    }),
  });

  // Log delivery
  await supabase.from('webhook_deliveries').insert({
    webhook_id: webhook.id,
    event_type: event,
    payload,
    response_status: response.status,
    response_body: await response.text(),
  });

  return response.ok;
}
```

**Estimated Cost**: Free

---

## Phase 6: API Access Tier (Week 6-7)

### 6.1 Public API for Power Users

**Value**: Let developers build on top of Signal-Mentis

**Database Changes**:
```sql
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  key_hash VARCHAR(64) NOT NULL,
  key_prefix VARCHAR(10) NOT NULL, -- sm_live_xxxx
  name VARCHAR(100),
  permissions TEXT[] DEFAULT ARRAY['signals.read'],
  rate_limit INTEGER DEFAULT 1000, -- per day
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
  endpoint VARCHAR(100),
  method VARCHAR(10),
  status_code INTEGER,
  response_time_ms INTEGER,
  called_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_api_usage_key ON api_usage(api_key_id);
CREATE INDEX idx_api_usage_date ON api_usage(called_at);
```

**Implementation**:
```typescript
// src/app/api/v1/signals/route.ts
import { verifyApiKey } from '@/lib/api/auth';

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('X-API-Key');

  const { user, error } = await verifyApiKey(apiKey);
  if (error) {
    return NextResponse.json({ error }, { status: 401 });
  }

  // Check rate limit
  const usage = await checkRateLimit(user.api_key_id);
  if (usage.exceeded) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', reset_at: usage.reset_at },
      { status: 429 }
    );
  }

  // Return signals...
}
```

**Estimated Cost**: Free (infra only)

---

## Summary: All Required Services & API Keys

### Essential (Must Have)
| Service | Purpose | Est. Cost | Sign Up |
|---------|---------|-----------|---------|
| Apify | Job scraping (Indeed, LinkedIn, Glassdoor) | $49/mo | https://apify.com/signup |
| Slack | Real-time alerts | Free | https://api.slack.com/apps |

### Recommended (High Value)
| Service | Purpose | Est. Cost | Sign Up |
|---------|---------|-----------|---------|
| Salesforce | Enterprise CRM sync | Free (API) | https://developer.salesforce.com |
| Instantly.ai | Email sequences | $37/mo | https://instantly.ai |
| Crunchbase | Funding signals | $99/mo | https://crunchbase.com/pricing |

### Optional (Nice to Have)
| Service | Purpose | Est. Cost | Sign Up |
|---------|---------|-----------|---------|
| BuiltWith | Tech stack detection | $295/mo | https://builtwith.com/api |
| Clearbit | Visitor identification | $99/mo | https://clearbit.com |
| Microsoft Teams | Team alerts | Free | https://portal.azure.com |

---

## Environment Variables Checklist

Add these to Vercel when ready:

```env
# Already Have
ADZUNA_APP_ID=
ADZUNA_API_KEY=
COMPANIES_HOUSE_API_KEY=
LEADMAGIC_API_KEY=
PROSPEO_API_KEY=

# Phase 1: Job Boards
APIFY_API_TOKEN=

# Phase 2: Notifications
SLACK_BOT_TOKEN=
SLACK_SIGNING_SECRET=
TEAMS_WEBHOOK_URL=

# Phase 3: CRM
SALESFORCE_CLIENT_ID=
SALESFORCE_CLIENT_SECRET=
SALESFORCE_REDIRECT_URI=

# Phase 4: Advanced Signals
CRUNCHBASE_API_KEY=
BUILTWITH_API_KEY=
CLEARBIT_API_KEY=

# Phase 5: Outreach
INSTANTLY_API_KEY=

# Security (Already configured)
ENCRYPTION_KEY=
```

---

## Implementation Priority

1. **Week 1**: Indeed + LinkedIn scraping (Apify) - Highest ROI
2. **Week 2**: Slack notifications - User engagement
3. **Week 3**: Salesforce integration - Enterprise value
4. **Week 4**: Funding signals - Premium data
5. **Week 5**: Email sequences - Automation value
6. **Week 6**: API access - Developer tier
7. **Week 7**: Tech stack + Visitor ID - Advanced signals

---

## Pricing Tiers (Suggested)

| Tier | Price | Features |
|------|-------|----------|
| **Starter** | £99/mo | 1 ICP, 500 signals/mo, Email alerts |
| **Professional** | £249/mo | 5 ICPs, 2,000 signals/mo, Slack, HubSpot |
| **Business** | £499/mo | Unlimited ICPs, 10,000 signals/mo, All integrations, API access |
| **Enterprise** | Custom | White-label, SSO, Dedicated support |

---

## Next Steps

1. Choose which phase to start with
2. Sign up for required services
3. Add API keys to Vercel environment
4. Let Claude Code implement each feature

**Ready to execute when you provide the API keys!**
