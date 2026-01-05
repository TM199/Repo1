# AI Signal Validation Plan

## Executive Summary

The current signal pipeline fetches raw data from government APIs (Contracts Finder, Find a Tender, Companies House) with minimal filtering. While job board signals have natural relevance (keyword + location matching), government signals need AI validation to ensure quality and ICP relevance.

**Recommendation**: Implement an AI validation workflow for premium users that scores signal relevance against their ICP before displaying.

---

## Current State Analysis

### What Each API Provides

| Source | Native Filtering | Relevance to ICP |
|--------|-----------------|------------------|
| **Job Boards** | Keywords, location, job type | HIGH - searches by ICP's specific_roles |
| **Contracts Finder** | Date range, CPV codes, value | LOW - no industry/ICP filtering |
| **Find a Tender** | Date range only | LOW - no industry/ICP filtering |
| **Companies House** | Company name, filing type | MEDIUM - location/industry match on company |

### Current Filtering Logic

1. **Job Boards**: Already targeted - searches by ICP keywords + location
2. **Contracts/Tenders**: Location match only (signal.location contains ICP.location)
3. **Companies House**: Location + industry match on the company record

### The Problem

A user with ICP: "Technology companies in London looking for DevOps engineers"

Current system might show:
- Contract: "NHS London wins catering equipment tender" (irrelevant industry)
- Tender: "TfL awards bus maintenance contract" (irrelevant to tech)
- CH Signal: "Retail company appoints new director" (wrong industry)

These are noise, not signals.

---

## Proposed Solution: AI Validation Workflow

### Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Cron Jobs      │────▶│  Raw Signals     │────▶│  AI Validation  │
│  (Daily sync)   │     │  (Unvalidated)   │     │  Workflow       │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                          │
                                                          ▼
                        ┌──────────────────┐     ┌─────────────────┐
                        │  Pain Dashboard  │◀────│  Validated      │
                        │  (User sees)     │     │  Signals        │
                        └──────────────────┘     └─────────────────┘
```

### New Database Fields

```sql
ALTER TABLE company_pain_signals ADD COLUMN IF NOT EXISTS
  validation_status TEXT DEFAULT 'pending', -- pending, validated, rejected
  relevance_score FLOAT,                    -- 0.0 to 1.0
  relevance_reasoning TEXT,                 -- AI explanation
  validated_at TIMESTAMPTZ,
  ai_model_used TEXT;
```

### Signal States

1. **pending** - Raw signal, not yet validated (free tier: shown as-is)
2. **validated** - AI confirmed relevant (premium: shown with confidence)
3. **rejected** - AI determined irrelevant (hidden from dashboard)

---

## AI Validation Prompt Design

### For Contracts/Tenders

```
You are evaluating if a government contract/tender signal is relevant to a user's Ideal Customer Profile (ICP).

ICP Definition:
- Industries: {industries}
- Locations: {locations}
- Company Types: {company_types}
- Signal Types Interested In: {signal_types}
- Description: {icp_description}

Signal to Evaluate:
- Type: {contract_awarded | tender_published}
- Company Name: {supplier_name}
- Contract Title: {title}
- Contract Description: {description}
- Value: £{value}
- Buyer: {buyer_name}
- Location: {location}
- CPV Codes: {cpv_codes}

Evaluate:
1. Does the SUPPLIER (not the buyer) operate in industries matching the ICP?
2. Is this contract win a meaningful business signal (growth, capability, credibility)?
3. Would this company be a potential sales target for someone with this ICP?

Respond with JSON:
{
  "relevant": true/false,
  "score": 0.0-1.0,
  "reasoning": "Brief explanation",
  "supplier_industry_guess": "Technology/Healthcare/Finance/etc",
  "signal_strength": "strong/moderate/weak"
}
```

### For Companies House

```
You are evaluating if a Companies House signal indicates a meaningful business opportunity for a user's ICP.

ICP Definition:
- Industries: {industries}
- Locations: {locations}
- Signal Types: {signal_types}

Signal to Evaluate:
- Type: {new_director_appointment | leadership_reorganisation | director_gap | capital_raise}
- Company Name: {company_name}
- Company Industry: {company_industry}
- Company Location: {company_location}
- Signal Details: {signal_detail}
- Officer Name (if applicable): {officer_name}
- Filing Date: {filing_date}

Evaluate:
1. Does this company match the ICP's target industries?
2. Does this signal indicate a buying opportunity (growth, change, need)?
3. Is the timing relevant (recent enough to act on)?

Respond with JSON:
{
  "relevant": true/false,
  "score": 0.0-1.0,
  "reasoning": "Brief explanation",
  "opportunity_type": "growth | transition | need | none",
  "recommended_action": "reach_out | monitor | ignore"
}
```

---

## Cost Analysis

### Using Claude 3.5 Haiku

| Metric | Value |
|--------|-------|
| Input tokens per validation | ~600 tokens |
| Output tokens per validation | ~150 tokens |
| Haiku input cost | $0.80 / 1M tokens |
| Haiku output cost | $4.00 / 1M tokens |
| **Cost per validation** | **$0.00108** (~$0.001) |

### Projected Usage

| Scenario | Signals/Day | Cost/Day | Cost/Month |
|----------|-------------|----------|------------|
| Light user (1 ICP) | 20 signals | $0.02 | $0.60 |
| Medium user (3 ICPs) | 60 signals | $0.06 | $1.80 |
| Heavy user (10 ICPs) | 200 signals | $0.22 | $6.60 |

### Cost Control Strategies

1. **Batch validation**: Group signals, validate in batches of 10
2. **Pre-filtering**: Skip obviously irrelevant signals (wrong location)
3. **Caching**: Don't re-validate duplicate signals
4. **Throttling**: Limit validations per day per user
5. **Smart scheduling**: Validate during off-peak hours

---

## Implementation Plan

### Phase 1: Database Schema (Day 1)
- [ ] Add validation columns to `company_pain_signals`
- [ ] Add `ai_validation_credits` to user/subscription model
- [ ] Create index on `validation_status`

### Phase 2: AI Validation Service (Days 2-3)
- [ ] Create `src/lib/ai/signal-validator.ts`
- [ ] Implement validation prompt templates
- [ ] Add Claude API integration with Vercel AI SDK
- [ ] Add batch validation support

### Phase 3: Validation Workflow (Days 4-5)
- [ ] Create Inngest function: `validate-pending-signals`
- [ ] Run after each cron job completes
- [ ] Process signals in batches of 10
- [ ] Update signal status and scores

### Phase 4: Dashboard Integration (Day 6)
- [ ] Filter dashboard by `validation_status = 'validated'` for premium
- [ ] Show relevance score badge on signals
- [ ] Add "Why this signal?" tooltip with reasoning

### Phase 5: Billing Integration (Day 7)
- [ ] Track validation credits used
- [ ] Add to usage dashboard
- [ ] Implement credit limits by plan

---

## Feature Tiers

### Free Tier
- Job board signals only (already keyword-matched)
- No government signal validation
- Basic location filtering

### Pro Tier ($49/month)
- All signal sources
- AI validation included (up to 500/month)
- Relevance scoring
- "Why this signal?" explanations

### Enterprise Tier ($199/month)
- Unlimited AI validations
- Custom ICP weighting
- API access to validation
- Priority processing

---

## Alternative Approaches Considered

### Option A: Pre-filter at API Level
**Pros**: No AI cost, faster
**Cons**: Limited filtering options, misses relevant signals
**Verdict**: Not sufficient - APIs don't support industry filtering

### Option B: Rule-based Filtering
**Pros**: No AI cost, predictable
**Cons**: Can't handle nuance, high false negative rate
**Verdict**: Useful as pre-filter, not sufficient alone

### Option C: On-demand Validation (Current Recommendation)
**Pros**: Only pay for what users view, real-time
**Cons**: Latency on first view
**Verdict**: Good hybrid - validate when user first views

### Option D: Background Batch Validation (Recommended)
**Pros**: No user latency, clean dashboard
**Cons**: Validates signals user may never see
**Verdict**: Best UX, reasonable cost

---

## Technical Implementation Notes

### Vercel AI SDK Usage

```typescript
import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';

const ValidationSchema = z.object({
  relevant: z.boolean(),
  score: z.number().min(0).max(1),
  reasoning: z.string(),
  opportunity_type: z.enum(['growth', 'transition', 'need', 'none']),
});

async function validateSignal(signal: Signal, icp: ICPProfile) {
  const { object } = await generateObject({
    model: anthropic('claude-3-5-haiku-latest'),
    schema: ValidationSchema,
    prompt: buildValidationPrompt(signal, icp),
  });

  return object;
}
```

### Inngest Workflow

```typescript
export const validatePendingSignals = inngest.createFunction(
  { id: 'validate-pending-signals' },
  { event: 'signals/validate' },
  async ({ step }) => {
    // Get pending signals
    const signals = await step.run('get-pending', async () => {
      return supabase
        .from('company_pain_signals')
        .select('*, icp_profiles(*)')
        .eq('validation_status', 'pending')
        .limit(50);
    });

    // Validate in batches
    for (const batch of chunk(signals, 10)) {
      await step.run(`validate-batch`, async () => {
        const results = await Promise.all(
          batch.map(s => validateSignal(s, s.icp_profiles))
        );
        // Update database with results
      });
    }
  }
);
```

---

## Success Metrics

1. **Relevance Rate**: % of validated signals marked relevant (target: >60%)
2. **False Positive Rate**: User-reported irrelevant signals (target: <10%)
3. **Validation Cost**: Average cost per user per month (target: <$3)
4. **User Engagement**: Click-through on validated vs unvalidated signals

---

## Next Steps

1. **Approve plan** - Confirm this approach meets requirements
2. **Define MVP** - Which signal types to validate first?
3. **Set up billing** - How to track/charge for AI credits?
4. **Build prototype** - Start with Contracts Finder validation only

---

## Questions for Discussion

1. Should free tier see unvalidated government signals, or no government signals at all?
2. What relevance threshold should we use? (0.5? 0.7?)
3. Should we show rejected signals in a "filtered out" section?
4. Do we need human review for edge cases?
