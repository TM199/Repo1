# AI Signal Validation - Implementation Guide

## Overview

This guide is split into **6 parts** that can be given to Claude one at a time to implement the AI signal validation system without running out of context.

**Goal**: Validate government signals (contracts, tenders, Companies House) using AI to ensure they're actually relevant to the user's ICP before showing them.

**How it works**:
1. Research the company via Tavily web search
2. Classify their actual industry from website content
3. Match against the user's ICP
4. Generate actionable insights with talking points

## Parts

| Part | File | Description |
|------|------|-------------|
| 1 | `scripts/migrate-signal-validation.sql` | Database schema - validation columns + usage tracking |
| 2 | `src/lib/ai/company-research.ts` | Tavily-based company research tool |
| 3 | `src/lib/ai/industry-classifier.ts` | Claude-based industry classification |
| 4 | `src/lib/ai/signal-assessment.ts` | ICP matching and opportunity assessment |
| 5 | `src/agents/signal-validator-agent.ts` | Main orchestration that ties it all together |
| 6 | `src/inngest/functions/validate-signals.ts` | Background processing integration |

## Implementation Order

**IMPORTANT**: Complete each part fully and test it before moving to the next.

```
Part 1 (DB) → Part 2 (Research) → Part 3 (Industry) → Part 4 (Assessment) → Part 5 (Agent) → Part 6 (Inngest)
```

Each part includes its own testing instructions. Don't skip testing.

## How to Use These Documents

1. Start a fresh Claude conversation
2. Give Claude **Part 1** - let it complete the migration
3. Test that the migration works
4. Start a new conversation (or continue if context allows)
5. Give Claude **Part 2** - let it create the research tool
6. Test the research tool
7. Continue for each part...

## What NOT to Change

These files should NOT be modified (the validation system integrates WITH them, not replaces them):
- `src/inngest/functions/sync-government-data.ts` - Just trigger validation after
- `src/app/api/cron/government/route.ts` - Leave as-is, validation is separate
- `src/lib/ai/tavily.ts` - Reuse existing functions, don't modify
- `src/agents/agency-classifier-agent.ts` - Reference pattern, don't change

## Testing Each Part

After each part, test it before moving on:

| Part | Test |
|------|------|
| 1 | Run migration, query `company_pain_signals` to verify columns exist |
| 2 | Call `researchCompany('Accenture')`, verify it returns website content |
| 3 | Call `classifyIndustry('Accenture', research)`, verify industry result |
| 4 | Call `assessSignal(signal, company, industry, icp)`, verify assessment |
| 5 | Call `validateSignal(signal, company, icp)`, verify full flow works |
| 6 | Trigger Inngest function via dev UI, verify signals get updated |

## Environment Variables Required

Make sure these are set before testing:
```
ANTHROPIC_API_KEY=sk-ant-...
TAVILY_API_KEY=tvly-...
```

## Cost Estimate

| Component | Cost per signal |
|-----------|-----------------|
| Tavily (3 searches) | ~$0.02 |
| Claude Sonnet (2 calls) | ~$0.02 |
| **Total** | **~$0.04/signal** |
