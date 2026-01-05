# Part 4: Signal Assessment

## Task

Create the signal assessment module that evaluates ICP relevance and opportunity type for a signal.

## File to Create

`src/lib/ai/signal-assessment.ts`

## Context

- Uses `generateObject` from AI SDK (already in the project)
- Uses Claude Sonnet (already configured in the project)
- Takes industry classification + ICP profile to determine relevance
- Analyzes the signal to determine opportunity type and urgency

## Implementation

```typescript
// src/lib/ai/signal-assessment.ts

import { generateObject } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { IndustryClassification } from './industry-classifier';
import { ICPProfile, CompanyPainSignal } from '@/types';

const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Output schema
const SignalAssessmentSchema = z.object({
  // ICP Match
  industryMatch: z.boolean().describe('Does company industry match ICP target industries?'),
  industryMatchScore: z.number().min(0).max(100).describe('How well industry matches (0-100)'),
  locationMatch: z.boolean().describe('Does company location match ICP target locations?'),
  locationMatchScore: z.number().min(0).max(100).describe('How well location matches (0-100)'),

  // Opportunity Assessment
  opportunityType: z.enum(['growth', 'transition', 'expansion', 'none']).describe('Type of opportunity this signal represents'),
  urgency: z.enum(['immediate', 'short_term', 'medium_term', 'low']).describe('How urgent is this opportunity'),
  hiringLikelihood: z.number().min(0).max(100).describe('Likelihood company will hire (0-100)'),

  // Reasoning
  reasoning: z.string().describe('Explanation of the assessment'),
  talkingPoints: z.array(z.string()).describe('Suggested conversation starters for outreach'),
  recommendedAction: z.enum(['reach_out', 'monitor', 'skip']).describe('What should user do with this signal'),

  // Final Score
  overallScore: z.number().min(0).max(100).describe('Overall relevance score (0-100)'),
});

export type SignalAssessment = z.infer<typeof SignalAssessmentSchema>;

/**
 * Assess a signal's relevance to an ICP and opportunity potential
 */
export async function assessSignal(
  signal: CompanyPainSignal,
  companyName: string,
  companyLocation: string | null,
  industryResult: IndustryClassification,
  icp: ICPProfile
): Promise<SignalAssessment> {
  console.log(`[Signal Assessment] Assessing signal for ${companyName}`);

  const prompt = buildAssessmentPrompt(signal, companyName, companyLocation, industryResult, icp);

  const { object } = await generateObject({
    model: anthropic('claude-sonnet-4-20250514'),
    schema: SignalAssessmentSchema,
    prompt,
  });

  console.log(`[Signal Assessment] Result for ${companyName}: ${object.overallScore}% (${object.recommendedAction})`);

  return object;
}

/**
 * Build the assessment prompt
 */
function buildAssessmentPrompt(
  signal: CompanyPainSignal,
  companyName: string,
  companyLocation: string | null,
  industry: IndustryClassification,
  icp: ICPProfile
): string {
  return `# TASK: Assess signal relevance and opportunity for "${companyName}"

## USER'S IDEAL CUSTOMER PROFILE (ICP)

**Name**: ${icp.name}
**Target Industries**: ${icp.industries?.join(', ') || 'Not specified'}
**Target Locations**: ${icp.locations?.join(', ') || 'Not specified'}
**Specific Roles Looking For**: ${icp.specific_roles?.join(', ') || 'Not specified'}
**Contract Sectors**: ${(icp as Record<string, unknown>).contract_sectors ? ((icp as Record<string, unknown>).contract_sectors as string[]).join(', ') : 'Not specified'}
**Contract Keywords**: ${(icp as Record<string, unknown>).contract_keywords ? ((icp as Record<string, unknown>).contract_keywords as string[]).join(', ') : 'Not specified'}
**Description**: ${icp.description || 'Not specified'}

---

## COMPANY BEING EVALUATED

**Company Name**: ${companyName}
**Company Location**: ${companyLocation || 'Unknown'}
**Detected Industry**: ${industry.primaryIndustry}
**Sub-sector**: ${industry.subSector || 'Unknown'}
**Company Size**: ${industry.companySize}
**Key Services**: ${industry.keyServices.join(', ')}
**Target Market**: ${industry.targetMarket || 'Unknown'}
**Industry Confidence**: ${industry.confidence}%

---

## SIGNAL DETAILS

**Signal Type**: ${signal.pain_signal_type}
**Signal Title**: ${signal.signal_title}
**Signal Detail**: ${signal.signal_detail}
**Source**: ${signal.source}
**Detected At**: ${signal.detected_at}

${signal.metadata ? `**Additional Metadata**: ${JSON.stringify(signal.metadata, null, 2)}` : ''}

---

## ASSESSMENT GUIDELINES

### Industry Matching
- Exact match (e.g., "Technology" to "Technology") = 100%
- Related match (e.g., "IT Services" to "Technology") = 70-90%
- Partial overlap (e.g., "Tech consulting" to "Professional Services") = 40-60%
- No match = 0-30%

### Location Matching
- Exact city/region match = 100%
- Same country but different region = 50-70%
- "All UK" or nationwide should match any UK location = 80%
- No match = 0%

### Opportunity Types
- **growth**: Company winning contracts, expanding, hiring = HIGH value
- **transition**: Leadership changes, restructuring = MEDIUM value
- **expansion**: New office, new market entry = HIGH value
- **none**: No clear opportunity = LOW value

### Hiring Likelihood Indicators
- Contract win → likely hiring to deliver (60-90%)
- New leadership → new initiatives possible (40-70%)
- Capital raise → expansion likely (50-80%)
- Tender publication → planning phase (20-40%)

### Urgency Assessment
- **immediate**: Act within 1-2 weeks (recent contract win, urgent need)
- **short_term**: Act within 1 month (leadership change, growth signal)
- **medium_term**: Act within 2-3 months (tender, planning stage)
- **low**: Monitor for now (weak signal)

### Recommended Actions
- **reach_out**: Score > 60%, good opportunity, act now
- **monitor**: Score 40-60%, potential but not strong
- **skip**: Score < 40%, not relevant to ICP

### Talking Points
Generate 2-3 specific, actionable conversation starters that:
1. Reference the specific signal (e.g., "Congratulations on the £2M contract")
2. Connect to their likely needs
3. Are natural and not salesy

---

Provide a thorough assessment of this signal's relevance to the user's ICP.`;
}

/**
 * Quick assessment without full industry classification
 * Use when you have limited information
 */
export async function quickAssessSignal(
  signal: CompanyPainSignal,
  companyName: string,
  companyIndustry: string | null,
  companyLocation: string | null,
  icp: ICPProfile
): Promise<SignalAssessment> {
  console.log(`[Signal Assessment] Quick assess for ${companyName}`);

  const { object } = await generateObject({
    model: anthropic('claude-sonnet-4-20250514'),
    schema: SignalAssessmentSchema,
    prompt: `Quickly assess this signal's relevance to the ICP.

## ICP
- Industries: ${icp.industries?.join(', ') || 'Any'}
- Locations: ${icp.locations?.join(', ') || 'Any'}

## Company
- Name: ${companyName}
- Industry: ${companyIndustry || 'Unknown'}
- Location: ${companyLocation || 'Unknown'}

## Signal
- Type: ${signal.pain_signal_type}
- Title: ${signal.signal_title}
- Detail: ${signal.signal_detail}

Assess relevance and provide recommendations. Be conservative with scores when information is limited.`,
  });

  return object;
}
```

## Testing

```typescript
import { assessSignal } from '@/lib/ai/signal-assessment';
import { classifyIndustry } from '@/lib/ai/industry-classifier';
import { researchCompany } from '@/lib/ai/company-research';

async function test() {
  // Mock ICP
  const icp = {
    id: 'test-icp',
    name: 'Tech Recruiters',
    industries: ['Technology', 'Software'],
    locations: ['London', 'Manchester'],
    specific_roles: ['Software Engineer', 'DevOps'],
  };

  // Mock signal
  const signal = {
    id: 'test-signal',
    pain_signal_type: 'contract_awarded',
    signal_title: 'AWS Migration Contract Win',
    signal_detail: 'Company won £500k AWS migration contract',
    source: 'contracts_finder',
    detected_at: new Date().toISOString(),
  };

  // Research and classify
  const research = await researchCompany('Example Tech Ltd');
  const industry = await classifyIndustry('Example Tech Ltd', research);

  // Assess
  const assessment = await assessSignal(
    signal,
    'Example Tech Ltd',
    'London',
    industry,
    icp
  );

  console.log('Overall Score:', assessment.overallScore);
  console.log('Recommended Action:', assessment.recommendedAction);
  console.log('Talking Points:', assessment.talkingPoints);
}
```

## DO NOT

- Create new AI provider configuration (use existing)
- Change the model name (use `claude-sonnet-4-20250514`)
- Modify other files
- Import from files that don't exist yet (Parts 5-6)

